/**
 * Domain Entity: Query
 * Represents a database query with execution context and results
 */
export class Query {
  public readonly id: string;
  public readonly createdAt: Date;
  public executedAt?: Date;
  private _results: QueryResult | null = null;
  private _executionPlan: ExecutionPlan | null = null;

  constructor(
    id: string,
    public readonly connectionId: string,
    public readonly sql: string,
    public readonly type: QueryType,
    public readonly userId: string,
    public readonly parameters: QueryParameter[] = [],
    public readonly timeout: number = 30000, // 30 seconds default
    public readonly metadata: QueryMetadata = new QueryMetadata()
  ) {
    this.id = id;
    this.createdAt = new Date();
    this.validateQuery();
  }

  // Getters
  get results(): QueryResult | null {
    return this._results;
  }

  get executionPlan(): ExecutionPlan | null {
    return this._executionPlan;
  }

  get isExecuted(): boolean {
    return this.executedAt !== undefined;
  }

  get executionDuration(): number | undefined {
    return this.metadata.executionTime;
  }

  // Business methods
  public execute(results: QueryResult): void {
    this.validateResults(results);
    this._results = results;
    this.executedAt = new Date();
    this.metadata.executionTime = results.executionTime;
  }

  public setExecutionPlan(plan: ExecutionPlan): void {
    this._executionPlan = plan;
  }

  private validateQuery(): void {
    if (!this.sql || this.sql.trim().length === 0) {
      throw new Error('Query SQL cannot be empty');
    }

    // SQL injection prevention checks
    if (this.containsSuspiciousPatterns(this.sql)) {
      throw new Error('Query contains potentially malicious patterns');
    }

    // Query complexity validation
    if (this.sql.length > 100000) { // 100KB limit
      throw new Error('Query exceeds maximum allowed length');
    }
  }

