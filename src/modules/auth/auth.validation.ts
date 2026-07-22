import { z } from 'zod';

/** Validate POST /auth/register body */
export const registerSchema = z
  .object({
    email: z.string().email('Invalid email format').max(255, 'Email must be under 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be under 128 characters'),
  })
  .strict();

/** Validate POST /auth/login body */
export const loginSchema = z
  .object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

/** Inferred types */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
