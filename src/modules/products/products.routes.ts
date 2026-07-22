import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';

export const productRouter = Router();

// GET /api/products
productRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // TODO: Implement list products
    res.json({ message: 'List products endpoint' });
  }),
);

// GET /api/products/:id
productRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement get product by ID
    res.json({ message: `Get product ${req.params['id']}` });
  }),
);

// POST /api/products
productRouter.post(
  '/',
  asyncHandler(async (_req, res) => {
    // TODO: Implement create product
    res.status(201).json({ message: 'Create product endpoint' });
  }),
);

// PATCH /api/products/:id
productRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement update product
    res.json({ message: `Update product ${req.params['id']}` });
  }),
);

// DELETE /api/products/:id
productRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement delete product
    res.json({ message: `Delete product ${req.params['id']}` });
  }),
);
