import { BadRequestError } from '../../common/utils/AppError';
import { InvalidPaymentAmountError, InvalidPaymentStateError } from '../errors';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  STRIPE = 'STRIPE',
  BKASH = 'BKASH',
}

export interface PaymentProps {
  id: string;
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  status?: PaymentStatus;
  transactionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  private readonly _id: string;
  private readonly _orderId: string;
  private readonly _amountCents: number;
  private readonly _method: PaymentMethod;
  private _status: PaymentStatus;
  private _transactionId: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: PaymentProps) {
    this._id = this.ensureNonEmpty(props.id, 'Payment id');
    this._orderId = this.ensureNonEmpty(props.orderId, 'Order id');
    this._amountCents = this.validateAmount(props.amountCents);
    this._method = props.method;
    this._status = props.status ?? PaymentStatus.PENDING;
    this._transactionId = props.transactionId ?? null;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? this._createdAt;
  }

  public get id(): string {
    return this._id;
  }

  public get orderId(): string {
    return this._orderId;
  }

  public get amountCents(): number {
    return this._amountCents;
  }

  public get method(): PaymentMethod {
    return this._method;
  }

  public get status(): PaymentStatus {
    return this._status;
  }

  public get transactionId(): string | null {
    return this._transactionId;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public markAsPaid(transactionId?: string): void {
    if (this._status === PaymentStatus.SUCCEEDED) {
      return;
    }

    if (this._status === PaymentStatus.FAILED) {
      throw new InvalidPaymentStateError('Cannot mark a failed payment as paid');
    }

    this._status = PaymentStatus.SUCCEEDED;
    this._transactionId = transactionId ?? this._transactionId;
    this._updatedAt = new Date();
  }

  public markAsFailed(): void {
    if (this._status === PaymentStatus.SUCCEEDED) {
      throw new InvalidPaymentStateError('Cannot fail a payment that has already succeeded');
    }

    this._status = PaymentStatus.FAILED;
    this._updatedAt = new Date();
  }

  public verifyAmount(expectedAmountCents: number): void {
    const normalizedExpected = this.validateAmount(expectedAmountCents);
    if (normalizedExpected !== this._amountCents) {
      throw new InvalidPaymentAmountError(normalizedExpected, this._amountCents);
    }
  }

  private validateAmount(amountCents: number): number {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new BadRequestError('Payment amount must be a non-negative integer');
    }
    return amountCents;
  }

  private ensureNonEmpty(value: string, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestError(`${fieldName} must not be empty`);
    }
    return value;
  }
}
