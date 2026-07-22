/** Auth module DTOs and interfaces */

/** User object returned to client (password_hash excluded) */
export interface UserResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  createdAt: Date;
  updatedAt: Date;
}

/** Payload embedded in the JWT */
export interface JwtPayload {
  userId: string;
  role: 'ADMIN' | 'CUSTOMER';
}

/** Request DTO for POST /auth/register */
export interface RegisterDto {
  email: string;
  password: string;
}

/** Request DTO for POST /auth/login */
export interface LoginDto {
  email: string;
  password: string;
}

/** Response DTO for successful auth operations */
export interface AuthResult {
  token: string;
  user: UserResponse;
}

/** Express Request augmentation */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
