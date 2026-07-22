import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.validation';

const authService = new AuthService(prisma);
export const authRouter = Router();

// POST /api/auth/register
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    // Validate body with Zod
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ status: 'error', message: 'Validation failed', errors });
      return;
    }

    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    // Validate body with Zod
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ status: 'error', message: 'Validation failed', errors });
      return;
    }

    const result = await authService.login(parsed.data);
    res.json(result);
  }),
);
