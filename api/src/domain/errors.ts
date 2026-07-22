import { BadRequestError } from '../common/utils/AppError';

export class InsufficientStockError extends BadRequestError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product '${productId}'. Requested: ${requested}, available: ${available}`,
      {
        productId,
        requested,
        available,
      },
    );
  }
}

export class InvalidOrderStateError extends BadRequestError {
  constructor(orderId: string, currentStatus: string, attemptedTransition: string) {
    super(
      `Cannot transition order '${orderId}' from '${currentStatus}' to '${attemptedTransition}'`,
      {
        orderId,
        currentStatus,
        attemptedTransition,
      },
    );
  }
}

export class InvalidPriceError extends BadRequestError {
  constructor(price: number) {
    super(`Invalid price '${price}'. Price must be greater than zero`, { price });
  }
}

export class InvalidPaymentStateError extends BadRequestError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class InvalidPaymentAmountError extends BadRequestError {
  constructor(expected: number, actual: number) {
    super(`Payment amount mismatch. Expected ${expected}, received ${actual}`, {
      expected,
      actual,
    });
  }
}
