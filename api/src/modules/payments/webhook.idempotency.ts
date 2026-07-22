/**
 * WebhookIdempotencyService — Redis-backed idempotency layer for payment webhooks.
 *
 * Prevents duplicate processing of the same webhook event using Redis SETNX.
 * Stripe can retry webhooks for up to 3 days; bKash may resend on timeout.
 * We hold the idempotency lock for 24 hours (86_400 seconds) to cover the
 * full retry window while keeping Redis memory bounded.
 *
 * Thread-safety:
 *   Redis SETNX is atomic — only one consumer acquires the lock per event ID.
 *   Other concurrent attempts are silently skipped (idempotent).
 */
import Redis from 'ioredis';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';

const IDEMPOTENCY_PREFIX = 'webhook:idempotency:';
const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

export class WebhookIdempotencyService {
  constructor(private readonly client: Redis = redis) {}

  /**
   * Build the Redis key for a given provider + eventId pair.
   */
  private buildKey(provider: string, eventId: string): string {
    return `${IDEMPOTENCY_PREFIX}${provider}:${eventId}`;
  }

  /**
   * Attempt to claim the idempotency lock for a webhook event.
   *
   * @returns `true` if this is the first time this event is being processed
   *          (lock acquired). `false` if the event was already processed
   *          (or is currently being processed by another consumer).
   */
  async tryAcquireLock(provider: string, eventId: string): Promise<boolean> {
    const key = this.buildKey(provider, eventId);

    try {
      // SETNX returns 1 if the key was set, 0 if it already existed
      const result = await this.client.setnx(key, String(Date.now()));

      if (result === 1) {
        // First time seeing this event — set TTL so Redis auto-evicts
        await this.client.expire(key, IDEMPOTENCY_TTL_SECONDS);
        logger.debug({ provider, eventId }, 'Idempotency lock acquired');
        return true;
      }

      logger.debug({ provider, eventId }, 'Idempotency lock already held — skipping duplicate');
      return false;
    } catch (err) {
      // If Redis is down, log and allow processing (fail open)
      logger.error({ err, provider, eventId }, 'Idempotency check failed — allowing processing');
      return true;
    }
  }

  /**
   * Release the idempotency lock early (optional — normally TTL handles this).
   * Useful for testing or manual remediation.
   */
  async releaseLock(provider: string, eventId: string): Promise<void> {
    const key = this.buildKey(provider, eventId);

    try {
      await this.client.del(key);
      logger.debug({ provider, eventId }, 'Idempotency lock released');
    } catch (err) {
      logger.error({ err, provider, eventId }, 'Failed to release idempotency lock');
    }
  }
}
