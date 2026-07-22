/**
 * Custom application error with HTTP status code and optional context.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context: Record<string, unknown> | undefined;

  constructor(message: string, statusCode: number, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', context?: Record<string, unknown>) {
    super(message, 400, context);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', context?: Record<string, unknown>) {
    super(message, 401, context);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', context?: Record<string, unknown>) {
    super(message, 403, context);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 404, context);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', context?: Record<string, unknown>) {
    super(message, 409, context);
  }
}

/**
 * 422 Unprocessable Entity
 */
export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity', context?: Record<string, unknown>) {
    super(message, 422, context);
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', context?: Record<string, unknown>) {
    super(message, 429, context);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', context?: Record<string, unknown>) {
    super(message, 500, context);
    (this.isOperational as boolean) = false;
  }
}
