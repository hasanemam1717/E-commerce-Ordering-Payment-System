/**
 * CategoryService — Enterprise-grade hierarchical category traversal
 * with Redis cache-aside pattern and recursive Depth-First Search.
 *
 * Principles applied:
 *   - Single Responsibility: only category tree + caching logic
 *   - Dependency Inversion: depends on PrismaClient + Redis abstractions
 *   - Cache-Aside: read-through cache with explicit invalidation
 */
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../common/utils/AppError';
import type {
  CategoryTreeNode,
  CategoryTreeResult,
  CategoryRow,
  ProductRow,
} from './category.types';

// ─── Constants ────────────────────────────────────────────
const CACHE_PREFIX = 'category:tree:';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export class CategoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  // ══════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════

  /**
   * Retrieve a full category sub-tree (root at `categoryId`) with all
   * nested children and their ACTIVE products.
   *
   * Implements Cache-Aside:
   *   1. Check Redis for cached result.
   *   2. On hit → deserialize and return immediately.
   *   3. On miss → run DFS, cache with 1h TTL, return.
   */
  async getCategoryTreeWithProducts(categoryId: string): Promise<CategoryTreeResult> {
    const cacheKey = this.buildCacheKey(categoryId);

    // ── 1. Cache hit ─────────────────────────────────
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      logger.debug({ categoryId }, 'Category tree cache HIT');
      return JSON.parse(cached) as CategoryTreeResult;
    }

    logger.debug({ categoryId }, 'Category tree cache MISS — executing DFS');

    // ── 2. Hydrate data stores from PostgreSQL ────────
    const [allCategories, allActiveProducts] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          categoryId: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Fast lookups
    const categoryLookup = new Map<string, CategoryRow>();
    const childrenMap = new Map<string | null, CategoryRow[]>();
    const productMap = new Map<string | null, ProductRow[]>();

    for (const cat of allCategories) {
      const row: CategoryRow = { id: cat.id, name: cat.name, slug: cat.slug, parentId: cat.parentId };
      categoryLookup.set(cat.id, row);

      const key = cat.parentId ?? null;
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(row);
    }

    for (const prod of allActiveProducts) {
      const key = prod.categoryId ?? null;
      if (!productMap.has(key)) productMap.set(key, []);
      productMap.get(key)!.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        price: Number(prod.price),
        stock: prod.stock,
        categoryId: prod.categoryId,
      });
    }

    // ── 3. Verify root exists ────────────────────────
    if (!categoryLookup.has(categoryId)) {
      throw new NotFoundError(`Category with id '${categoryId}' not found`);
    }

    // ── 4. Recursive DFS ─────────────────────────────
    const buildTree = (nodeId: string): CategoryTreeNode => {
      const category = categoryLookup.get(nodeId)!;

      const children: CategoryTreeNode[] = (childrenMap.get(nodeId) ?? []).map((child) =>
        buildTree(child.id),
      );

      const products = (productMap.get(nodeId) ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        stock: p.stock,
      }));

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        children,
        products,
      };
    };

    const tree = buildTree(categoryId);

    // ── 5. Compute aggregate metrics ─────────────────
    const result: CategoryTreeResult = {
      category: tree,
      totalProducts: this.countProducts(tree),
      depth: this.maxDepth(tree),
    };

    // ── 6. Store in cache ────────────────────────────
    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    logger.debug({ categoryId }, 'Category tree cached successfully');

    return result;
  }

  /**
   * Invalidate cached category trees.
   *
   * @param categoryId - If provided, invalidates only the tree rooted at that
   *                     category. If omitted, invalidates ALL category trees.
   */
  async invalidateCategoryCache(categoryId?: string): Promise<void> {
    if (categoryId) {
      const cacheKey = this.buildCacheKey(categoryId);
      await this.redis.del(cacheKey);
      logger.debug({ categoryId }, 'Category tree cache invalidated (single)');
      return;
    }

    // Invalidate all category:tree:* keys via SCAN (non-blocking)
    let cursor = '0';
    let keysCount = 0;
    const pattern = `${CACHE_PREFIX}*`;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
        keysCount += keys.length;
      }
    } while (cursor !== '0');

    logger.debug({ keysCount }, 'All category tree caches invalidated (full)');
  }

  // ══════════════════════════════════════════════════════════
  //  Private helpers
  // ══════════════════════════════════════════════════════════

  private buildCacheKey(categoryId: string): string {
    return `${CACHE_PREFIX}${categoryId}`;
  }

  /** Count ALL products in the tree (node + all descendants) */
  private countProducts(node: CategoryTreeNode): number {
    let count = node.products.length;
    for (const child of node.children) {
      count += this.countProducts(child);
    }
    return count;
  }

  /** Compute the maximum depth of the tree (0 = leaf node) */
  private maxDepth(node: CategoryTreeNode): number {
    if (node.children.length === 0) return 0;
    let deepest = 0;
    for (const child of node.children) {
      deepest = Math.max(deepest, 1 + this.maxDepth(child));
    }
    return deepest;
  }
}
