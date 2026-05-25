import { User, UserSession, AuditLog, UserRole, Permission } from '../entities/User';

/**
 * Repository Interface: User Repository
 * Defines contract for user persistence operations
 */
export interface IUserRepository {
  // CRUD operations
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;

  // Query operations
  findAll(filters?: UserFilters): Promise<User[]>;
  findByRole(role: UserRole): Promise<User[]>;
  findActiveUsers(): Promise<User[]>;
  findLockedUsers(): Promise<User[]>;
  findInactiveUsers(daysThreshold: number): Promise<User[]>;
  findUsersRequiringPasswordChange(): Promise<User[]>;

  // Session operations
  createSession(session: UserSession): Promise<void>;
  findSessionById(id: string): Promise<UserSession | null>;
  findSessionByToken(token: string): Promise<UserSession | null>;
  findSessionsByUserId(userId: string): Promise<UserSession[]>;
  updateSession(session: UserSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
  deleteAllSessions(userId: string): Promise<void>;

  // Authentication operations
  recordLoginAttempt(userId: string, success: boolean, ip?: string): Promise<void>;
  recordPasswordChange(userId: string): Promise<void>;
  recordMFASetup(userId: string): Promise<void>;

  // Audit operations
  createAuditLog(log: AuditLog): Promise<void>;
  findAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]>;

  // Statistics
  getUserStatistics(): Promise<UserStatistics>;
  getLoginStatistics(days: number): Promise<LoginStatistics>;

  // Transaction support
  withTransaction<T>(operation: (repository: IUserRepository) => Promise<T>): Promise<T>;
}

/**
 * DTO: User Filters
 */
export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  isLocked?: boolean;
  mfaEnabled?: boolean;
  search?: string; // Search in email and username
  createdFrom?: Date;
  createdTo?: Date;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'username' | 'email' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * DTO: User Statistics
 */
export interface UserStatistics {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  mfaEnabled: number;
  byRole: Record<UserRole, number>;
  newThisMonth: number;
  passwordChangesThisMonth: number;
}

/**
 * DTO: Login Statistics
 */
export interface LoginStatistics {
  date: Date;
  successfulLogins: number;
  failedLogins: number;
  uniqueUsers: number;
  topCountries: Array<{ country: string; count: number }>;
}

/**
 * DTO: Audit Log Filters
 */
export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Specification Pattern: User Specifications
 */
export abstract class UserSpecification {
  abstract isSatisfiedBy(user: User): boolean;
}

export class UserByRoleSpecification extends UserSpecification {
  constructor(private role: UserRole) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.role === this.role;
  }
}

export class ActiveUserSpecification extends UserSpecification {
  isSatisfiedBy(user: User): boolean {
    return user.isActive();
  }
}

export class LockedUserSpecification extends UserSpecification {
  isSatisfiedBy(user: User): boolean {
    return user.isLocked;
  }
}

export class MFAEnabledSpecification extends UserSpecification {
  isSatisfiedBy(user: User): boolean {
    return user.mfaEnabled;
  }
}

export class HasPermissionSpecification extends UserSpecification {
  constructor(private permission: Permission) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.hasPermission(this.permission);
  }
}

export class ComposedUserSpecification extends UserSpecification {
  constructor(
    private specifications: UserSpecification[],
    private operator: 'AND' | 'OR' = 'AND'
  ) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    if (this.operator === 'AND') {
      return this.specifications.every(spec => spec.isSatisfiedBy(user));
    } else {
      return this.specifications.some(spec => spec.isSatisfiedBy(user));
    }
  }
}
