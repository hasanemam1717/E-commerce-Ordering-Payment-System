/** Supported payment providers */
export type PaymentProviderName = 'STRIPE' | 'BKASH';

/** Result of initiating a payment */
export interface InitiatePaymentResult {
  paymentUrl: string;
  transactionId: string;
  /** Extra provider-specific data (e.g. Stripe client_secret) */
  metadata?: Record<string, string>;
}

/** Payload passed to verifyPayment */
export interface VerifyPaymentPayload {
  transactionId: string;
  orderId?: string;
  [key: string]: unknown;
}

/** Result of a payment verification */
export interface VerifyPaymentResult {
  success: boolean;
  transactionId: string;
  rawResponse: Record<string, unknown>;
}

/** Result of a webhook handling call */
export interface WebhookResult {
  eventType: string;
  transactionId: string;
  orderId: string;
  success: boolean;
  rawResponse: Record<string, unknown>;
}

/** Create payment record input */
export interface CreatePaymentRecordInput {
  orderId: string;
  provider: PaymentProviderName;
  transactionId: string;
}

/** Payment initiation request from client */
export interface InitiatePaymentRequest {
  orderId: string;
  provider: PaymentProviderName;
}

/** Item snapshot used during stock reduction */
export interface OrderItemSnapshot {
  productId: string;
  quantity: number;
}

/** Response DTO for initiate-payment */
export interface InitiatePaymentResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  metadata?: Record<string, string>;
}
