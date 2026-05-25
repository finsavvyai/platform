import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { logger } from '../utils/logger.js';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Database connection configurations
const supabaseConfig = {
  host: process.env.SUPABASE_DB_HOST || 'localhost',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  username: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || '',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
};

const localConfig = {
  host: process.env.LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT || '5432'),
  database: process.env.LOCAL_DB_NAME || 'testflow_pro',
  username: process.env.LOCAL_DB_USER || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD || 'postgres',
  ssl: false,
};

// Choose configuration based on environment and availability
const getDatabaseConfig = () => {
  // In production, always use Supabase
  if (isProduction) {
    return supabaseConfig;
  }
  
  // In development, prefer Supabase if configured, otherwise local
  if (process.env.USE_SUPABASE === 'true' || process.env.SUPABASE_DB_PASSWORD) {
    logger.info('Using Supabase database configuration');
    return supabaseConfig;
  }
  
  logger.info('Using local database configuration');
  return localConfig;
};

const dbConfig = getDatabaseConfig();

// Create PostgreSQL connection
const connectionString = `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}${dbConfig.ssl ? '?sslmode=require' : ''}`;

let sql: postgres.Sql;
let db: ReturnType<typeof drizzle>;

try {
  sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: dbConfig.ssl,
  });
  
  db = drizzle(sql);
  logger.info('Database connection established successfully');
} catch (error) {
  logger.error('Failed to establish database connection:', error);
  throw error;
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Run database migrations
export async function runMigrations(): Promise<void> {
  try {
    logger.info('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database migration failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await sql.end();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
}

export { db, sql };
export default db;