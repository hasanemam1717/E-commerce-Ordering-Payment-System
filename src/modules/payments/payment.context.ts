/**
 * PaymentContext — Strategy dispatcher for payment gateway integrations.
 *
 * Maintains a registry of IPaymentStrategy implementations and delegates
 * calls to the appropriate strategy based on the provider name.
 *
 * The registry is exported so integration tests can swap implementations.
 */
import { logger } from '../../config/logger';
import { UnsupportedProviderError } from './payment.errors';
import { StripePaymentStrategy } from './stripe.strategy';
import { BkashPaymentStrategy } from './bkash.strategy';
import type { IPaymentStrategy } from './payment.strategy';
import type { PaymentProviderName } from './payment.types';

/**
 * Singleton registry mapping provider names → strategy instances.
 * New strategies are registered here.
 * Exported for testability — tests can overwrite entries.
 */
export const STRATEGY_REGISTRY: Record<string, IPaymentStrategy> = {
  STRIPE: new StripePaymentStrategy(),
  BKASH: new BkashPaymentStrategy(),
};

export class PaymentContext {
  /**
   * Resolve the strategy for the given provider.
   * Throws UnsupportedProviderError if not found.
   */
  private static getStrategy(provider: PaymentProviderName): IPaymentStrategy {
    const strategy = STRATEGY_REGISTRY[provider];
    if (!strategy) {
      throw new UnsupportedProviderError(provider);
    }
    return strategy;
  }

  /**
   * Delegate initiatePayment to the correct strategy.
   */
  static async initiatePayment(
    provider: PaymentProviderName,
    orderId: string,
    amount: number,
    metadata?: Record<string, string>,
  ) {
    const strategy = this.getStrategy(provider);
    logger.debug({ provider, orderId }, 'PaymentContext.initiatePayment');
    return strategy.initiatePayment(orderId, amount, metadata);
  }

  /**
   * Delegate verifyPayment to the correct strategy.
   */
  static async verifyPayment(provider: PaymentProviderName, payload: {
    transactionId: string;
    orderId?: string;
    [key: string]: unknown;
  }) {
    const strategy = this.getStrategy(provider);
    logger.debug({ provider, transactionId: payload.transactionId }, 'PaymentContext.verifyPayment');
    return strategy.verifyPayment(payload);
  }

  /**
   * Delegate handleWebhook to the correct strategy.
   */
  static async handleWebhook(
    provider: PaymentProviderName,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    const strategy = this.getStrategy(provider);
    logger.debug({ provider }, 'PaymentContext.handleWebhook');
    return strategy.handleWebhook(headers, rawBody);
  }
}
