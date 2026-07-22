/**
 * OrderService — Production-grade order creation with DDD principles.
 *
 * Domain invariants enforced:
 *   - Products must exist and be ACTIVE
 *   - Stock must be sufficient for every line item
 *   - All monetary values use Decimal arithmetic (no floating point)
 *   - The entire flow is wrapped in an interactive Prisma transaction
 *     with pessimistic locking (FOR UPDATE) to prevent race conditions.
 *
 * Thread-safety strategy:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 1. Interactive transaction (prisma.$transaction)        │
 *   │ 2. SELECT ... FOR UPDATE locks product rows             │
 *   │ 3. Atomic stock decrement with guard condition          │
 *   │    (UPDATE ... WHERE stock >= requested)                │
 *   │ 4. On conflict → Prisma throws P2025 → rollback         │
 *   └─────────────────────────────────────────────────────────┘
 */
import { PrismaClient, Prisma, OrderStatus, ProductStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import {
  ProductNotFoundError,
  ProductNotActiveError,
  InsufficientStockError,
  UserNotFoundError,
} from './order.errors';
import type {
  CreateOrderInput,
  CreateOrderItemInput,
  OrderResponse,
  OrderItemResponse,
} from './order.types';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class OrderService {
  constructor(private readonly prisma: PrismaClient) {}

  // ════════════════════════════════════════════════════════════
  //  Public API
  // ════════════════════════════════════════════════════════════

  /**
   * Create an order with validated line items.
   *
   * The entire operation runs inside an interactive transaction
   * with pessimistic row locking to guarantee correctness under
   * concurrent requests.
   */
  async createOrder(input: CreateOrderInput): Promise<OrderResponse> {
    const { userId, items } = input;

    if (items.length === 0) {
      throw new ProductNotFoundError([]);
    }

    // Deduplicate line items — sum quantities for the same product
    const mergedItems = this.mergeLineItems(items);

    return this.prisma.$transaction(async (tx: TxClient) => {
      // ── 1. Verify user exists ─────────────────────────────
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      // ── 2. Lock product rows with FOR UPDATE ──────────────
      const productIds = mergedItems.map((i) => i.productId);
      const lockedProducts = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          price: Prisma.Decimal;
          stock: number;
          status: string;
        }>
      >(
        Prisma.sql`SELECT id, name, sku, price, stock, status FROM products WHERE id = ANY (${productIds}) FOR UPDATE`,
      );

      // ── 3. Validate products ──────────────────────────────
      const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

      // Check for missing products
      const foundIds = lockedProducts.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      if (missingIds.length > 0) {
        throw new ProductNotFoundError(missingIds);
      }

      // Validate status and stock for every item
      for (const item of mergedItems) {
        const product = productMap.get(item.productId)!;

        if (product.status !== ProductStatus.ACTIVE) {
          throw new ProductNotActiveError(item.productId, product.status);
        }

        if (product.stock < item.quantity) {
          throw new InsufficientStockError(
            item.productId,
            item.quantity,
            product.stock,
          );
        }
      }

      // ── 4. Calculate monetary values with Decimal ─────────
      const calculation = this.calculateOrder(mergedItems, productMap);
      const totalAmount = calculation.total;

      // ── 5. Create order with nested items ─────────────────
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: OrderStatus.PENDING,
          items: {
            create: mergedItems.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
                subtotal: new Prisma.Decimal(item.quantity).mul(product.price),
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      // ── 6. Decrement stock atomically ─────────────────────
      for (const item of mergedItems) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        // Safety net — should never fire because we validated above,
        // but guards against concurrent modifications within the tx.
        if (result.count === 0) {
          // Rollback is automatic once this method throws inside $transaction
          throw new InsufficientStockError(
            item.productId,
            item.quantity,
            productMap.get(item.productId)!.stock,
          );
        }
      }

      logger.info(
        {
          orderId: order.id,
          userId,
          itemCount: order.items.length,
          total: totalAmount.toString(),
        },
        'Order created successfully',
      );

      // ── 7. Map to response DTO ────────────────────────────
      return this.toOrderResponse(order);
    });
  }

  // ════════════════════════════════════════════════════════════
  //  Private helpers
  // ════════════════════════════════════════════════════════════

  /**
   * Merge duplicate productIds by summing quantities.
   * Example: [{productId: 'a', qty: 2}, {productId: 'a', qty: 3}]
   *        → [{productId: 'a', qty: 5}]
   */
  private mergeLineItems(items: CreateOrderItemInput[]): CreateOrderItemInput[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const current = map.get(item.productId) ?? 0;
      map.set(item.productId, current + item.quantity);
    }
    return Array.from(map.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  /**
   * Calculate subtotals and total using Prisma.Decimal for
   * deterministic, floating-point-safe arithmetic.
   */
  private calculateOrder(
    items: CreateOrderItemInput[],
    productMap: Map<
      string,
      { price: Prisma.Decimal; name: string; sku: string }
    >,
  ): { items: Array<{ productId: string; quantity: number; price: Prisma.Decimal; subtotal: Prisma.Decimal }>; total: Prisma.Decimal } {
    let total = new Prisma.Decimal(0);

    const calculatedItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const quantity = new Prisma.Decimal(item.quantity);
      const subtotal = quantity.mul(product.price);

      total = total.add(subtotal);

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        subtotal,
      };
    });

    return { items: calculatedItems, total };
  }

  /**
   * Map the Prisma Order model to a public OrderResponse DTO.
   */
  private toOrderResponse(
    order: Prisma.OrderGetPayload<{
      include: {
        items: {
          include: {
            product: { select: { id: true; name: true; sku: true } };
          };
        };
      };
    }>,
  ): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      total: Number(order.totalAmount),
      items: order.items.map(
        (item): OrderItemResponse => ({
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: Number(item.price),
          subtotal: Number(item.subtotal),
        }),
      ),
      createdAt: order.createdAt.toISOString(),
    };
  }
}
