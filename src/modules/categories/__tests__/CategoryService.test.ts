import { CategoryService } from '../category.service';
import { NotFoundError } from '../../../common/utils/AppError';

// ─── Mocks ─────────────────────────────────────────────────
const mockPrisma = {
  category: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
};

function createService(): CategoryService {
  return new CategoryService(mockPrisma as any, mockRedis as any);
}

beforeEach(() => {
  jest.resetAllMocks();
});

// ════════════════════════════════════════════════════════════
//  Fixtures
// ════════════════════════════════════════════════════════════

const ROOT_ID = 'cat-root';
const CHILD_A_ID = 'cat-a';
const CHILD_B_ID = 'cat-b';
const GRANDCHILD_ID = 'cat-c';

const categories = [
  { id: ROOT_ID, name: 'Electronics', slug: 'electronics', parentId: null },
  { id: CHILD_A_ID, name: 'Laptops', slug: 'laptops', parentId: ROOT_ID },
  { id: CHILD_B_ID, name: 'Audio', slug: 'audio', parentId: ROOT_ID },
  { id: GRANDCHILD_ID, name: 'Gaming Laptops', slug: 'gaming-laptops', parentId: CHILD_A_ID },
];

const productsLaptops = [
  { id: 'p1', name: 'MacBook Pro', sku: 'LAP-001', price: 1999.99, stock: 10, categoryId: CHILD_A_ID },
];

const productsGaming = [
  { id: 'p2', name: 'Alienware', sku: 'LAP-002', price: 2499.99, stock: 5, categoryId: GRANDCHILD_ID },
];

const productsAudio = [
  { id: 'p3', name: 'Sony WH-1000XM5', sku: 'HDN-001', price: 349.99, stock: 50, categoryId: CHILD_B_ID },
];

// ════════════════════════════════════════════════════════════
//  DFS Traversal — Happy Path
// ════════════════════════════════════════════════════════════

describe('CategoryService — DFS Tree Traversal', () => {
  it('builds a full category tree with nested children and products (cache miss)', async () => {
    mockRedis.get.mockResolvedValue(null); // cache miss
    mockPrisma.category.findMany.mockResolvedValue(categories);
    mockPrisma.product.findMany.mockResolvedValue([
      ...productsLaptops,
      ...productsGaming,
      ...productsAudio,
    ]);

    const service = createService();
    const result = await service.getCategoryTreeWithProducts(ROOT_ID);

    // Cache was checked
    expect(mockRedis.get).toHaveBeenCalledWith(`category:tree:${ROOT_ID}`);

    // Data was fetched from DB
    expect(mockPrisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );

    // Root node
    expect(result.category.id).toBe(ROOT_ID);
    expect(result.category.name).toBe('Electronics');
    expect(result.category.parentId).toBeNull();
    expect(result.category.products).toHaveLength(0); // root has no direct products

    // Depth = 2 levels (root → child → grandchild)
    expect(result.depth).toBe(2);

    // Total products across entire tree = 3
    expect(result.totalProducts).toBe(3);

    // Children
    expect(result.category.children).toHaveLength(2);

    // Laptops child has 1 direct product + 1 in Gaming Laptops
    const laptops = result.category.children.find((c) => c.id === CHILD_A_ID)!;
    expect(laptops).toBeDefined();
    expect(laptops.products).toHaveLength(1);
    expect(laptops.products[0]!.sku).toBe('LAP-001');
    expect(laptops.children).toHaveLength(1);
    expect(laptops.children[0]!.name).toBe('Gaming Laptops');
    expect(laptops.children[0]!.products).toHaveLength(1);
    expect(laptops.children[0]!.products[0]!.sku).toBe('LAP-002');

    // Audio child has 1 product, no children
    const audio = result.category.children.find((c) => c.id === CHILD_B_ID)!;
    expect(audio).toBeDefined();
    expect(audio.products).toHaveLength(1);
    expect(audio.children).toHaveLength(0);

    // Result was cached
    expect(mockRedis.setex).toHaveBeenCalledWith(
      `category:tree:${ROOT_ID}`,
      3600,
      expect.any(String),
    );
  });

  it('returns cached result on cache hit without calling Prisma', async () => {
    const cachedResult = {
      category: {
        id: ROOT_ID,
        name: 'Electronics',
        slug: 'electronics',
        parentId: null,
        children: [],
        products: [],
      },
      totalProducts: 0,
      depth: 0,
    };

    mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

    const service = createService();
    const result = await service.getCategoryTreeWithProducts(ROOT_ID);

    expect(result.totalProducts).toBe(0);
    expect(result.depth).toBe(0);

    // Prisma should NOT have been called
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();

    // No cache write happened
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for non-existent category', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.category.findMany.mockResolvedValue(categories);
    mockPrisma.product.findMany.mockResolvedValue([]);

    const service = createService();
    await expect(
      service.getCategoryTreeWithProducts('non-existent-id'),
    ).rejects.toThrow(NotFoundError);
  });
});

