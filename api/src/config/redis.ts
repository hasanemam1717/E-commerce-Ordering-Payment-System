import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Create and configure the Redis client singleton.
 * Eagerly initialized so the client object is always available
 * at import time; connection is established during server startup.
 *
 * Uses lazyConnect: true so no network I/O happens at import time —
 * connectRedis() must be called in the server entry point to establish
 * the actual TCP connection.
 */
function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    retryStrategy: (times: number): number | null => {
      if (times > 10) {
        logger.error('Redis max retries exceeded — giving up');
        return null;
      }
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('ready', () => {
    logger.info('Redis ready');
  });

  client.on('error', (err: Error) => {
    logger.error({ err }, 'Redis connection error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

// Eagerly create the client so it's available at import time.
// lazyConnect ensures no actual connection is attempted here —
// commands are queued internally until connectRedis() is called.
const redis: Redis = createRedisClient();

/**
 * Establish the Redis TCP connection.
 * Safe to call multiple times — redundant calls are no-ops.
 */
export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.error({ err }, 'Redis connection failed');
    throw err;
  }
}

/**
 * Gracefully disconnect from Redis.
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting Redis');
  }
}

export { redis };
