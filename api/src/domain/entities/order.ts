import { BadRequestError } from '../../common/utils/AppError';
import { InvalidOrderStateError } from '../errors';

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'CANCELED';

export interface OrderItemData {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderProps {
  id: string;
  userId: string;
  items: OrderItemData[];
  status?: OrderStatus;
  discountPercent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Order {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _items: OrderItemData[];
  private _status: OrderStatus;
  private _discountPercent: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: OrderProps) {
    this._id = this.ensureNonEmpty(props.id, 'Order id');
    this._userId = this.ensureNonEmpty(props.userId, 'User id');
    this._items = props.items.map((item) => this.normalizeItem(item));
    this._status = props.status ?? 'PENDING';
    this._discountPercent = this.validateDiscount(props.discountPercent ?? 0);
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? this._createdAt;
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get status(): OrderStatus {
    return this._status;
  }

  public get items(): OrderItemData[] {
    return [...this._items];
  }

  public get discountPercent(): number {
    return this._discountPercent;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public calculateTotal(): number {
    const subtotal = this._items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discounted = subtotal * (1 - this._discountPercent / 100);
    return Number(discounted.toFixed(2));
  }

  public canBeCancelled(): boolean {
    return this._status === 'PENDING' || this._status === 'PROCESSING';
  }

  public applyDiscount(percent: number): void {
    this._discountPercent = this.validateDiscount(percent);
    this._updatedAt = new Date();
  }

  public transitionToProcessing(): void {
    this.transitionTo('PROCESSING', ['PENDING']);
  }

  public transitionToPaid(): void {
    this.transitionTo('PAID', ['PROCESSING', 'PENDING']);
  }

  public cancel(): void {
    if (!this.canBeCancelled()) {
      throw new InvalidOrderStateError(this._id, this._status, 'CANCELED');
    }

    this._status = 'CANCELED';
    this._updatedAt = new Date();
  }

  private transitionTo(nextStatus: OrderStatus, allowedFrom: OrderStatus[]): void {
    if (!allowedFrom.includes(this._status)) {
      throw new InvalidOrderStateError(this._id, this._status, nextStatus);
    }

    this._status = nextStatus;
    this._updatedAt = new Date();
  }

  private normalizeItem(item: OrderItemData): OrderItemData {
    if (!this.isNonEmptyString(item.productId)) {
      throw new BadRequestError('Order item productId must not be empty');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestError('Order item quantity must be a positive integer');
    }

    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      throw new BadRequestError('Order item unitPrice must be non-negative');
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice.toFixed(2)),
    };
  }

  private validateDiscount(percent: number): number {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new BadRequestError('Discount percent must be between 0 and 100');
    }
    return Number(percent.toFixed(2));
  }

  private ensureNonEmpty(value: string, fieldName: string): string {
    if (!this.isNonEmptyString(value)) {
      throw new BadRequestError(`${fieldName} must not be empty`);
    }
    return value;
  }

  private isNonEmptyString(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
