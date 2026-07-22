/**
 * PaymentService — Orchestration layer for payment processing.
 *
 * Responsibilities:
 *   - Coordinate with PaymentContext (strategy pattern) for provider calls
 *   - Create/update Payment records in the database
 *   - Atomic post-payment stock reduction (Prisma transaction + FOR UPDATE)
 *   - Handle webhook events and trigger success/failure flows
 *
 * Thread-safety for stock reduction:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 1. Interactive transaction (prisma.$transaction)        │
 *   │ 2. SELECT ... FOR UPDATE locks product rows             │
 *   │ 3. Atomic decrement: stock = stock - quantity           │
 *   │ 4. Guard: WHERE stock >= quantity                       │
 *   │ 5. All-or-nothing rollback on any failure               │
 *   └─────────────────────────────────────────────────────────┘
 */
import { PrismaClient, Prisma, PaymentStatus, OrderStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import { PaymentContext } from './payment.context';
import {
  PaymentNotFoundError,
  InvalidPaymentStateError,
} from './payment.errors';
import { UnsupportedProviderError } from './payment.errors';
import type { PaymentProviderName, InitiatePaymentResponse } from './payment.types';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PaymentService {
  constructor(private readonly prisma: PrismaClient) {}

  // ════════════════════════════════════════════════════════════
  //  Public API
  // ════════════════════════════════════════════════════════════

  /**
   * Initiate a payment for an order.
   *
   * 1. Validate order exists and is in PENDING status
   * 2. Create a Payment record (status: PENDING)
   * 3. Call the provider strategy to initiate payment
   * 4. Update Payment record with the transactionId
   */
  async initiatePayment(
    orderId: string,
    provider: PaymentProviderName,
  ): Promise<InitiatePaymentResponse> {
    // ── 0. Validate provider against Prisma enum ───────
    const validProviders = ['STRIPE', 'BKASH'] as const;
    if (!validProviders.includes(provider as typeof validProviders[number])) {
      throw new UnsupportedProviderError(provider);
    }

    // ── 1. Validate order ──────────────────────────────
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, totalAmount: true },
    });

    if (!order) {
      throw new PaymentNotFoundError(orderId);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new InvalidPaymentStateError(orderId, order.status);
    }

    const amount = Number(order.totalAmount);

    // ── 2. Check for existing payment (re-attempt guard) ─
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
      throw new InvalidPaymentStateError(orderId, `already has a SUCCESS payment`);
    }

    // Reuse existing FAILED payment record, or create a new one
    const payment = existingPayment
      ? await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            provider,
            transactionId: `pending-${Date.now()}`,
            status: PaymentStatus.PENDING,
            rawResponse: Prisma.JsonNull,
          },
        })
      : await this.prisma.payment.create({
          data: {
            orderId,
            provider,
            transactionId: `pending-${Date.now()}`,
            status: PaymentStatus.PENDING,
          },
        });

    try {
      // ── 3. Call provider strategy ────────────────────
      const result = await PaymentContext.initiatePayment(provider, orderId, amount);

      // ── 4. Update with real transactionId ─────────────
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: result.transactionId,
          rawResponse: (result.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      logger.info(
        { orderId, transactionId: result.transactionId, provider },
        'Payment initiated',
      );

      return {
        transactionId: result.transactionId,
        paymentUrl: result.paymentUrl,
        status: PaymentStatus.PENDING,
        metadata: (result.metadata ?? {}) as Record<string, string>,
      };
    } catch (err) {
      // Clean up the payment record on failure
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawResponse: err instanceof Error ? { error: err.message } : Prisma.JsonNull,
        },
      });
      throw err;
    }
  }

  /**
   * Confirm a payment after the frontend completes the provider flow.
   * Verifies the payment status with the provider and applies the
   * success logic if confirmed.
   */
  async confirmPayment(
    provider: PaymentProviderName,
    transactionId: string,
    orderId?: string,
  ): Promise<{ success: boolean; status: string }> {
    const result = await PaymentContext.verifyPayment(provider, {
      transactionId,
      ...(orderId ? { orderId } : {}),
    });

    if (result.success) {
      await this.handlePaymentSuccess(transactionId, provider, result.rawResponse);
    }

    return { success: result.success, status: result.success ? 'SUCCESS' : 'FAILED' };
  }

  /**
   * Handle an incoming webhook from a payment provider.
   */
  async handleWebhook(
    provider: PaymentProviderName,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<void> {
    const webhookResult = await PaymentContext.handleWebhook(provider, headers, rawBody);

    if (webhookResult.success) {
      await this.handlePaymentSuccess(
        webhookResult.transactionId,
        provider,
        webhookResult.rawResponse,
      );
    }

    logger.info(
      {
        eventType: webhookResult.eventType,
        transactionId: webhookResult.transactionId,
        orderId: webhookResult.orderId,
        success: webhookResult.success,
      },
      'Webhook processed',
    );
  }

  /**
   * Get payment by ID.
   */
  async getPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { id: true, status: true, totalAmount: true } } },
    });

    if (!payment) {
      throw new PaymentNotFoundError(paymentId);
    }

    return payment;
  }

  // ════════════════════════════════════════════════════════════
  //  Private — Post-payment success (atomic stock reduction)
  // ════════════════════════════════════════════════════════════

  /**
   * Atomic post-payment processing:
   *   1. Locate the Payment record by transactionId
   *   2. Update Payment status → SUCCESS with raw response
   *   3. Update Order status → PAID
   *   4. Decrement stock for every OrderItem via FOR UPDATE lock
   *
   * All steps happen inside a single interactive transaction —
   * if stock decrement fails, everything rolls back.
   */
  private async handlePaymentSuccess(
    transactionId: string,
    _provider: string,
    rawResponse: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: TxClient) => {
      // ── 1. Find payment record ───────────────────────
      const payment = await tx.payment.findUnique({
        where: { transactionId },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: {
                    select: { id: true, name: true, stock: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!payment) {
        logger.warn({ transactionId }, 'Payment record not found for webhook — may be duplicate');
        return;
      }

      // Idempotency — skip if already processed
      if (payment.status === PaymentStatus.SUCCESS) {
        logger.info({ transactionId }, 'Payment already processed — skipping');
        return;
      }

      const order = payment.order;

      // ── 2. Update payment record ─────────────────────
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          rawResponse: rawResponse as Prisma.InputJsonValue,
        },
      });

      // ── 3. Update order status ───────────────────────
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });

      // ── 4. Lock and decrement stock ──────────────────
      const orderItems = order.items;
      const productIds = orderItems.map((item) => item.productId);

      // Lock product rows
      await tx.$queryRaw<unknown>(
        Prisma.sql`SELECT id, stock FROM products WHERE id = ANY (${productIds}) FOR UPDATE`,
      );

      // Atomic stock reduction with guard
      for (const item of orderItems) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (result.count === 0) {
          logger.error(
            { productId: item.productId, requested: item.quantity, productName: item.product.name },
            'Stock decrement failed — insufficient stock during payment fulfillment',
          );
          throw new Error(
            `Insufficient stock for product '${item.product.name}' (${item.productId}) during payment fulfillment`,
          );
        }
      }

      logger.info(
        {
          orderId: order.id,
          transactionId,
          itemsReduced: orderItems.length,
        },
        'Stock reduced after successful payment',
      );
    });
  }
}
