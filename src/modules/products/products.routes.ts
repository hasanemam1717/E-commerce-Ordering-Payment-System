import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { authMiddleware, adminMiddleware } from '../../common/middleware/auth';
import { prisma } from '../../config/prisma';
import { ProductService } from './product.service';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from './product.validation';

const productService = new ProductService(prisma);
export const productRouter = Router();

// ════════════════════════════════════════════════════════════
//  Public Routes
// ════════════════════════════════════════════════════════════

// GET /api/products — list with pagination, search, filters
productRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listProductsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid query parameters',
        errors: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const result = await productService.list(parsed.data);
    res.json(result);
  }),
);

// GET /api/products/:id — get single product
productRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params['id'] as string;
    const product = await productService.getById(id);
    res.json(product);
  }),
);

// ════════════════════════════════════════════════════════════
//  Protected Routes (Admin only)
// ════════════════════════════════════════════════════════════

// POST /api/products — create product (Admin)
productRouter.post(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const product = await productService.create(parsed.data);
    res.status(201).json(product);
  }),
);

// PATCH /api/products/:id — update product (Admin)
productRouter.patch(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const id = req.params['id'] as string;

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const product = await productService.update(id, parsed.data);
    res.json(product);
  }),
);

// DELETE /api/products/:id — soft-delete product (Admin)
productRouter.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const id = req.params['id'] as string;
    await productService.delete(id);
    res.json({ message: `Product '${id}' has been deactivated` });
  }),
);

