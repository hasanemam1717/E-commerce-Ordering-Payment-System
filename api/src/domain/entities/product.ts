import { BadRequestError } from '../../common/utils/AppError';
import { InsufficientStockError, InvalidPriceError } from '../errors';

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductProps {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  price: number;
  stock: number;
  status?: ProductStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Product {
  private readonly _id: string;
  private _name: string;
  private _sku: string;
  private _description: string | null;
  private _price: number;
  private _stock: number;
  private _status: ProductStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ProductProps) {
    this._id = this.ensureNonEmpty(props.id, 'Product id');
    this._name = this.ensureNonEmpty(props.name, 'Product name');
    this._sku = this.ensureNonEmpty(props.sku, 'Product sku');
    this._description = props.description ?? null;
    this._price = this.validatePrice(props.price);
    this._stock = this.validateStock(props.stock);
    this._status = props.status ?? 'ACTIVE';
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? this._createdAt;
  }

  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get sku(): string {
    return this._sku;
  }

  public get description(): string | null {
    return this._description;
  }

  public get price(): number {
    return this._price;
  }

  public get stock(): number {
    return this._stock;
  }

  public get status(): ProductStatus {
    return this._status;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  public decreaseStock(quantity: number): void {
    const normalizedQuantity = this.validatePositiveInteger(quantity, 'Quantity');
    if (this._stock < normalizedQuantity) {
      throw new InsufficientStockError(this._id, normalizedQuantity, this._stock);
    }

    this._stock -= normalizedQuantity;
    this._updatedAt = new Date();
  }

  public releaseStock(quantity: number): void {
    const normalizedQuantity = this.validatePositiveInteger(quantity, 'Quantity');
    this._stock += normalizedQuantity;
    this._updatedAt = new Date();
  }

  public validatePrice(price: number): number {
    if (!Number.isFinite(price) || price <= 0) {
      throw new InvalidPriceError(price);
    }

    return Number(price.toFixed(2));
  }

  public setPrice(price: number): void {
    this._price = this.validatePrice(price);
    this._updatedAt = new Date();
  }

  public publish(): void {
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  public archive(): void {
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  public updateDetails(input: {
    name?: string;
    sku?: string;
    description?: string | null;
    price?: number;
    status?: ProductStatus;
  }): void {
    if (input.name !== undefined) {
      this._name = this.ensureNonEmpty(input.name, 'Product name');
    }

    if (input.sku !== undefined) {
      this._sku = this.ensureNonEmpty(input.sku, 'Product sku');
    }

    if (input.description !== undefined) {
      this._description = input.description;
    }

    if (input.price !== undefined) {
      this._price = this.validatePrice(input.price);
    }

    if (input.status !== undefined) {
      this._status = input.status;
    }

    this._updatedAt = new Date();
  }

  private validateStock(stock: number): number {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new BadRequestError('Stock cannot be negative');
    }
    return stock;
  }

  private validatePositiveInteger(value: number, fieldName: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestError(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private ensureNonEmpty(value: string, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestError(`${fieldName} must not be empty`);
    }
    return value;
  }
}
