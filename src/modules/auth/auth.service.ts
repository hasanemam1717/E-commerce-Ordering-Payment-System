import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ConflictError, UnauthorizedError } from '../../common/utils/AppError';
import type { RegisterDto, LoginDto, AuthResult, UserResponse, JwtPayload } from './auth.types';

const SALT_ROUNDS = 12;

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── Register ────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<AuthResult> {
    const { email, password } = dto;

    // 1. Check duplicate email
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError(`User with email '${email}' already exists`, { email });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Create user
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    // 4. Generate JWT
    const token = this.generateToken({ userId: user.id, role: user.role });

    logger.info({ userId: user.id, email }, 'User registered successfully');

    return {
      token,
      user: this.toUserResponse(user),
    };
  }

  // ─── Login ───────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResult> {
    const { email, password } = dto;

    // 1. Find user
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Generate JWT
    const token = this.generateToken({ userId: user.id, role: user.role });

    logger.info({ userId: user.id, email }, 'User logged in successfully');

    return {
      token,
      user: this.toUserResponse(user),
    };
  }

  // ─── Private helpers ─────────────────────────────────────
  private generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_SECONDS,
    });
  }

  /** Strip password_hash from Prisma User model */
  private toUserResponse(user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'CUSTOMER';
    createdAt: Date;
    updatedAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
