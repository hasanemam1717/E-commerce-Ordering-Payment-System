import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { OrderService } from './order.service';

const orderService = new OrderService(prisma);
export const orderRouter = Router();

// GET /api/orders
orderRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // TODO: Implement list orders
    res.json({ message: 'List orders endpoint' });
  }),
);

// GET /api/orders/:id
orderRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement get order by ID
    res.json({ message: `Get order ${req.params['id']}` });
  }),
);

// POST /api/orders
orderRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId, items } = req.body;
    const order = await orderService.createOrder({ userId, items });
    res.status(201).json(order);
  }),
);

// PATCH /api/orders/:id/status
orderRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    // TODO: Implement update order status
    res.json({ message: `Update order ${req.params['id']} status` });
  }),
);

// DELETE /api/orders/:id
orderRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement cancel order
    res.json({ message: `Cancel order ${req.params['id']}` });
  }),
);
