import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post(
  '/register',
  asyncHandler(async (_req, res) => {
    // TODO: Implement registration logic
    res.status(201).json({ message: 'Register endpoint' });
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (_req, res) => {
    // TODO: Implement login logic
    res.json({ message: 'Login endpoint' });
  }),
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    // TODO: Implement logout logic
    res.json({ message: 'Logout endpoint' });
  }),
);

// POST /api/auth/refresh
authRouter.post(
  '/refresh',
  asyncHandler(async (_req, res) => {
    // TODO: Implement token refresh logic
    res.json({ message: 'Refresh token endpoint' });
  }),
);
