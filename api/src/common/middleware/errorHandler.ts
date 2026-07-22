import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../../config/logger';
import { AppError } from '../utils/AppError';

/**
 * Wraps async route handlers to catch rejected promises
 * and forward them to Express error middleware.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Centralized error-handling middleware.
 * Catches AppError instances (operational) and unexpected errors.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn({ err, statusCode: err.statusCode, context: err.context }, err.message);

    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.context && { context: err.context }),
    });
    return;
  }

  // Unexpected / programming errors
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}

/**
 * Handles 404 for unknown routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    message: `Route not found`,
  });
}
