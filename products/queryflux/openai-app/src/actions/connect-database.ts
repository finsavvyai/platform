/**
 * Connect to Database Action
 *
 * Handles secure database connections with AI assistance
 * Supports multiple database types with enterprise security
 */

import { z } from 'zod';
import { DatabaseConnectionManager } from '../database/connection-manager.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Database connection configuration schema
const DatabaseConnectionConfigSchema = z.object({
  name: z.string().min(1, 'Connection name is required'),
  type: z.enum([
    'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite',
    'sqlserver', 'oracle', 'cassandra', 'elasticsearch',
    'couchbase', 'dynamodb', 'bigquery', 'snowflake', 'redshift'
  ]),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535).optional(),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  ssl: z.boolean().default(true),
  connectionTimeout: z.number().default(30000),
  maxConnections: z.number().min(1).max(100).default(10),
  sshTunnel: z.object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.number().default(22),
    username: z.string().optional(),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    bastion: z.boolean().default(false)
  }).optional(),
  advanced: z.object({
    charset: z.string().default('utf8'),
    timezone: z.string().default('UTC'),
    applicationName: z.string().default('QueryFlux OpenAI App')
  }).optional()
});

/**
 * Get default port for database type
 */
function getDefaultPort(databaseType: string): number {
  const defaultPorts: { [key: string]: number } = {
    postgresql: 5432,
    mysql: 3306,
    mongodb: 27017,
    redis: 6379,
    sqlserver: 1433,
    oracle: 1521,
    cassandra: 9042,
    elasticsearch: 9200,
    couchbase: 8091,
    snowflake: 443,
    redshift: 5439,
    bigquery: 443
  };

  return defaultPorts[databaseType] || 3306; // Default to MySQL port
}

/**
 * Get AI-powered connection advice
 */
async function getAIConnectionAdvice(config: any): Promise<string> {
  const advicePrompt = `
Provide connection advice for this database configuration:
Type: ${config.type}
Host: ${config.host}
Port: ${config.port}
Database: ${config.database}
SSL: ${config.ssl}
SSH Tunnel: ${config.sshTunnel?.enabled || 'disabled'}

Provide 2-3 brief, actionable tips for optimal connection setup in a friendly tone:
  `;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: advicePrompt }],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  } catch (error) {
    logger.warn('Failed to get AI connection advice:', error);
    return '';
  }
}

/**
 * Validate database connection configuration
 */
function validateConnectionConfig(config: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.name) errors.push('Connection name is required');
  if (!config.type) errors.push('Database type is required');
  if (!config.host) errors.push('Host is required');
  if (!config.database) errors.push('Database name is required');
  if (!config.username) errors.push('Username is required');
  if (!config.password) errors.push('Password is required');

  // Validate port
  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }

  // Validate database type
  const supportedTypes = [
    'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite',
    'sqlserver', 'oracle', 'cassandra', 'elasticsearch',
    'couchbase', 'dynamodb', 'bigquery', 'snowflake', 'redshift'
  ];

  if (!supportedTypes.includes(config.type)) {
    errors.push(`Unsupported database type: ${config.type}. Supported types: ${supportedTypes.join(', ')}`);
  }

  // Security warnings
  if (!config.ssl && !config.sshTunnel?.enabled) {
    warnings.push('SSL is disabled - consider enabling for secure connections');
  }

  if (config.password && config.password.length < 8) {
    warnings.push('Consider using a stronger password');
  }

  // Database-specific validations
  if (config.type === 'postgresql' && config.database.toLowerCase() === 'postgres') {
    warnings.push('Consider connecting to a specific database instead of the default postgres database');
  }

  if (config.type === 'mongodb' && config.username === 'admin') {
    warnings.push('Consider using a less privileged user account for better security');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Main database connection action
 */
export async function connectDatabase(params: {
  config: any;
  aiAssistance?: boolean;
}): Promise<any> {
  try {
    logger.info('🔗 Starting database connection process');

    // Validate and parse configuration
    const validatedConfig = DatabaseConnectionConfigSchema.parse(params.config);

    // Add default port if not provided
    if (!validatedConfig.port) {
      validatedConfig.port = getDefaultPort(validatedConfig.type);
    }

    logger.info(`📊 Connecting to ${validatedConfig.type}: ${validatedConfig.host}:${validatedConfig.port}/${validatedConfig.database}`);

    // Validate configuration
    const validation = validateConnectionConfig(validatedConfig);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      logger.warn('⚠️ Connection warnings:', validation.warnings);
    }

    // Get AI assistance if requested
    let aiAdvice = '';
    if (params.aiAssistance) {
      aiAdvice = await getAIConnectionAdvice(validatedConfig);
    }

    // Create database connection manager
    const connectionManager = new DatabaseConnectionManager();

    // Establish connection
    const connection = await connectionManager.createConnection(validatedConfig);

    // If SSH tunnel is required, create it
    let sshTunnelResult = null;
    if (validatedConfig.sshTunnel?.enabled) {
      try {
        sshTunnelResult = await connectionManager.createSSHTunnel(connection.id, validatedConfig.sshTunnel);
        logger.info(`🚇 SSH tunnel created: ${sshTunnelResult.localPort} -> ${validatedConfig.sshTunnel.host}:${validatedConfig.port}`);
      } catch (sshError) {
        logger.warn(`⚠️ SSH tunnel creation failed, continuing without tunnel: ${sshError.message}`);
      }
    }

    // Get database schema for AI insights
    let schemaInfo = null;
    try {
      schemaInfo = await connectionManager.getSchema(connection.id);
      logger.info(`📋 Database schema retrieved: ${schemaInfo.tables.length} tables`);
    } catch (schemaError) {
      logger.warn(`⚠️ Schema retrieval failed: ${schemaError.message}`);
    }

    // Prepare result
    const result = {
      success: true,
      connectionId: connection.id,
      database: {
        type: validatedConfig.type,
        host: validatedConfig.host,
        port: validatedConfig.port,
        database: validatedConfig.database,
        username: validatedConfig.username,
        ssl: validatedConfig.ssl,
        sshTunnel: sshTunnelResult ? {
          enabled: true,
          localPort: sshTunnelResult.localPort,
          remoteHost: sshTunnelResult.remoteHost,
          remotePort: sshTunnelResult.remotePort,
          tunnelId: sshTunnelResult.tunnelId
        } : { enabled: false }
      },
      schema: schemaInfo ? {
        tableCount: schemaInfo.tables.length,
        totalColumns: schemaInfo.tables.reduce((sum, table) => sum + table.columns.length, 0),
        tables: schemaInfo.tables.map(table => ({
          name: table.name,
          type: table.type,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable
          }))
        }))
      } : null,
      metrics: {
        connectionTime: 'Connected successfully',
        maxConnections: validatedConfig.maxConnections,
        sslEnabled: validatedConfig.ssl,
        sshTunnelEnabled: !!sshTunnelResult
      },
      aiAdvice,
      nextSteps: [
        'Try: "Show me sample data from any table"',
        'Try: "What are the main tables in this database?"',
        'Try: "Generate a basic sales report"',
        'Try: "Analyze database performance"'
      ],
      capabilities: [
        'Natural language to SQL conversion',
        'Query execution with security validation',
        'Data visualization generation',
        'Database schema analysis',
        sshTunnelResult ? 'SSH tunneling for corporate access' : null
      ].filter(Boolean)
    };

    logger.info(`✅ Database connection successful: ${validatedConfig.name} (${connection.id})`);

    return result;

  } catch (error) {
    logger.error('❌ Database connection failed:', error);

    // Generate helpful error suggestions
    const suggestions = await generateConnectionErrorSuggestions(error, params.config);

    return {
      success: false,
      error: error.message,
      suggestions,
      troubleshooting: {
        commonIssues: [
          'Check if database server is running',
          'Verify network connectivity',
          'Validate credentials and permissions',
          'Check firewall settings',
          'Ensure SSL/TLS is properly configured'
        ],
        specificFixes: suggestions,
        errorType: this.getErrorType(error)
      }
    };
  }
}

