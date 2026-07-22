/**
 * StripePaymentStrategy — Concrete implementation of IPaymentStrategy
 * using the official Stripe Node.js SDK.
 *
 * - initiatePayment: creates a PaymentIntent and returns client_secret
 * - verifyPayment: retrieves the PaymentIntent and checks status
 * - handleWebhook: verifies the Stripe-Signature header and parses the event
 */
import Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { WebhookSignatureError, PaymentVerificationError } from './payment.errors';
import type { IPaymentStrategy } from './payment.strategy';
import type {
  InitiatePaymentResult,
  VerifyPaymentPayload,
  VerifyPaymentResult,
  WebhookResult,
} from './payment.types';

export class StripePaymentStrategy implements IPaymentStrategy {
  private readonly stripe: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not set — Stripe strategy will fail at runtime');
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      maxNetworkRetries: 3,
    });
  }

  async initiatePayment(
    orderId: string,
    amount: number,
    metadata?: Record<string, string>,
  ): Promise<InitiatePaymentResult> {
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        order_id: orderId,
        ...metadata,
      },
      automatic_payment_methods: { enabled: true },
    });

    logger.info(
      { orderId, transactionId: paymentIntent.id },
      'Stripe PaymentIntent created',
    );

    return {
      paymentUrl: '', // Stripe uses client_secret on the frontend, not a redirect URL
      transactionId: paymentIntent.id,
      metadata: {
        client_secret: paymentIntent.client_secret ?? '',
        payment_intent_id: paymentIntent.id,
      },
    };
  }

  async verifyPayment(payload: VerifyPaymentPayload): Promise<VerifyPaymentResult> {
    const { transactionId } = payload;

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

      const succeeded = paymentIntent.status === 'succeeded';

      return {
        success: succeeded,
        transactionId,
        rawResponse: paymentIntent as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new PaymentVerificationError(transactionId, message);
    }
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult> {
    const signatureHeader = headers['stripe-signature'] as string | undefined;

    if (!signatureHeader) {
      throw new WebhookSignatureError();
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new WebhookSignatureError('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      throw new WebhookSignatureError();
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const succeeded = paymentIntent.status === 'succeeded';
    const orderId = paymentIntent.metadata?.['order_id'] ?? '';

    logger.info(
      { eventType: event.type, transactionId: paymentIntent.id, orderId, succeeded },
      'Stripe webhook processed',
    );

    return {
      eventType: event.type,
      transactionId: paymentIntent.id,
      orderId,
      success: succeeded,
      rawResponse: event as unknown as Record<string, unknown>,
    };
  }
}
