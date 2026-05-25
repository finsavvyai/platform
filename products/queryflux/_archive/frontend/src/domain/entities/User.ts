/**
 * Domain Entity: User
 * Represents a user with enterprise-grade access control
 */
export class User {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  private _lastLoginAt?: Date;
  private _failedLoginAttempts: number = 0;
  private _lockedUntil?: Date;

  constructor(
    id: string,
    public readonly email: string,
    public readonly username: string,
    public readonly hashedPassword: string,
    public readonly role: UserRole,
    public readonly permissions: Permission[] = [],
    public readonly mfaEnabled: boolean = false,
    public readonly mfaSecret?: string
  ) {
    this.id = id;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.validateUser();
  }

  // Getters
  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  get isLocked(): boolean {
    return this._lockedUntil !== undefined && this._lockedUntil > new Date();
  }

  get lockedUntil(): Date | undefined {
    return this._lockedUntil;
  }

  // Business methods
  public recordSuccessfulLogin(): void {
    this._lastLoginAt = new Date();
    this._failedLoginAttempts = 0;
    this._lockedUntil = undefined;
    this.updatedAt = new Date();
  }

  public recordFailedLogin(): void {
    this._failedLoginAttempts++;
    this.updatedAt = new Date();

    // Lock account after 5 failed attempts for 30 minutes
    if (this._failedLoginAttempts >= 5) {
      this._lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }

  public unlock(): void {
    this._failedLoginAttempts = 0;
    this._lockedUntil = undefined;
    this.updatedAt = new Date();
  }

  public hasPermission(permission: Permission): boolean {
    // Admin role has all permissions
    if (this.role === UserRole.ADMIN) {
      return true;
    }

    return this.permissions.includes(permission);
  }

  public hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  public canAccessResource(resource: string, action: string): boolean {
    // Check role-based access
    const roleAccess = this.getRoleAccessMatrix();
    const allowedActions = roleAccess[this.role]?.[resource] || [];

    if (allowedActions.includes('*') || allowedActions.includes(action)) {
      return true;
    }

    // Check explicit permissions
    const permissionString = `${resource}:${action}`;
    return this.permissions.some(p => p === permissionString || p === '*');
  }

  private getRoleAccessMatrix(): RoleAccessMatrix {
    return {
      [UserRole.ADMIN]: {
        '*': ['*']
      },
      [UserRole.DEVELOPER]: {
        connections: ['read', 'create', 'update', 'delete'],
        queries: ['read', 'create', 'update', 'delete', 'execute'],
        projects: ['read', 'create', 'update'],
        monitoring: ['read'],
        users: ['read']
      },
      [UserRole.ANALYST]: {
        connections: ['read'],
        queries: ['read', 'create', 'execute'],
        projects: ['read'],
        monitoring: ['read']
      },
      [UserRole.VIEWER]: {
        connections: ['read'],
        queries: ['read'],
        projects: ['read'],
        monitoring: ['read']
      }
    };
  }

  private validateUser(): void {
    if (!this.email || !this.email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!this.username || this.username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(this.username)) {
      throw new Error('Username can only contain alphanumeric characters, hyphens, and underscores');
    }

    if (!this.hashedPassword || this.hashedPassword.length < 60) {
      throw new Error('Invalid password hash');
    }
  }

  // Domain invariants
  public isActive(): boolean {
    // User is active if logged in within last 90 days
    if (!this._lastLoginAt) return false;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this._lastLoginAt > ninetyDaysAgo;
  }

  public requiresPasswordChange(): boolean {
    // Require password change every 90 days
    if (!this._lastLoginAt) return true;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this._lastLoginAt < ninetyDaysAgo;
  }

  // Value objects
  public getProfile(): UserProfile {
    return new UserProfile(
      this.id,
      this.username,
      this.email,
      this.role,
      this.isActive(),
      this.mfaEnabled
    );
  }

  public getSecurityContext(): SecurityContext {
    return new SecurityContext(
      this.id,
      this.role,
      this.permissions,
      this.isActive(),
      this.isLocked
    );
  }

  // Equality
  public equals(other: User): boolean {
    if (!(other instanceof User)) {
      return false;
    }
    return this.id === other.id;
  }
}

/**
 * Enum: User Roles
 */
export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}

/**
 * Type: Permission
 */
export type Permission = string;

/**
 * Predefined Permissions
 */
export const PERMISSIONS = {
  // Connection permissions
  CONNECTION_READ: 'connections:read',
  CONNECTION_CREATE: 'connections:create',
  CONNECTION_UPDATE: 'connections:update',
  CONNECTION_DELETE: 'connections:delete',
  CONNECTION_EXECUTE: 'connections:execute',

  // Query permissions
  QUERY_READ: 'queries:read',
  QUERY_CREATE: 'queries:create',
  QUERY_UPDATE: 'queries:update',
  QUERY_DELETE: 'queries:delete',
  QUERY_EXECUTE: 'queries:execute',
  QUERY_EXPORT: 'queries:export',

  // Project permissions
  PROJECT_READ: 'projects:read',
  PROJECT_CREATE: 'projects:create',
  PROJECT_UPDATE: 'projects:update',
  PROJECT_DELETE: 'projects:delete',
  PROJECT_MANAGE_USERS: 'projects:manage_users',

  // User management
  USER_READ: 'users:read',
  USER_CREATE: 'users:create',
  USER_UPDATE: 'users:update',
  USER_DELETE: 'users:delete',
  USER_MANAGE_ROLES: 'users:manage_roles',

  // Monitoring permissions
  MONITORING_READ: 'monitoring:read',
  MONITORING_ALERTS: 'monitoring:alerts',
  MONITORING_METRICS: 'monitoring:metrics',

  // Admin permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_AUDIT: 'system:audit',

  // Wildcard permissions
  ALL_CONNECTIONS: 'connections:*',
  ALL_QUERIES: 'queries:*',
  ALL_PROJECTS: 'projects:*',
  ALL_USERS: 'users:*',
  ALL_MONITORING: 'monitoring:*',
  ALL_SYSTEM: 'system:*',
  ALL: '*'
} as const;

/**
 * Type: Role Access Matrix
 */
type RoleAccessMatrix = {
  [role in UserRole]: {
    [resource: string]: string[];
  };
};

/**
 * Value Object: User Profile
 */
export class UserProfile {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly mfaEnabled: boolean
  ) {}
}

/**
 * Value Object: Security Context
 */
export class SecurityContext {
  constructor(
    public readonly userId: string,
    public readonly role: UserRole,
    public readonly permissions: Permission[],
    public readonly isActive: boolean,
    public readonly isLocked: boolean
  ) {}

  public can(action: string, resource: string): boolean {
    if (!this.isActive || this.isLocked) {
      return false;
    }

    return this.permissions.some(permission =>
      permission === '*' ||
      permission === `${resource}:*` ||
      permission === `${resource}:${action}`
    );
  }
}

/**
 * Entity: UserSession
 */
export class UserSession {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly token: string,
    public readonly refreshToken: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date = new Date(),
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly mfaVerified: boolean = false
  ) {}

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public isValid(): boolean {
    return !this.isExpired() && (this.mfaVerified || !this.requiresMFA());
  }

  private requiresMFA(): boolean {
    // Business logic: Determine if session requires MFA
    return false; // Simplified for now
  }
}

/**
 * Value Object: AuditLog
 */
export class AuditLog {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly action: string,
    public readonly resource: string,
    public readonly resourceId?: string,
    public readonly details?: Record<string, any>,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly timestamp: Date = new Date()
  ) {}
}
