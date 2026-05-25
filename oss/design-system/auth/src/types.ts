export type UserRole = 'admin' | 'user' | 'guest';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthProvider {
  verifyToken(token: string): Promise<AuthUser>;
  getToken(): Promise<string | null>;
}

export interface JwtOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

export interface MiddlewareContext {
  user?: AuthUser;
  token?: string;
}

export interface RoleConfig {
  name: UserRole;
  permissions: Set<string>;
  inherits?: UserRole[];
}

export interface PermissionCheckRequest {
  user: AuthUser;
  resource: string;
  action: string;
}

export type PermissionResolver = (
  req: PermissionCheckRequest
) => boolean | Promise<boolean>;
