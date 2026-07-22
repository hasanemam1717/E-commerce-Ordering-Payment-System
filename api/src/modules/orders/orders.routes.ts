import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { authMiddleware, adminMiddleware } from '../../common/middleware/auth';
import { prisma } from '../../config/prisma';
import { OrderService } from './order.service';
import { listOrdersQuerySchema, updateOrderStatusSchema } from './order.validation';

const orderService = new OrderService(prisma);
export const orderRouter = Router();

// ════════════════════════════════════════════════════════════
//  Protected Routes (auth required)
// ════════════════════════════════════════════════════════════

// GET /api/orders — list current user's orders with pagination
orderRouter.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const parsed = listOrdersQuerySchema.safeParse(req.query);

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

    const result = await orderService.listUserOrders(userId, parsed.data);
    res.json(result);
  }),
);

// GET /api/orders/:id — get order detail with ownership check
orderRouter.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = req.params['id'] as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const order = await orderService.getOrderById(orderId, userId, userRole);
    res.json(order);
  }),
);

// POST /api/orders — create order for the authenticated user
orderRouter.post(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { items } = req.body;
    const order = await orderService.createOrder({ userId, items });
    res.status(201).json(order);
  }),
);

// ════════════════════════════════════════════════════════════
//  Admin Routes
// ════════════════════════════════════════════════════════════

// PATCH /api/orders/:id/status — update order status (Admin only)
orderRouter.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = req.params['id'] as string;

    const parsed = updateOrderStatusSchema.safeParse(req.body);
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

    const order = await orderService.updateStatus(orderId, parsed.data);
    res.json(order);
  }),
);

// DELETE /api/orders/:id — cancel order (owner or admin)
orderRouter.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orderId = req.params['id'] as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    await orderService.cancelOrder(orderId, userId, userRole);
    res.json({ message: `Order '${orderId}' has been canceled` });
  }),
);
