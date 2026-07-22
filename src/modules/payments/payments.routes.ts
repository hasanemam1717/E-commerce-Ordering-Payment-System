import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { PaymentService } from './payment.service';

const paymentService = new PaymentService(prisma);

/**
 * Webhook router — MUST be mounted before express.json()
 * in app.ts because Stripe needs the raw body for signature verification.
 */
export const webhookRouter = Router();

// POST /api/payments/webhook/stripe
webhookRouter.post(
  '/stripe',
  asyncHandler(async (req, res) => {
    const rawBody = (req as import('express').Request & { rawBody: Buffer }).rawBody;
    await paymentService.handleWebhook('STRIPE', req.headers as Record<string, string | string[]>, rawBody);
    res.json({ received: true });
  }),
);

// POST /api/payments/webhook/bkash
webhookRouter.post(
  '/bkash',
  asyncHandler(async (req, res) => {
    const rawBody = (req as import('express').Request & { rawBody: Buffer }).rawBody;
    await paymentService.handleWebhook('BKASH', req.headers as Record<string, string | string[]>, rawBody);
    res.json({ received: true });
  }),
);

/**
 * Main payment router.
 */
export const paymentRouter = Router();

// POST /api/payments/initiate
paymentRouter.post(
  '/initiate',
  asyncHandler(async (req, res) => {
    const { orderId, provider } = req.body;
    const result = await paymentService.initiatePayment(orderId, provider);
    res.json(result);
  }),
);

// POST /api/payments/confirm
paymentRouter.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const { provider, transactionId, orderId } = req.body;
    const result = await paymentService.confirmPayment(provider, transactionId, orderId);
    res.json(result);
  }),
);

// GET /api/payments/:id
paymentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const paymentId = req.params['id'] as string;
    const payment = await paymentService.getPayment(paymentId);
    res.json(payment);
  }),
);
