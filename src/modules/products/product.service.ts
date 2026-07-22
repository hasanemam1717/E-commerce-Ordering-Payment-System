/**
 * ProductService — Full CRUD with pagination, search, filtering, and RBAC.
 */
import { PrismaClient, Prisma, ProductStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../common/utils/AppError';
import type { ProductResponse, PaginatedProductResult } from './product.types';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from './product.validation';

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  // ════════════════════════════════════════════════════════════
  //  Public API
  // ════════════════════════════════════════════════════════════

  /**
   * List products with pagination, full-text search, and optional filters.
   */
  async list(query: ListProductsQuery): Promise<PaginatedProductResult> {
    const { page, limit, search, categoryId, minPrice, maxPrice, status } = query;
    const skip = (page - 1) * limit;

    // Build WHERE clause dynamically
    const where: Prisma.ProductWhereInput = {};

    // Search across name and description
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Filter by status
    if (status) {
      where.status = status as ProductStatus;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.debug({ page, limit, total }, 'Products listed');

    return {
      data: products.map((p) => this.toResponse(p)),
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Get a single product by ID.
   */
  async getById(id: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with id '${id}' not found`);
    }

    return this.toResponse(product);
  }

  /**
   * Create a new product (Admin only — guard applied in routes).
   */
  async create(dto: CreateProductInput): Promise<ProductResponse> {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        description: dto.description ?? null,
        price: dto.price,
        stock: dto.stock,
        status: (dto.status ?? 'ACTIVE') as ProductStatus,
        categoryId: dto.categoryId ?? null,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    logger.info({ productId: product.id, sku: product.sku }, 'Product created');

    return this.toResponse(product);
  }

  /**
   * Update an existing product (Admin only).
   */
  async update(id: string, dto: UpdateProductInput): Promise<ProductResponse> {
    // Verify existence first
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Product with id '${id}' not found`);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.status !== undefined && { status: dto.status as ProductStatus }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    logger.info({ productId: product.id }, 'Product updated');

    return this.toResponse(product);
  }

  /**
   * Soft-delete a product by setting status to INACTIVE (Admin only).
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Product with id '${id}' not found`);
    }

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.INACTIVE },
    });

    logger.info({ productId: id }, 'Product deactivated (soft-delete)');
  }

  // ════════════════════════════════════════════════════════════
  //  Private helpers
  // ════════════════════════════════════════════════════════════

  private toResponse(product: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
    price: Prisma.Decimal;
    stock: number;
    status: ProductStatus;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string } | null;
  }): ProductResponse {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      status: product.status,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
