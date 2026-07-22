import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { connectRedis, disconnectRedis } from './config/redis';

async function main(): Promise<void> {
  // ─── Database connection ──────────────────────────
  await connectDatabase();

  // ─── Redis connection ──────────────────────────────
  await connectRedis();

  // ─── Start server ─────────────────────────────────
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`🚀 Server running at http://${env.HOST}:${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // ─── Graceful shutdown ────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('Server shut down complete');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});
