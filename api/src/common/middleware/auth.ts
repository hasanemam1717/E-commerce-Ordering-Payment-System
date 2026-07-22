import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError, ForbiddenError } from '../../common/utils/AppError';
import type { JwtPayload } from '../../modules/auth/auth.types';

/**
 * Auth middleware — extracts and verifies the Bearer JWT token.
 *
 * On success, attaches `req.user` with `{ userId, role }`.
 * On failure, throws appropriate AppError (caught by errorHandler).
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError('Invalid Authorization format. Use: Bearer <token>');
  }

  const token = parts[1]!;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded.userId || !decoded.role) {
      throw new UnauthorizedError('Invalid token payload');
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }

    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired');
    }

    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }

    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Admin middleware — ensures the authenticated user has ADMIN role.
 * MUST be used AFTER authMiddleware.
 */
export function adminMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  // authMiddleware should have attached req.user
  if (!_req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (_req.user.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }

  next();
}
