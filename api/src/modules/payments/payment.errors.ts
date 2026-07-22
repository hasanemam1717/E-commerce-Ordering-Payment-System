import { AppError } from '../../common/utils/AppError';

/**
 * Thrown when the payment provider is not supported.
 */
export class UnsupportedProviderError extends AppError {
  constructor(provider: string) {
    super(`Unsupported payment provider: '${provider}'`, 400, { provider });
  }
}

/**
 * Thrown when a payment record is not found.
 */
export class PaymentNotFoundError extends AppError {
  constructor(paymentId: string) {
    super(`Payment '${paymentId}' not found`, 404, { paymentId });
  }
}

/**
 * Thrown when payment verification fails.
 */
export class PaymentVerificationError extends AppError {
  constructor(transactionId: string, reason: string) {
    super(
      `Payment verification failed for transaction '${transactionId}': ${reason}`,
      402,
      { transactionId, reason },
    );
  }
}

/**
 * Thrown when the Stripe webhook signature is invalid or missing configuration.
 */
export class WebhookSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature') {
    super(message, 401);
  }
}

/**
 * Thrown when the order is not in a payable state.
 */
export class InvalidPaymentStateError extends AppError {
  constructor(orderId: string, status: string) {
    super(
      `Order '${orderId}' is in status '${status}' and cannot be paid`,
      422,
      { orderId, status },
    );
  }
}

/**
 * Thrown when the bKash token exchange fails.
 */
export class BkashTokenError extends AppError {
  constructor(message: string) {
    super(`bKash token error: ${message}`, 502);
  }
}

/**
 * Thrown when a bKash API call returns an error.
 */
export class BkashApiError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(`bKash API error: ${message}`, statusCode);
  }
}
