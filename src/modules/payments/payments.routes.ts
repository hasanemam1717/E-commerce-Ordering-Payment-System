import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { PaymentService } from './payment.service';
import { WebhookController } from './webhook.controller';

const paymentService = new PaymentService(prisma);
const webhookController = new WebhookController(paymentService);

/**
 * Webhook router — MUST be mounted before express.json()
 * in app.ts because Stripe needs the raw body for signature verification.
 *
 * These handlers ALWAYS return 200 to prevent gateway retries.
 * They do NOT use asyncHandler — errors are caught internally.
 */
export const webhookRouter = Router();

// POST /api/payments/webhook/stripe
webhookRouter.post('/stripe', async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
  const signatureHeader = req.headers['stripe-signature'] as string | undefined;

  const result = await webhookController.handleStripeWebhook(rawBody, signatureHeader);
  res.status(result.statusCode).json(result.body);
});

// POST /api/payments/webhook/bkash
webhookRouter.post('/bkash', async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
  const appKeyHeader = req.headers['x-app-key'] as string | undefined;

  const result = await webhookController.handleBkashWebhook(rawBody, appKeyHeader);
  res.status(result.statusCode).json(result.body);
});

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
