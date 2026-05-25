import { Query, QueryResult, QueryType } from '../entities/Query';

/**
 * Repository Interface: Query Repository
 * Defines contract for query persistence operations
 */
export interface IQueryRepository {
  // CRUD operations
  create(query: Query): Promise<void>;
  findById(id: string): Promise<Query | null>;
  findByConnectionId(connectionId: string): Promise<Query[]>;
  findByUserId(userId: string): Promise<Query[]>;
  update(query: Query): Promise<void>;
  delete(id: string): Promise<void>;

  // Query operations
  findAll(filters?: QueryFilters): Promise<Query[]>;
  findExecutedQueries(): Promise<Query[]>;
  findFailedQueries(): Promise<Query[]>;
  findSlowQueries(thresholdMs: number): Promise<Query[]>;
  findQueriesByType(type: QueryType): Promise<Query[]>;
  findRecentQueries(hours: number): Promise<Query[]>;
  findFavoriteQueries(userId: string): Promise<Query[]>;

  // Search operations
  searchBySQL(userId: string, searchTerm: string): Promise<Query[]>;
  searchByTags(userId: string, tags: string[]): Promise<Query[]>;

  // Analytics operations
  getQueryStatistics(userId: string): Promise<QueryStatistics>;
  getExecutionTrends(days: number): Promise<ExecutionTrend[]>;
  getMostUsedQueries(userId: string, limit: number): Promise<Query[]>;
  getSlowestQueries(connectionId: string, limit: number): Promise<Query[]>;

  // Batch operations
  archiveQueries(olderThanDays: number): Promise<number>;
  deleteQueries(olderThanDays: number): Promise<number>;

  // Transaction support
  withTransaction<T>(operation: (repository: IQueryRepository) => Promise<T>): Promise<T>;
}

/**
 * DTO: Query Filters
 */
export interface QueryFilters {
  userId?: string;
  connectionId?: string;
  type?: QueryType;
  status?: 'success' | 'failed' | 'pending';
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'executedAt' | 'executionTime';
  sortOrder?: 'asc' | 'desc';
}

/**
 * DTO: Query Statistics
 */
export interface QueryStatistics {
  total: number;
  successful: number;
  failed: number;
  avgExecutionTime: number;
  mostUsedType: QueryType;
  queriesThisWeek: number;
  queriesThisMonth: number;
  errorRate: number;
}

/**
 * DTO: Execution Trend
 */
export interface ExecutionTrend {
  date: Date;
  count: number;
  avgTime: number;
  successRate: number;
}

/**
 * DTO: Query Summary
 */
export interface QuerySummary {
  id: string;
  sql: string;
  type: QueryType;
  createdAt: Date;
  executedAt?: Date;
  executionTime?: number;
  success?: boolean;
  connectionName: string;
  tags: string[];
}

/**
 * Specification Pattern: Query Specifications
 */
export abstract class QuerySpecification {
  abstract isSatisfiedBy(query: Query): boolean;
}

export class QueryByUserSpecification extends QuerySpecification {
  constructor(private userId: string) {
    super();
  }

  isSatisfiedBy(query: Query): boolean {
    return query.userId === this.userId;
  }
}

export class QueryByConnectionSpecification extends QuerySpecification {
  constructor(private connectionId: string) {
    super();
  }

  isSatisfiedBy(query: Query): boolean {
    return query.connectionId === this.connectionId;
  }
}

export class ExecutedQuerySpecification extends QuerySpecification {
  isSatisfiedBy(query: Query): boolean {
    return query.isExecuted;
  }
}

export class FailedQuerySpecification extends QuerySpecification {
  isSatisfiedBy(query: Query): boolean {
    return query.results?.success === false;
  }
}

export class SlowQuerySpecification extends QuerySpecification {
  constructor(private thresholdMs: number) {
    super();
  }

  isSatisfiedBy(query: Query): boolean {
    return query.executionDuration !== undefined &&
           query.executionDuration > this.thresholdMs;
  }
}

export class DateRangeSpecification extends QuerySpecification {
  constructor(
    private startDate: Date,
    private endDate: Date
  ) {
    super();
  }

  isSatisfiedBy(query: Query): boolean {
    return query.createdAt >= this.startDate && query.createdAt <= this.endDate;
  }
}
