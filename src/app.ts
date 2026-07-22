import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';
import { apiRateLimiter } from './common/middleware/rateLimiter';
import { authRouter } from './modules/auth/auth.routes';
import { productRouter } from './modules/products/products.routes';
import { orderRouter } from './modules/orders/orders.routes';
import { paymentRouter } from './modules/payments/payments.routes';

const app = express();

// ─── Security headers ────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
);

// ─── Body parsing ─────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate limiting ────────────────────────────────────
app.use(apiRateLimiter);

// ─── Request logging ──────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ req }, `${req.method} ${req.path}`);
  next();
});

// ─── Health check ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── Module routes ────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);

// ─── Error handling ───────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
