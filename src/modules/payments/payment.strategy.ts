import type {
  InitiatePaymentResult,
  VerifyPaymentPayload,
  VerifyPaymentResult,
  WebhookResult,
} from './payment.types';

/**
 * IPaymentStrategy — Strategy interface for payment gateway integrations.
 *
 * Each concrete strategy implements the contract for a specific provider
 * (Stripe, bKash, etc.). This enables polymorphic dispatch via PaymentContext.
 */
export interface IPaymentStrategy {
  /**
   * Initiate a payment with the provider.
   * @param orderId - Internal order identifier
   * @param amount  - Amount in major currency units (e.g. USD 19.99)
   * @param metadata - Optional key-value metadata to attach
   * @returns URL for client redirect + provider transaction ID
   */
  initiatePayment(
    orderId: string,
    amount: number,
    metadata?: Record<string, string>,
  ): Promise<InitiatePaymentResult>;

  /**
   * Verify the status of a previously initiated payment.
   * @param payload - Contains transactionId and optional orderId
   * @returns Success flag + raw provider response
   */
  verifyPayment(payload: VerifyPaymentPayload): Promise<VerifyPaymentResult>;

  /**
   * Handle an incoming webhook event from the provider.
   * @param headers - Incoming request headers
   * @param rawBody - Raw request body as Buffer
   * @returns Parsed webhook result
   */
  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult>;
}
