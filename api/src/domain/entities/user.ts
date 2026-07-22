import { BadRequestError } from '../../common/utils/AppError';

export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private readonly _id: string;
  private _email: string;
  private _passwordHash: string;
  private _role: UserRole;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: UserProps) {
    this._id = props.id;
    this._email = this.normalizeEmail(props.email);
    this._passwordHash = this.ensureNonEmpty(props.passwordHash, 'Password hash');
    this._role = props.role ?? 'CUSTOMER';
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? this._createdAt;
  }

  public get id(): string {
    return this._id;
  }

  public get email(): string {
    return this._email;
  }

  public get role(): UserRole {
    return this._role;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get passwordHash(): string {
    return this._passwordHash;
  }

  public isAdmin(): boolean {
    return this._role === 'ADMIN';
  }

  public async validatePassword(
    password: string,
    compareFn: (plainPassword: string, hashedPassword: string) => Promise<boolean> | boolean,
  ): Promise<boolean> {
    if (!this.isNonEmptyString(password)) {
      throw new BadRequestError('Password must not be empty');
    }

    return compareFn(password, this._passwordHash);
  }

  public updateProfile(input: { email?: string }): void {
    if (input.email !== undefined) {
      this._email = this.normalizeEmail(input.email);
    }

    this._updatedAt = new Date();
  }

  public setPasswordHash(passwordHash: string): void {
    this._passwordHash = this.ensureNonEmpty(passwordHash, 'Password hash');
    this._updatedAt = new Date();
  }

  public changeRole(role: UserRole): void {
    if (role !== 'ADMIN' && role !== 'CUSTOMER') {
      throw new BadRequestError('Invalid user role');
    }

    this._role = role;
    this._updatedAt = new Date();
  }

  private normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      throw new BadRequestError('Invalid email address');
    }
    return normalized;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isNonEmptyString(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private ensureNonEmpty(value: string, fieldName: string): string {
    if (!this.isNonEmptyString(value)) {
      throw new BadRequestError(`${fieldName} must not be empty`);
    }
    return value;
  }
}
