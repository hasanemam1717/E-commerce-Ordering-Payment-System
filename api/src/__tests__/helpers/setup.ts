process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '1000';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '900000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
process.env.REDIS_URL =
  process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://ecommerce_user:ecommerce_password@127.0.0.1:55432/ecommerce_db?schema=public';

import { beforeAll, afterEach, afterAll } from '@jest/globals';

const { connectDatabase, disconnectDatabase, prisma } = require('../../config/prisma') as {
  connectDatabase: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
  prisma: {
    $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
    $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
  };
};
const { connectRedis, disconnectRedis, redis } = require('../../config/redis') as {
  connectRedis: () => Promise<void>;
  disconnectRedis: () => Promise<void>;
  redis: { flushdb: () => Promise<string> };
};

export const testPrisma = prisma;
export const testRedis = redis;

async function resetDatabase(): Promise<void> {
  const tables = ['payments', 'order_items', 'orders', 'products', 'categories', 'users'];

  await prisma.$transaction(
    async (tx: { $executeRawUnsafe: (query: string) => Promise<number> }) => {
      for (const table of tables) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      }
    },
  );
}

export async function resetTestState(): Promise<void> {
  await resetDatabase();
  await redis.flushdb();
}

beforeAll(async () => {
  await connectDatabase();
  await connectRedis();
  await resetTestState();
});

afterEach(async () => {
  await resetTestState();
});

afterAll(async () => {
  await resetTestState();
  await disconnectDatabase();
  await disconnectRedis();
});
