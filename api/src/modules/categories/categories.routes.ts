import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { CategoryService } from './category.service';

const categoryService = new CategoryService(prisma, redis);
export const categoryRouter = Router();

// GET /api/categories/:id/tree
// Returns the full category sub-tree with nested children and active products
categoryRouter.get(
  '/:id/tree',
  asyncHandler(async (req, res) => {
    const categoryId = req.params['id'] as string;
    const tree = await categoryService.getCategoryTreeWithProducts(categoryId);
    res.json(tree);
  }),
);

// DELETE /api/categories/cache
// DELETE /api/categories/cache?categoryId=<id>
// Invalidate category tree cache (admin/maintenance endpoint)
categoryRouter.delete(
  '/cache',
  asyncHandler(async (req, res) => {
    const categoryId = req.query['categoryId'] as string | undefined;
    await categoryService.invalidateCategoryCache(categoryId);
    res.json({
      message: categoryId
        ? `Cache invalidated for category '${categoryId}'`
        : 'All category tree caches invalidated',
    });
  }),
);
