/**
 * WebhookController — Production-grade webhook handlers for Stripe and bKash.
 *
 * Security:
 *   Stripe   → Cryptographic signature verification via stripe.webhooks.constructEvent
 *   bKash    → x-app-key header validation against configured app key
 *
 * Idempotency:
 *   Every event is deduplicated via Redis SETNX before processing.
 *   Duplicates are acknowledged (200) but silently skipped.
 *
 * Always returns HTTP 200/202 to the gateway so it stops retrying,
 * regardless of processing outcome. Errors are logged comprehensively
 * for offline investigation.
 */
import Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import { PaymentContext } from './payment.context';
import { PaymentService } from './payment.service';
import { WebhookIdempotencyService } from './webhook.idempotency';

// ─── Stripe client (lazily initialized) ──────────────────
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      maxNetworkRetries: 3,
    });
  }
  return stripeClient;
}

export class WebhookController {
  private readonly idempotency: WebhookIdempotencyService;

  constructor(private readonly paymentService: PaymentService) {
    this.idempotency = new WebhookIdempotencyService(redis);
  }

  // ════════════════════════════════════════════════════════════
  //  Stripe Webhook
  // ════════════════════════════════════════════════════════════

  /**
   * Handle an incoming Stripe webhook.
   *
   * Flow:
   *   1. Verify cryptographic signature (throws — caught below)
   *   2. Extract event ID for idempotency
   *   3. Check Redis SETNX — skip if already processed
   *   4. Delegate to PaymentService for stock reduction
   *   5. Always return 200 to stop gateway retries
   */
  async handleStripeWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    // ── 1. Verify Stripe signature ──────────────────────
    if (!signatureHeader) {
      logger.error('Stripe webhook missing stripe-signature header');
      return { statusCode: 200, body: { received: true } };
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET is not configured — cannot verify webhook');
      return { statusCode: 200, body: { received: true } };
    }

    let event: Stripe.Event;
    try {
      event = getStripeClient().webhooks.constructEvent(
        rawBody,
        signatureHeader,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      // Still return 200 to prevent retry bombardment
      return { statusCode: 200, body: { received: true } };
    }

    const eventId = event.id;
    const eventType = event.type;

    // ── 2. Idempotency check ────────────────────────────
    const isNew = await this.idempotency.tryAcquireLock('STRIPE', eventId);
    if (!isNew) {
      logger.info({ eventId, eventType }, 'Duplicate Stripe webhook — skipped');
      return { statusCode: 200, body: { received: true } };
    }

    logger.info({ eventId, eventType, id: event.id }, 'Processing Stripe webhook');

    // ── 3. Route by event type ──────────────────────────
    try {
      switch (eventType) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const transactionId = paymentIntent.id;
          const orderId = paymentIntent.metadata?.['order_id'] ?? '';

          if (!orderId) {
            logger.warn(
              { transactionId },
              'Stripe payment_intent.succeeded missing order_id metadata',
            );
            break;
          }

          await this.paymentService.handlePaymentSuccess(
            transactionId,
            'STRIPE',
            paymentIntent as unknown as Record<string, unknown>,
          );

          logger.info(
            { transactionId, orderId, eventId },
            'Stripe payment_intent.succeeded processed with stock reduction',
          );
          break;
        }

        case 'payment_intent.payment_failed': {
          const failedIntent = event.data.object as Stripe.PaymentIntent;
          logger.warn(
            { transactionId: failedIntent.id, lastPaymentError: failedIntent.last_payment_error },
            'Stripe payment_intent.payment_failed received',
          );
          break;
        }

        default:
          logger.debug({ eventType, eventId }, 'Unhandled Stripe event type (acknowledged)');
      }
    } catch (err) {
      // Log the error but DO NOT return 5xx — gateway would retry
      logger.error({ err, eventId, eventType }, 'Error processing Stripe webhook event');
    }

    return { statusCode: 200, body: { received: true } };
  }

  // ════════════════════════════════════════════════════════════
  //  bKash Webhook
  // ════════════════════════════════════════════════════════════

  /**
   * Handle an incoming bKash webhook (callback notification).
   *
   * bKash sends a POST to the merchant's callback URL with a JSON body
   * containing paymentID, trxID, transactionStatus, etc.
   *
   * Security:
   *   Validate the x-app-key header matches our configured app key.
   *   (bKash's sandbox does not sign payloads — this is the primary check.)
   *
   * Idempotency:
   *   Use paymentID as the event identifier for SETNX dedup.
   */
  async handleBkashWebhook(
    rawBody: Buffer,
    appKeyHeader: string | undefined,
  ): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    // ── 1. Parse body ───────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
    } catch (err) {
      logger.error({ err }, 'bKash webhook — invalid JSON body');
      return { statusCode: 200, body: { received: true } };
    }

    // ── 2. Validate x-app-key header ────────────────────
    const expectedAppKey = env.BKASH_APP_KEY;
    if (expectedAppKey && appKeyHeader !== expectedAppKey) {
      logger.error(
        { received: appKeyHeader, expected: expectedAppKey },
        'bKash webhook — x-app-key mismatch',
      );
      return { statusCode: 200, body: { received: true } };
    }

    const paymentID = (body['paymentID'] as string) ?? '';
    const trxID = (body['trxID'] as string) ?? '';
    const status = (body['status'] as string) ?? (body['transactionStatus'] as string) ?? '';
    const succeeded = status === 'Completed' || status === 'success';

    // Use paymentID as the idempotency key
    const eventId = paymentID || trxID || `bkash-${Date.now()}`;

    // ── 3. Idempotency check ────────────────────────────
    const isNew = await this.idempotency.tryAcquireLock('BKASH', eventId);
    if (!isNew) {
      logger.info({ eventId, paymentID, trxID }, 'Duplicate bKash webhook — skipped');
      return { statusCode: 200, body: { received: true } };
    }

    logger.info({ paymentID, trxID, status, eventId }, 'Processing bKash webhook');

    if (!succeeded) {
      logger.info(
        { paymentID, trxID, status },
        'bKash webhook — payment not successful, no action needed',
      );
      return { statusCode: 200, body: { received: true } };
    }

    // ── 4. Extract orderId from payerReference or merchantInvoiceNumber ──
    // Fall back to parsing the entire body via the strategy for consistency
    try {
      const webhookResult = await PaymentContext.handleWebhook(
        'BKASH',
        { 'x-app-key': appKeyHeader } as Record<string, string | string[] | undefined>,
        rawBody,
      );

      if (webhookResult.success && webhookResult.orderId) {
        await this.paymentService.handlePaymentSuccess(
          webhookResult.transactionId,
          'BKASH',
          webhookResult.rawResponse,
        );

        logger.info(
          {
            transactionId: webhookResult.transactionId,
            orderId: webhookResult.orderId,
            paymentID,
          },
          'bKash webhook processed with stock reduction',
        );
      } else {
        logger.info(
          { paymentID, status },
          'bKash webhook — payment not successful, no stock reduction',
        );
      }
    } catch (err) {
      logger.error({ err, paymentID, trxID }, 'Error processing bKash webhook event');
    }

    return { statusCode: 200, body: { received: true } };
  }
}
