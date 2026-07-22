import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().positive().int().default(100),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // bKash
  BKASH_BASE_URL: z.string().url().optional(),
  BKASH_APP_KEY: z.string().optional(),
  BKASH_APP_SECRET: z.string().optional(),
  BKASH_USERNAME: z.string().optional(),
  BKASH_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('change-me-to-a-real-secret-in-production'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  /** Computed: JWT_ACCESS_EXPIRES_IN converted to seconds for jwt.sign */
  JWT_ACCESS_EXPIRES_SECONDS: z.string().default('15m').transform(parseTimeToSeconds),
});

/** Convert a human-readable time string (e.g. '15m', '1h', '7d') to seconds */
function parseTimeToSeconds(value: string): number {
  const match = value.match(/^(\d+)\s*(s|m|h|d)\s*$/);
  if (!match) return 900; // fallback 15 min
  const num = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 900;
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = z.infer<typeof envSchema>;