/**
 * Generate error-specific suggestions
 */
async function generateConnectionErrorSuggestions(error: any, config: any): Promise<string[]> {
  const suggestions: string[] = [];

  // Error-specific suggestions
  if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
    suggestions.push('DNS resolution failed - check hostname spelling and DNS settings');
    suggestions.push('Try using IP address instead of hostname');
  }

  if (error.message.includes('ECONNREFUSED')) {
    suggestions.push('Connection refused - check if database is running');
    suggestions.push(`Verify port ${config.port || getDefaultPort(config.type)} is correct`);
    suggestions.push('Check if firewall is blocking the connection');
  }

  if (error.message.includes('auth') || error.message.includes('password')) {
    suggestions.push('Authentication failed - verify username and password');
    suggestions.push('Check if user has proper database permissions');
    suggestions.push('Ensure credentials are correctly encoded');
  }

  if (error.message.includes('SSL') || error.message.includes('TLS')) {
    suggestions.push('SSL/TLS error - check certificate configuration');
    suggestions.push('Verify database server SSL settings');
    suggestions.push('Try disabling SSL for testing (not recommended for production)');
  }

  if (error.message.includes('timeout')) {
    suggestions.push('Connection timeout - check network stability');
    suggestions.push('Increase connection timeout value');
    suggestions.push('Test database server response time');
  }

  // Database-specific suggestions
  if (config?.type === 'postgresql') {
    suggestions.push('Ensure pg_hba.conf allows connection from this IP');
    suggestions.push('Check if PostgreSQL is accepting connections (listen_addresses)');
  }

  if (config?.type === 'mysql') {
    suggestions.push('Check MySQL user permissions and host restrictions');
    suggestions.push('Verify MySQL server is accessible from this network');
  }

  if (config?.type === 'mongodb') {
    suggestions.push('Ensure MongoDB is running with authentication enabled');
    suggestions.push('Check MongoDB connection string format');
  }

  if (config?.type === 'redis') {
    suggestions.push('Verify Redis server is running and accessible');
    suggestions.push('Check Redis configuration for authentication');
  }

  // General suggestions
  suggestions.push('Test connection using database client tools');
  suggestions.push('Check database server logs for connection attempts');
  suggestions.push('Verify network connectivity using ping or telnet');

  return suggestions;
}

/**
 * Get error type from error
 */
function getErrorType(error: any): string {
  if (error.code === 'ENOTFOUND' || error.code === 'getaddrinfo') return 'dns_resolution';
  if (error.code === 'ECONNREFUSED') return 'connection_refused';
  if (error.code === 'ETIMEDOUT') return 'connection_timeout';
  if (error.code === 'EACCES') return 'permission_denied';
  if (error.code === 'ENETUNREACH') return 'network_unreachable';
  if (error.code === 'ENOTCONN') return 'not_connected';
  if (error.message.includes('auth')) return 'authentication';
  if (error.message.includes('SSL') || error.message.includes('TLS')) return 'ssl_tls';
  if (error.message.includes('timeout')) return 'timeout';
  return 'unknown';
}

export default connectDatabase;