// ════════════════════════════════════════════════════════════
//  DFS — Edge Cases
// ════════════════════════════════════════════════════════════

describe('CategoryService — DFS Edge Cases', () => {
  it('handles a leaf category with no children and no products', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'leaf', name: 'Empty', slug: 'empty', parentId: null },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([]);

    const service = createService();
    const result = await service.getCategoryTreeWithProducts('leaf');

    expect(result.category.children).toHaveLength(0);
    expect(result.category.products).toHaveLength(0);
    expect(result.totalProducts).toBe(0);
    expect(result.depth).toBe(0);
  });

  it('handles a single node with many direct products', async () => {
    const manyProducts = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      name: `Product ${i}`,
      sku: `SKU-${i}`,
      price: 10.99,
      stock: 100,
      categoryId: 'single',
    }));

    mockRedis.get.mockResolvedValue(null);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'single', name: 'Single', slug: 'single', parentId: null },
    ]);
    mockPrisma.product.findMany.mockResolvedValue(manyProducts);

    const service = createService();
    const result = await service.getCategoryTreeWithProducts('single');

    expect(result.category.products).toHaveLength(10);
    expect(result.totalProducts).toBe(10);
    expect(result.depth).toBe(0);
  });

  it('handles deep hierarchy (5 levels)', async () => {
    const deepCats = [];
    for (let i = 0; i < 5; i++) {
      deepCats.push({
        id: `lvl-${i}`,
        name: `Level ${i}`,
        slug: `level-${i}`,
        parentId: i === 0 ? null : `lvl-${i - 1}`,
      });
    }

    mockRedis.get.mockResolvedValue(null);
    mockPrisma.category.findMany.mockResolvedValue(deepCats);
    mockPrisma.product.findMany.mockResolvedValue([]);

    const service = createService();
    const result = await service.getCategoryTreeWithProducts('lvl-0');

    expect(result.depth).toBe(4); // 5 nodes → depth 4
    expect(result.totalProducts).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
//  Cache Invalidation
// ════════════════════════════════════════════════════════════

describe('CategoryService — Cache Invalidation', () => {
  it('invalidates a single category tree by id', async () => {
    mockRedis.del.mockResolvedValue(1);

    const service = createService();
    await service.invalidateCategoryCache(ROOT_ID);

    expect(mockRedis.del).toHaveBeenCalledWith(`category:tree:${ROOT_ID}`);
  });

  it('invalidates all category trees via SCAN', async () => {
    mockRedis.scan
      .mockResolvedValueOnce(['0', ['category:tree:cat-a', 'category:tree:cat-b']]);
    mockRedis.del.mockResolvedValue(2);

    const service = createService();
    await service.invalidateCategoryCache();

    expect(mockRedis.scan).toHaveBeenCalledWith(
      '0', 'MATCH', 'category:tree:*', 'COUNT', 100,
    );
    expect(mockRedis.del).toHaveBeenCalledWith('category:tree:cat-a', 'category:tree:cat-b');
  });

  it('handles empty SCAN result (no keys to delete)', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', []]);

    const service = createService();
    await service.invalidateCategoryCache();

    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});
