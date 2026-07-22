import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that captures the raw request body as a Buffer.
 * Must be registered BEFORE express.json() for the webhook route.
 * Attaches the raw body to `req.rawBody` so Stripe signature
 * verification can access the unmodified payload.
 */
export function rawBodyCapture(req: Request, _res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
}
