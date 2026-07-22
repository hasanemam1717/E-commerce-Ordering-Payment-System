import { AppError } from '../../common/utils/AppError';

/**
 * Thrown when one or more requested products are not found in the database.
 */
export class ProductNotFoundError extends AppError {
  constructor(productIds: string[]) {
    super(
      `Products not found: ${productIds.join(', ')}`,
      404,
      { productIds },
    );
  }
}

/**
 * Thrown when a product exists but its status is not ACTIVE.
 */
export class ProductNotActiveError extends AppError {
  constructor(productId: string, status: string) {
    super(
      `Product '${productId}' is not active (current status: ${status})`,
      422,
      { productId, status },
    );
  }
}

/**
 * Thrown when a product's available stock is insufficient for the requested quantity.
 */
export class InsufficientStockError extends AppError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product '${productId}': requested ${requested}, available ${available}`,
      409,
      { productId, requested, available },
    );
  }
}

/**
 * Thrown when the user referenced in the order does not exist.
 */
export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User '${userId}' not found`, 404, { userId });
  }
}

/**
 * Thrown when the order has an invalid state transition.
 */
export class InvalidOrderStateError extends AppError {
  constructor(orderId: string, currentStatus: string, attemptedAction: string) {
    super(
      `Cannot ${attemptedAction} on order '${orderId}' in status '${currentStatus}'`,
      422,
      { orderId, currentStatus, attemptedAction },
    );
  }
}
