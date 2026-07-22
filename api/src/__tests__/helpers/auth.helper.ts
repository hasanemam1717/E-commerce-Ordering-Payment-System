import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import type { JwtPayload } from '../../modules/auth/auth.types';

export interface TestUserSeedResult {
  email: string;
  password: string;
  token: string;
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'CUSTOMER';
  };
}

export async function registerTestUser(
  overrides: Partial<{ email: string; password: string; role: 'ADMIN' | 'CUSTOMER' }> = {},
): Promise<TestUserSeedResult> {
  const email = overrides.email ?? `user-${Date.now()}@example.com`;
  const password = overrides.password ?? 'Password123!';
  const role = overrides.role ?? 'CUSTOMER';

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
    },
    select: { id: true, email: true, role: true },
  });

  const token = jwt.sign(
    { userId: user.id, role: user.role } satisfies JwtPayload,
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_SECONDS,
    },
  );

  return { email, password, token, user };
}

export async function createAuthToken(
  overrides: Partial<{ email: string; password: string; role: 'ADMIN' | 'CUSTOMER' }> = {},
): Promise<string> {
  const result = await registerTestUser(overrides);
  return result.token;
}
