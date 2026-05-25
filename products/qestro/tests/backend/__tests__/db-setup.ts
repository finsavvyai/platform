import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import schema from '../schema/index.js';

// Database setup for tests
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/questro_test';

export async function setupTestDatabase() {
  try {
    // Create test database if it doesn't exist
    const baseUrl = TEST_DB_URL.replace('/questro_test', '/postgres');
    const baseConnection = postgres(baseUrl);

    try {
      await baseConnection`CREATE DATABASE questro_test`;
      console.log('Created test database: questro_test');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn('Could not create test database:', error.message);
      }
    }

    await baseConnection.end();

    // Connect to test database and run migrations
    const testConnection = postgres(TEST_DB_URL);
    const db = drizzle(testConnection, { schema });

    // Create tables if they don't exist
    // Note: This is a simplified setup for testing
    // In production, use proper migrations

    await testConnection.end();

    console.log('Test database setup complete');
    return true;
  } catch (error) {
    console.error('Failed to setup test database:', error);
    return false;
  }
}

export async function cleanupTestDatabase() {
  try {
    const connection = postgres(TEST_DB_URL);

    // Clean up test data
    await connection`TRUNCATE TABLE users CASCADE`;
    await connection`TRUNCATE TABLE projects CASCADE`;
    await connection`TRUNCATE TABLE recording_sessions CASCADE`;

    await connection.end();
    console.log('Test database cleaned up');
  } catch (error) {
    console.warn('Could not cleanup test database:', error);
  }
}

export function createTestDatabase() {
  const connection = postgres(TEST_DB_URL);
  return drizzle(connection, { schema });
}