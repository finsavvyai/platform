import { Connection, ConnectionHealth } from '../entities/Connection';
import { DatabaseType } from '../../types/database';

/**
 * Repository Interface: Connection Repository
 * Defines contract for connection persistence operations
 */
export interface IConnectionRepository {
  // CRUD operations
  create(connection: Connection): Promise<void>;
  findById(id: string): Promise<Connection | null>;
  findByUserId(userId: string): Promise<Connection[]>;
  findByProjectId(projectId: string): Promise<Connection[]>;
  update(connection: Connection): Promise<void>;
  delete(id: string): Promise<void>;

  // Query operations
  findAll(filters?: ConnectionFilters): Promise<Connection[]>;
  findByType(type: DatabaseType): Promise<Connection[]>;
  findActiveConnections(): Promise<Connection[]>;
  findConnectionsNeedingRenewal(thresholdDays: number): Promise<Connection[]>;

  // Health check operations
  updateHealthStatus(connectionId: string, health: ConnectionHealth): Promise<void>;
  getUnhealthyConnections(): Promise<Connection[]>;

  // Statistics
  countByType(): Promise<Record<DatabaseType, number>>;
  countByUser(userId: string): Promise<number>;

  // Transaction support
  withTransaction<T>(operation: (repository: IConnectionRepository) => Promise<T>): Promise<T>;
}

/**
 * DTO: Connection Filters
 */
export interface ConnectionFilters {
  userId?: string;
  projectId?: string;
  type?: DatabaseType;
  tags?: string[];
  isActive?: boolean;
  search?: string; // Search in name and host
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastUsed';
  sortOrder?: 'asc' | 'desc';
}

/**
 * DTO: Connection Statistics
 */
export interface ConnectionStats {
  total: number;
  active: number;
  byType: Record<DatabaseType, number>;
  recentlyUsed: number; // Used in last 7 days
  unhealthy: number;
}

/**
 * Specification Pattern: Connection Specifications
 */
export abstract class ConnectionSpecification {
  abstract isSatisfiedBy(connection: Connection): boolean;
}

export class ConnectionByUserSpecification extends ConnectionSpecification {
  constructor(private userId: string) {
    super();
  }

  isSatisfiedBy(connection: Connection): boolean {
    return connection.userId === this.userId;
  }
}

export class ConnectionByTypeSpecification extends ConnectionSpecification {
  constructor(private type: DatabaseType) {
    super();
  }

  isSatisfiedBy(connection: Connection): boolean {
    return connection.type === this.type;
  }
}

export class ActiveConnectionSpecification extends ConnectionSpecification {
  isSatisfiedBy(connection: Connection): boolean {
    return connection.isActive();
  }
}

export class ComposedSpecification extends ConnectionSpecification {
  constructor(
    private specifications: ConnectionSpecification[],
    private operator: 'AND' | 'OR' = 'AND'
  ) {
    super();
  }

  isSatisfiedBy(connection: Connection): boolean {
    if (this.operator === 'AND') {
      return this.specifications.every(spec => spec.isSatisfiedBy(connection));
    } else {
      return this.specifications.some(spec => spec.isSatisfiedBy(connection));
    }
  }
}
