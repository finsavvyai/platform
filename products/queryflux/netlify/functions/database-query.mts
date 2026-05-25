/**
 * Database Query Serverless Function
 *
 * Handles secure database queries through Netlify Functions
 * with PCI DSS compliance and comprehensive audit logging.
 */

import type { Context, Config } from "@netlify/functions";
import { EncryptionService } from "../src/core/security/encryption";
import { AuditService } from "../src/core/security/audit";

// Database connection pool (in production, use external database service)
const CONNECTION_POOL = new Map<string, any>();

// Request validation schemas
interface QueryRequest {
  queryId?: string;
  connectionId: string;
  query: string;
  parameters?: any[];
  options?: {
    timeout?: number;
    maxRows?: number;
    readOnly?: boolean;
    cache?: boolean;
  };
  metadata?: {
    source: string;
    userId?: string;
    sessionId?: string;
  };
}

interface QueryResponse {
  success: boolean;
  data?: any[];
  columns?: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount?: number;
  executionTime?: number;
  message?: string;
  error?: string;
  warnings?: string[];
  cached?: boolean;
}

/**
 * Main database query handler
 */
export default async (req: Request, context: Context) => {
  try {
    // Only allow POST requests for security
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: QueryRequest = await req.json();

    // Validate request structure
    if (!validateRequest(body)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request structure' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the request for audit compliance
    const auditId = await logAuditEvent({
      action: 'database_query_requested',
      resource: body.connectionId,
      resourceType: 'database_connection',
      userId: body.metadata?.userId,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      sessionId: body.metadata?.sessionId,
      riskLevel: determineRiskLevel(body.query, body.options),
      sensitiveData: {
        query: body.query.length > 100 ? body.query.substring(0, 100) + '...' : body.query
      }
    }, context);

    // Execute the query
    const result = await executeQuery(body, context);

    // Log the result
    await logAuditEvent({
      action: 'database_query_completed',
      resource: body.connectionId,
      resourceType: 'database_connection',
      userId: body.metadata?.userId,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      sessionId: body.metadata?.sessionId,
      result: result.success ? 'success' : 'failure',
      riskLevel: determineRiskLevel(body.query, body.options)
    }, context);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Query-ID': result.queryId || auditId,
          'X-Execution-Time': String(result.executionTime || 0),
          'X-Cache-Status': result.cached ? 'HIT' : 'MISS'
        }
      }
    );

  } catch (error) {
    console.error('Database query function error:', error);

    // Log error for security monitoring
    await logAuditEvent({
      action: 'database_query_error',
      resource: 'unknown',
      resourceType: 'database_connection',
      userId: 'system',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      result: 'error',
      riskLevel: 'high',
      sensitiveData: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, context);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * Validate incoming request structure
 */
function validateRequest(body: any): body is QueryRequest {
  return body &&
         typeof body === 'object' &&
         typeof body.connectionId === 'string' &&
         typeof body.query === 'string' &&
         body.query.length > 0 &&
         body.query.length <= 10000; // Prevent overly long queries
}

/**
 * Execute database query with security checks
 */
async function executeQuery(request: QueryRequest, context: Context): Promise<QueryResponse> {
  const startTime = Date.now();

  try {
    // Security validation
    const securityCheck = validateQuerySecurity(request.query, request.options);
    if (!securityCheck.passed) {
      return {
        success: false,
        error: securityCheck.error,
        executionTime: Date.now() - startTime
      };
    }

    // Get or create connection
    const connection = await getConnection(request.connectionId, context);
    if (!connection) {
      return {
        success: false,
        error: 'Database connection not found or failed to connect',
        executionTime: Date.now() - startTime
      };
    }

    // Execute the query
    const result = await connection.query({
      text: request.query,
      values: request.parameters || [],
      rowMode: 'array'
    });

    const executionTime = Date.now() - startTime;

    // Format results
    return {
      success: true,
      data: result.rows,
      columns: result.fields.map((field: any) => ({
        name: field.name,
        type: formatDataType(field.dataTypeID),
        nullable: true
      })),
      rowCount: result.rowCount,
      executionTime,
      message: `Query executed successfully. Returned ${result.rowCount} rows.`,
      cached: false // TODO: Implement caching with Netlify Blobs
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Validate query security according to PCI DSS requirements
 */
function validateQuerySecurity(query: string, options?: any): { passed: boolean; error?: string } {
  const normalizedQuery = query.toLowerCase().trim();

  // Block dangerous operations unless explicitly allowed
  const dangerousPatterns = [
    /\bdrop\s+(database|table|schema|index|trigger|function|procedure)\b/i,
    /\btruncate\b/i,
    /\balter\s+(database|table|schema|user|role)\b/i,
    /\bgrant\s+(all|privileges)\b/i,
    /\brevoke\b/i,
    /\b(create\s+(database|table|schema|user|role))\b/i,
    /\b(insert\s+into.*\bselect\s+.*\bunion\b)/i,
    /\b(update\s+.*\bset\s+.*\bwhere\s+.*\b(?:1\s*=\s*1|true)\b/i,
    /\b(delete\s+from\s+.*\bwhere\s+.*\b(?:1\s*=\s*1|true)\b/i
  ];

  // Allow DDL if not in read-only mode
  if (!options?.readOnly) {
    // Remove some DDL patterns when not read-only
    dangerousPatterns.splice(0, 3);
  }

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalizedQuery)) {
      return {
        passed: false,
        error: 'Query contains potentially dangerous operations and has been blocked for security'
      };
    }
  }

  // Check for SQL injection patterns
  const injectionPatterns = [
    /(\bor\s+1\s*=\s*1\b)|(\band\s+1\s*=\s*1\b)/i,
    /(\bor\s+true\b)|(\band\s+true\b)/i,
    /(\bxor\s+1\b)/i,
    /(\bwaitfor\s+delay\b)/i,
    /(\bsleep\s*\()/i,
    /(\bbenchmark\s*\()/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(normalizedQuery)) {
      return {
        passed: false,
        error: 'Query contains suspicious patterns and has been blocked for security'
      };
    }
  }

  return { passed: true };
}

/**
 * Get database connection from pool or create new one
 */
async function getConnection(connectionId: string, context: Context): Promise<any> {
  // In production, this would connect to a secure database service
  // For demo purposes, we'll simulate a database connection

  if (CONNECTION_POOL.has(connectionId)) {
    return CONNECTION_POOL.get(connectionId);
  }

  // Simulate connection creation
  try {
    // In a real implementation, this would connect to PostgreSQL/MySQL/etc.
    const mockConnection = {
      query: async (params: any) => {
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        return {
          rows: [],
          rowCount: 0,
          fields: []
        };
      }
    };

    CONNECTION_POOL.set(connectionId, mockConnection);
    return mockConnection;

  } catch (error) {
    console.error('Failed to create database connection:', error);
    return null;
  }
}

/**
 * Determine risk level based on query characteristics
 */
function determineRiskLevel(query: string, options?: any): 'low' | 'medium' | 'high' | 'critical' {
  const normalizedQuery = query.toLowerCase();

  // Critical risk queries
  if (normalizedQuery.includes('drop') ||
      normalizedQuery.includes('truncate') ||
      normalizedQuery.includes('alter')) {
    return 'critical';
  }

  // High risk queries
  if (normalizedQuery.includes('delete') ||
      normalizedQuery.includes('update') ||
      normalizedQuery.includes('insert') ||
      normalizedQuery.includes('create')) {
    return 'high';
  }

  // Medium risk queries
  if (normalizedQuery.includes('select') &&
      normalizedQuery.includes('where') &&
      !options?.readOnly) {
    return 'medium';
  }

  return 'low';
}

/**
 * Format PostgreSQL data type ID to readable format
 */
function formatDataType(dataTypeId: number): string {
  const typeMap: Record<number, string> = {
    20: 'int8',
    21: 'int2',
    23: 'int4',
    25: 'text',
    1043: 'varchar',
    1700: 'numeric',
    700: 'float4',
    701: 'float8',
    16: 'bool',
    1082: 'bpchar',
    1184: 'date',
    1114: 'timestamp',
    1186: 'timestamptz'
  };

  return typeMap[dataTypeId] || 'unknown';
}

/**
 * Log audit events for PCI DSS compliance
 */
async function logAuditEvent(event: any, context: Context): Promise<string> {
  try {
    // In production, this would send to a secure audit logging service
    console.log('Audit Event:', {
      ...event,
      timestamp: new Date().toISOString(),
      requestId: context.requestId || 'unknown'
    });

    return 'audit-' + Date.now();
  } catch (error) {
    console.error('Failed to log audit event:', error);
    return 'audit-error';
  }
}

/**
 * Export configuration for the function
 */
export const config: Config = {
  path: "/api/database-query",
  method: ["POST"]
};
