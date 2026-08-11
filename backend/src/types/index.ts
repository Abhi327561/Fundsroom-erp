export type UserRole = 'admin' | 'sales' | 'warehouse' | 'accounts';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
}

// What we put INSIDE the JWT token (never include password_hash here!)
export interface JwtPayload {
  id: number;
  email: string;
  role: UserRole;
}

// Extends Express's Request type so req.user is recognized by TypeScript
// after our auth middleware attaches it.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
