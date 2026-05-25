import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';
import { connectionPoolManager } from '../services/ConnectionPoolManager.js';
import { logger } from '../utils/logger.js';

let connection: postgres.Sql;
let db: ReturnType<typeof drizzle<typeof schema>>;

// Enhanced connection configuration with pooling
const createMainDatabaseConnection = () => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.USE_SUPABASE === 'true';

  if (isProduction) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    connection = postgres(connectionString, {
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
      prepare: false, // Disable prepared statements for better connection reuse
      onnotice: () => { }, // Suppress notices
    });
  } else {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432');
    const database = process.env.DB_NAME || 'questro_dev';
    const username = process.env.DB_USER || '';
    const password = process.env.DB_PASSWORD || '';

    connection = postgres({
      host,
      port,
      database,
      username,
      password,
      ssl: false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
      prepare: false,
      onnotice: () => { },
    });
  }

  db = drizzle(connection, { schema });
  logger.info('Main database connection established with enhanced pooling');
};

// Initialize main database connection (with error handling)
try {
  createMainDatabaseConnection();
} catch (error) {
  logger.error('Failed to initialize database connection:', error);
  logger.warn('Server will start without database connection. Database-dependent features will be unavailable.');
}

// Enhanced connection health monitoring
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await connection`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Main database health check failed:', error);
    return false;
  }
};

// Enhanced connection metrics
export const getDatabaseMetrics = () => {
  return {
    totalConnections: connection.options.max,
    connectionString: connection.options.host ?
      `${connection.options.host}:${connection.options.port}/${connection.options.database}` :
      'connection_string_provided',
    ssl: !!connection.options.ssl,
    idleTimeout: connection.options.idle_timeout,
    connectTimeout: connection.options.connect_timeout,
  };
};

// Graceful shutdown with enhanced cleanup
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    logger.info('Closing main database connection...');

    // Close connection pool manager first
    await connectionPoolManager.closeAllPools();

    // Then close main connection
    await connection.end();

    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

// Enhanced connection retry logic
export const reconnectDatabase = async (retries: number = 3): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Database reconnection attempt ${attempt}/${retries}`);

      // Close existing connection
      if (connection) {
        await connection.end();
      }

      // Create new connection
      createMainDatabaseConnection();

      // Test connection
      const isHealthy = await checkDatabaseHealth();
      if (isHealthy) {
        logger.info('Database reconnection successful');
        return;
      }

      throw new Error('Health check failed after reconnection');

    } catch (error) {
      logger.error(`Database reconnection attempt ${attempt} failed:`, error);

      if (attempt === retries) {
        throw new Error(`Failed to reconnect to database after ${retries} attempts`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Connection monitoring and auto-recovery
let healthCheckInterval: NodeJS.Timeout | null = null;

export const startConnectionMonitoring = (intervalMs: number = 60000) => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    try {
      const isHealthy = await checkDatabaseHealth();
      if (!isHealthy) {
        logger.warn('Database connection unhealthy, attempting reconnection...');
        await reconnectDatabase();
      }
    } catch (error) {
      logger.error('Database monitoring error:', error);
    }
  }, intervalMs);

  logger.info(`Database connection monitoring started (interval: ${intervalMs}ms)`);
};

export const stopConnectionMonitoring = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Database connection monitoring stopped');
  }
};

// Start monitoring in production
if (process.env.NODE_ENV === 'production') {
  startConnectionMonitoring();
}

// Enhanced database pool configuration helper
export const createDatabasePool = async (config: {
  id: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  healthCheckInterval?: number;
}) => {
  try {
    await connectionPoolManager.createPool({
      ...config,
      maxConnections: config.maxConnections || 20,
      connectionTimeout: config.connectionTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000,
      healthCheckInterval: config.healthCheckInterval || 60000,
      retryAttempts: 3,
      retryDelay: 5000
    });

    logger.info(`Database pool created successfully: ${config.id}`);
  } catch (error) {
    logger.error(`Failed to create database pool ${config.id}:`, error);
    throw error;
  }
};

export { db, connection };
export default db;