  private containsSuspiciousPatterns(sql: string): boolean {
    const suspiciousPatterns = [
      /\b(drop\s+database|truncate\s+table|alter\s+database)\b/i,
      /\b(exec\s*\(|execute\s*\()\b/i,
      /\b(sp_oacreate|xp_cmdshell)\b/i,
      /\b(union\s+select)\b.*\b(information_schema|sys\.)\b/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(sql));
  }

  private validateResults(results: QueryResult): void {
    if (!results.success && !results.error) {
      throw new Error('Failed query must have an error message');
    }

    if (results.data && results.data.rowCount && results.data.rowCount > 100000) {
      throw new Error('Query results exceed maximum allowed rows');
    }
  }

  // Domain invariants
  public canRetry(): boolean {
    if (!this._results) return true;

    const retryableErrors = [
      'connection timeout',
      'connection lost',
      'deadlock',
      'lock wait timeout',
      'connection reset'
    ];

    return this._results.success === false &&
           retryableErrors.some(error =>
             this._results?.error?.toLowerCase().includes(error)
           );
  }

  public getComplexityScore(): number {
    // Simple complexity scoring based on SQL patterns
    let score = 0;
    const sql = this.sql.toLowerCase();

    // Keywords that increase complexity
    const complexityKeywords = {
      join: 2,
      'join.*join': 3,
      subquery: 2,
      'case.*when': 1,
      'group by': 1,
      'order by': 1,
      'window function': 3,
      cte: 2,
      'with.*recursive': 4
    };

    for (const [pattern, points] of Object.entries(complexityKeywords)) {
      const regex = new RegExp(pattern, 'g');
      const matches = sql.match(regex);
      if (matches) {
        score += points * matches.length;
      }
    }

    return Math.min(score, 20); // Cap at 20
  }

  // Equality
  public equals(other: Query): boolean {
    if (!(other instanceof Query)) {
      return false;
    }
    return this.id === other.id;
  }
}

/**
 * Value Object: Query Type
 */
export enum QueryType {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CREATE = 'CREATE',
  ALTER = 'ALTER',
  DROP = 'DROP',
  TRUNCATE = 'TRUNCATE',
  DDL = 'DDL',
  DML = 'DML',
  DCL = 'DCL',
  TCL = 'TCL'
}

/**
 * Value Object: Query Parameter
 */
export class QueryParameter {
  constructor(
    public readonly name: string,
    public readonly value: any,
    public readonly type: ParameterType = ParameterType.STRING,
    public readonly nullable: boolean = false
  ) {
    this.validateParameter();
  }

  private validateParameter(): void {
    if (this.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.name)) {
      throw new Error(`Invalid parameter name: ${this.name}`);
    }

    if (this.nullable && this.value !== null && this.value !== undefined) {
      throw new Error('Nullable parameter must have null or undefined value');
    }
  }

  public toSafeValue(): any {
    // Sanitize parameter value to prevent injection
    if (this.type === ParameterType.STRING && typeof this.value === 'string') {
      return this.value.replace(/['"]/g, "''");
    }
    return this.value;
  }
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  JSON = 'json',
  BINARY = 'binary',
  UUID = 'uuid'
}

/**
 * Value Object: Query Result
 */
export class QueryResult {
  constructor(
    public readonly success: boolean,
    public readonly data?: QueryData,
    public readonly error?: string,
    public readonly executionTime: number = 0,
    public readonly affectedRows?: number,
    public readonly warnings?: string[],
    public readonly metadata?: Record<string, any>
  ) {}

  public hasData(): boolean {
    return this.data !== undefined && this.data.rowCount > 0;
  }

  public getResultSize(): number {
    if (!this.data) return 0;
    return JSON.stringify(this.data).length;
  }
}

/**
 * Value Object: Query Data
 */
export class QueryData {
  constructor(
    public readonly columns: ColumnInfo[],
    public readonly rows: any[][],
    public readonly rowCount: number
  ) {}

  public toJSON(): any {
    return {
      columns: this.columns.map(col => col.name),
      data: this.rows,
      count: this.rowCount
    };
  }

  public toCSV(): string {
    const headers = this.columns.map(col => col.name).join(',');
    const rows = this.rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    );
    return [headers, ...rows].join('\n');
  }
}

/**
 * Value Object: Column Information
 */
export class ColumnInfo {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly nullable: boolean = false,
    public readonly defaultValue?: any,
    public readonly primaryKey: boolean = false,
    public readonly foreignKey?: ForeignKeyInfo
  ) {}
}

/**
 * Value Object: Foreign Key Information
 */
export class ForeignKeyInfo {
  constructor(
    public readonly table: string,
    public readonly column: string,
    public readonly onUpdate: string = 'NO ACTION',
    public readonly onDelete: string = 'NO ACTION'
  ) {}
}

/**
 * Value Object: Execution Plan
 */
export class ExecutionPlan {
  constructor(
    public readonly planId: string,
    public readonly steps: ExecutionStep[],
    public readonly estimatedCost: number,
    public readonly estimatedRows: number,
    public readonly indexes: string[] = []
  ) {}

  public hasIndexScan(): boolean {
    return this.steps.some(step => step.type === 'Index Scan');
  }

  public hasFullTableScan(): boolean {
    return this.steps.some(step => step.type === 'Seq Scan' || step.type === 'Full Table Scan');
  }
}

/**
 * Value Object: Execution Step
 */
export class ExecutionStep {
  constructor(
    public readonly type: string,
    public readonly description: string,
    public readonly cost: number,
    public readonly rows: number,
    public readonly actualTime?: number,
    public readonly children: ExecutionStep[] = []
  ) {}
}

/**
 * Value Object: Query Metadata
 */
export class QueryMetadata {
  constructor(
    public readonly tags: string[] = [],
    public readonly description?: string,
    public readonly category?: string,
    public executionTime?: number,
    public readonly optimized?: boolean = false
  ) {}
}
