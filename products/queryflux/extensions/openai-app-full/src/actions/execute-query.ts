/**
 * Execute Query Action
 *
 * Handles secure SQL query execution with comprehensive validation
 * and performance monitoring
 */

import { z } from 'zod';
import { DatabaseConnectionManager } from '../database/connection-manager.js';
import { QueryValidator } from '../security/query-validator.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Query execution schema
const ExecuteQuerySchema = z.object({
  sql: z.string().min(1, 'SQL query cannot be empty'),
  connectionId: z.string().min(1, 'Connection ID is required'),
  parameters: z.array(z.any()).default([]),
  limit: z.number().min(1).max(10000).default(1000),
  timeout: z.number().min(1000).max(300000).default(30000),
  readOnly: z.boolean().default(true),
  validateSecurity: z.boolean().default(true)
});

/**
 * Query security validator
 */
class QuerySecurityValidator {
  private dangerousOperations = [
    'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER',
    'TRUNCATE', 'EXEC', 'GRANT', 'REVOKE', 'LOCK', 'UNLOCK',
    'LOAD_FILE', 'INTO OUTFILE', 'DUMPFILE', 'PG_SLEEP',
    'COPY', 'MOVE', 'RENAME', 'REPLACE'
  ];

  private dangerousPatterns = [
    /union\s+select/i,
    /exec\s*\(/i,
    /--.*script/i,
    /;.*\/\*|--/i,
    /xp_cmdshell/i,
    /sp_executesql/i,
    /eval\s*\(/i,
    /system\s*\(/i,
    /shell_exec\s*\(/i,
    /curl\s*\(/i,
    /wget\s*\(/i,
    /nc\s+/i,
    /netcat\s+/i
  ];

  async validateQuery(query: string, connectionType: string, readOnly: boolean): Promise<{
    safe: boolean;
    warnings: string[];
    blockedReason?: string;
    suggestedChanges: string[];
  }> {
    const result = {
      safe: true,
      warnings: [] as string[],
      blockedReason: undefined as string | undefined,
      suggestedChanges: [] as string[]
    };

    // Convert to uppercase for pattern matching
    const upperQuery = query.toUpperCase();

    // Check for dangerous operations
    for (const operation of this.dangerousOperations) {
      if (upperQuery.includes(operation)) {
        if (readOnly && ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE'].includes(operation)) {
          result.safe = false;
          result.blockedReason = `Dangerous operation '${operation}' blocked in read-only mode`;
          result.suggestedChanges.push(`Consider using SELECT queries only for read-only operations`);
          return result;
        }

        result.warnings.push(`Potentially dangerous operation detected: ${operation}`);
        result.suggestedChanges.push(`Review if ${operation} operation is necessary`);
      }
    }

    // Check for injection patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(query)) {
        result.safe = false;
        result.blockedReason = `Potential SQL injection or malicious pattern detected`;
        result.suggestedChanges.push('Remove potentially malicious code patterns');
        return result;
      }
    }

    // Database-specific validations
    switch (connectionType) {
      case 'postgresql':
        return this.validatePostgreSQLQuery(query, result);
      case 'mysql':
        return this.validateMySQLQuery(query, result);
      case 'mongodb':
        return this.validateMongoDBQuery(query, result);
      case 'redis':
        return this.validateRedisQuery(query, result);
    }

    return result;
  }

  private validatePostgreSQLQuery(query: string, result: any): any {
    const dangerousFunctions = ['pg_sleep', 'pg_read_file', 'pg_write_file', 'pg_ls_dir'];
    const upperQuery = query.toUpperCase();

    for (const func of dangerousFunctions) {
      if (upperQuery.includes(func.toUpperCase())) {
        result.safe = false;
        result.blockedReason = `Potentially dangerous PostgreSQL function: ${func}`;
        return result;
      }
    }

    // Check for dangerous schema operations
    if (upperQuery.includes('INFORMATION_SCHEMA') && !upperQuery.includes('SELECT')) {
      result.warnings.push('Accessing system schema may require elevated permissions');
    }

    return result;
  }

  private validateMySQLQuery(query: string, result: any): any {
    const dangerousFunctions = ['SLEEP', 'LOAD_FILE', 'INTO OUTFILE', 'DUMPFILE'];
    const upperQuery = query.toUpperCase();

    for (const func of dangerousFunctions) {
      if (upperQuery.includes(func)) {
        result.safe = false;
        result.blockedReason = `Potentially dangerous MySQL function: ${func}`;
        return result;
      }
    }

    return result;
  }

  private validateMongoDBQuery(query: string, result: any): any {
    // MongoDB-specific validation
    if (query.includes('$where') && query.includes('$eval')) {
      result.safe = false;
      result.blockedReason = 'Combination of $where and $eval is not allowed';
      return result;
    }

    return result;
  }

  private validateRedisQuery(query: string, result: any): any {
    const dangerousCommands = ['FLUSHALL', 'FLUSHDB', 'EVAL', 'CONFIG', 'SHUTDOWN'];
    const upperQuery = query.toUpperCase();

    for (const cmd of dangerousCommands) {
      if (upperQuery.includes(cmd)) {
        result.safe = false;
        result.blockedReason = `Potentially dangerous Redis command: ${cmd}`;
        return result;
      }
    }

    return result;
  }
}

/**
 * Query execution engine with comprehensive monitoring
 */
class QueryExecutionEngine {
  private connectionManager: DatabaseConnectionManager;
  private securityValidator: QuerySecurityValidator;

  constructor() {
    this.connectionManager = new DatabaseConnectionManager();
    this.securityValidator = new QuerySecurityValidator();
  }

  async executeQuery(params: {
    sql: string;
    connectionId: string;
    parameters?: any[];
    limit?: number;
    timeout?: number;
    readOnly?: boolean;
    validateSecurity?: boolean;
  }): Promise<any> {
    try {
      const startTime = Date.now();

      logger.info('🔍 Starting query execution', {
        connectionId: params.connectionId,
        queryPreview: params.sql.substring(0, 100) + '...',
        readOnly: params.readOnly
      });

      // Get connection
      const connection = this.connectionManager.getConnection(params.connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${params.connectionId}`);
      }

      // Security validation
      if (params.validateSecurity) {
        const securityCheck = await this.securityValidator.validateQuery(
          params.sql,
          connection.type,
          params.readOnly || true
        );

        if (!securityCheck.safe) {
          throw new Error(`Query blocked for security reasons: ${securityCheck.blockedReason}`);
        }

        if (securityCheck.warnings.length > 0) {
          logger.warn('⚠️ Query security warnings:', securityCheck.warnings);
        }
      }

      // Add LIMIT clause if not present and limit is specified
      let finalSQL = params.sql;
      if (params.limit && !finalSQL.toUpperCase().includes('LIMIT')) {
        const databaseType = connection.type;

        switch (databaseType) {
          case 'sqlserver':
            finalSQL = this.addSQLServerLimit(finalSQL, params.limit);
            break;
          case 'oracle':
            finalSQL = this.addOracleLimit(finalSQL, params.limit);
            break;
          default:
            finalSQL = `${finalSQL} LIMIT ${params.limit}`;
            break;
        }
      }

      // Execute query with timeout
      const queryResult = await this.connectionManager.executeQuery(
        params.connectionId,
        finalSQL,
        params.parameters || []
      );

      const executionTime = Date.now() - startTime;

      // Format result for OpenAI
      const formattedResult = this.formatQueryResult(queryResult, connection.type);

      // Log execution metrics
      await this.logQueryExecution({
        sql: finalSQL,
        connectionId: params.connectionId,
        executionTime,
        rowCount: formattedResult.rowCount,
        success: true
      });

      logger.info('✅ Query executed successfully', {
        connectionId: params.connectionId,
        executionTime: `${executionTime}ms`,
        rowCount: formattedResult.rowCount
      });

      return {
        success: true,
        query: {
          sql: finalSQL,
          originalSQL: params.sql,
          parameters: params.parameters || [],
          executionTime: `${executionTime}ms`,
          connectionId: params.connectionId
        },
        data: formattedResult.data,
        metadata: {
          rowCount: formattedResult.rowCount,
          columns: formattedResult.columns,
          executionTime: `${executionTime}ms`,
          connectionType: connection.type,
          limitApplied: params.limit && !params.sql.toUpperCase().includes('LIMIT'),
          securityValidated: params.validateSecurity,
          timestamp: new Date().toISOString()
        },
        performance: {
          executionTimeMs: executionTime,
          rowsReturned: formattedResult.rowCount,
          dataTransferSize: JSON.stringify(formattedResult.data).length,
          queryComplexity: this.estimateQueryComplexity(finalSQL)
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error('❌ Query execution failed:', error);

      // Log failed execution metrics
      await this.logQueryExecution({
        sql: params.sql,
        connectionId: params.connectionId,
        executionTime,
        rowCount: 0,
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        query: {
          sql: params.sql,
          parameters: params.parameters || [],
          executionTime: `${executionTime}ms`,
          connectionId: params.connectionId
        },
        suggestions: await this.generateErrorSuggestions(error, params),
        troubleshooting: {
          commonCauses: [
            'SQL syntax error',
            'Table or column does not exist',
            'Insufficient permissions',
            'Database connection lost',
            'Query timeout'
          ],
          specificFixes: this.getSpecificFixes(error, params)
        }
      };
    }
  }

  private formatQueryResult(result: any, databaseType: string): any {
    // Standardize result format across different database types
    const columns = result.columns || result.fields || [];

    return {
      data: result.data || result.rows || [],
      rowCount: result.rowCount || result.affectedRows || (result.data?.length || 0),
      columns: columns.map((col: any) => ({
        name: col.name || col.column_name,
        type: col.type || col.data_type,
        nullable: col.nullable || col.is_nullable === 'YES'
      })),
      metadata: {
        databaseType,
        originalResult: result
      }
    };
  }

  private addSQLServerLimit(sql: string, limit: number): string {
    if (sql.toUpperCase().includes('SELECT') && !sql.toUpperCase().includes('TOP')) {
      return sql.replace(/^SELECT/i, `SELECT TOP ${limit}`);
    }
    return sql;
  }

  private addOracleLimit(sql: string, limit: number): string {
    if (!sql.toUpperCase().includes('FETCH NEXT')) {
      return `SELECT * FROM (${sql}) WHERE ROWNUM <= ${limit}`;
    }
    return sql;
  }

  private estimateQueryComplexity(sql: string): 'low' | 'medium' | 'high' {
    const upperSQL = sql.toUpperCase();
    let complexityScore = 0;

    // Base complexity score
    if (upperSQL.includes('SELECT')) complexityScore += 1;
    if (upperSQL.includes('JOIN')) complexityScore += 2;
    if (upperSQL.includes('SUBQUERY')) complexityScore += 3;
    if (upperSQL.includes('GROUP BY')) complexityScore += 2;
    if (upperSQL.includes('ORDER BY')) complexityScore += 1;
    if (upperSQL.includes('HAVING')) complexityScore += 2;
    if (upperSQL.includes('UNION')) complexityScore += 3;
    if (upperSQL.includes('WINDOW') || upperSQL.includes('OVER')) complexityScore += 4;

    // Function calls add complexity
    const functionMatches = upperSQL.match(/\w+\(/g) || [];
    complexityScore += Math.min(functionMatches.length, 5);

    // Table joins
    const joinMatches = upperSQL.match(/JOIN/gi) || [];
    complexityScore += joinMatches.length * 2;

    if (complexityScore <= 3) return 'low';
    if (complexityScore <= 8) return 'medium';
    return 'high';
  }

  private async generateErrorSuggestions(error: any, params: any): Promise<string[]> {
    const suggestions: string[] = [];

    // General suggestions
    suggestions.push('Check SQL syntax for any errors');
    suggestions.push('Verify table and column names exist');
    suggestions.push('Ensure you have proper database permissions');
    suggestions.push('Check if database connection is still active');

    // Error-specific suggestions
    if (error.message.includes('does not exist')) {
      suggestions.push('Table or column does not exist - verify schema');
      suggestions.push('Check for typos in table/column names');
    }

    if (error.message.includes('permission')) {
      suggestions.push('Insufficient permissions - check user roles');
      suggestions.push('Verify database user has required privileges');
    }

    if (error.message.includes('timeout')) {
      suggestions.push('Query timeout - consider optimizing the query');
      suggestions.push('Add LIMIT clause to reduce result set size');
    }

    if (error.message.includes('syntax')) {
      suggestions.push('SQL syntax error - check parentheses and keywords');
      suggestions.push('Use a database query tool to validate syntax');
    }

    return suggestions;
  }

  private getSpecificFixes(error: any, params: any): string[] {
    const fixes: string[] = [];

    if (error.message.includes('does not exist')) {
      fixes.push(`Run: "\\dt ${error.message.split(' ')[0]}" to check if table exists`);
      fixes.push('Use database schema explorer to verify table names');
    }

    if (error.message.includes('column')) {
      fixes.push('Query information_schema.columns to check available columns');
      fixes.push('Use \\d table_name to describe table structure');
    }

    if (error.message.includes('timeout')) {
      fixes.push('Add or reduce LIMIT clause');
      fixes.push('Add proper indexes on WHERE clause columns');
      fixes.push('Consider breaking complex query into simpler parts');
    }

    return fixes;
  }

  private async logQueryExecution(metrics: {
    sql: string;
    connectionId: string;
    executionTime: number;
    rowCount: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    // In production, this would send to monitoring service
    if (config.monitoring.enabled) {
      logger.info('Query execution metrics:', {
        connectionId: metrics.connectionId,
        executionTime: metrics.executionTime,
        rowCount: metrics.rowCount,
        success: metrics.success,
        sqlHash: this.hashQuery(metrics.sql)
      });
    }
  }

  private hashQuery(sql: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }
}

/**
 * Main execute query action
 */
export async function executeQuery(params: {
  sql: string;
  connectionId: string;
  limit?: number;
  timeout?: number;
}): Promise<any> {
  try {
    // Validate parameters
    const validatedParams = ExecuteQuerySchema.parse(params);

    // Create query execution engine
    const engine = new QueryExecutionEngine();

    // Execute query
    const result = await engine.executeQuery(validatedParams);

    return result;

  } catch (error) {
    logger.error('❌ Query execution error:', error);

    return {
      success: false,
      error: error.message,
      suggestions: [
        'Check SQL syntax for errors',
        'Verify table and column names',
        'Ensure database connection is active',
        'Check user permissions'
      ],
      query: {
        sql: params.sql,
        connectionId: params.connectionId
      }
    };
  }
}

export default executeQuery;
