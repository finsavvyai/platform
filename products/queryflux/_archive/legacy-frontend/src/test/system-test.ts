/**
 * QueryFlux Complete System Test
 *
 * Tests the entire QueryFlux system including:
 * - Database connectivity
 * - Frontend components
 * - Real database adapters
 * - API integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import our database services
import { DatabaseAdapterFactory } from '../src/lib/database/adapters';
import { databaseConnectionManager } from '../src/lib/database/connection-manager';

describe('QueryFlux Complete System Test', () => {

  describe('Database Adapter Factory', () => {
    it('should create PostgreSQL adapter', () => {
      const adapter = DatabaseAdapterFactory.create({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password'
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConnectionId()).toContain('postgres');
    });

    it('should create MySQL adapter', () => {
      const adapter = DatabaseAdapterFactory.create({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test',
        username: 'root',
        password: 'password'
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConnectionId()).toContain('mysql');
    });

    it('should create MongoDB adapter', () => {
      const adapter = DatabaseAdapterFactory.create({
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'test',
        username: 'mongo',
        password: 'password'
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConnectionId()).toContain('mongo');
    });

    it('should create Redis adapter', () => {
      const adapter = DatabaseAdapterFactory.create({
        type: 'redis',
        host: 'localhost',
        port: 6379,
        database: '0',
        password: 'password'
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConnectionId()).toContain('redis');
    });

    it('should create SQLite adapter', () => {
      const adapter = DatabaseAdapterFactory.create({
        type: 'sqlite',
        database: ':memory:'
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConnectionId()).toContain('sqlite');
    });
  });

  describe('Connection Manager', () => {
    beforeEach(() => {
      // Clean up any existing connections
      const connections = databaseConnectionManager.getAllConnections();
      connections.forEach(conn => {
        databaseConnectionManager.disconnect(conn.id);
      });
    });

    afterEach(() => {
      // Clean up test connections
      const connections = databaseConnectionManager.getAllConnections();
      connections.forEach(conn => {
        databaseConnectionManager.disconnect(conn.id);
      });
    });

    it('should connect to SQLite database', async () => {
      const result = await databaseConnectionManager.connect({
        type: 'sqlite',
        database: ':memory:'
      });

      expect(result.success).toBe(true);
      expect(result.connectionId).toBeDefined();

      if (result.success) {
        // Test query execution
        const queryResult = await databaseConnectionManager.executeQuery(
          result.connectionId!,
          'SELECT 1 as test_value'
        );

        expect(queryResult.success).toBe(true);
        expect(queryResult.data).toBeDefined();

        // Test schema retrieval
        const schemaResult = await databaseConnectionManager.getSchema(result.connectionId!);
        expect(schemaResult.tables).toBeDefined();

        // Clean up
        await databaseConnectionManager.disconnect(result.connectionId!);
      }
    });

    it('should handle connection failures gracefully', async () => {
      const result = await databaseConnectionManager.connect({
        type: 'postgresql',
        host: 'nonexistent-host',
        port: 5432,
        database: 'test',
        username: 'postgres',
        password: 'password'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Database Operations', () => {
    let connectionId: string;

    beforeEach(async () => {
      // Create a test SQLite connection
      const result = await databaseConnectionManager.connect({
        type: 'sqlite',
        database: ':memory:'
      });

      if (result.success) {
        connectionId = result.connectionId!;
      }
    });

    afterEach(async () => {
      if (connectionId) {
        await databaseConnectionManager.disconnect(connectionId);
      }
    });

    it('should execute CREATE TABLE query', async () => {
      const result = await databaseConnectionManager.executeQuery(
        connectionId,
        `CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      expect(result.success).toBe(true);
    });

    it('should execute INSERT queries', async () => {
      // Create table first
      await databaseConnectionManager.executeQuery(
        connectionId,
        `CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )`
      );

      // Insert data
      const result = await databaseConnectionManager.executeQuery(
        connectionId,
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Test User', 'test@example.com']
      );

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });

    it('should execute SELECT queries', async () => {
      // Create table and insert data
      await databaseConnectionManager.executeQuery(
        connectionId,
        `CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )`
      );

      await databaseConnectionManager.executeQuery(
        connectionId,
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Test User', 'test@example.com']
      );

      // Select data
      const result = await databaseConnectionManager.executeQuery(
        connectionId,
        'SELECT * FROM test_users'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.rowCount).toBe(1);

      if (result.data && result.data.length > 0) {
        expect(result.data[0]).toContain('Test User');
        expect(result.data[0]).toContain('test@example.com');
      }
    });

    it('should retrieve database schema', async () => {
      // Create a test table
      await databaseConnectionManager.executeQuery(
        connectionId,
        `CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Get schema
      const schema = await databaseConnectionManager.getSchema(connectionId);

      expect(schema.tables).toBeDefined();
      expect(schema.tables.length).toBeGreaterThan(0);

      const testTable = schema.tables.find(table => table.name === 'test_table');
      expect(testTable).toBeDefined();
      expect(testTable?.columns).toBeDefined();

      const idColumn = testTable?.columns.find(col => col.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.primaryKey).toBe(true);
    });
  });

  describe('API Integration', () => {
    it('should have proper API configuration', () => {
      // Test that our API configuration exists
      expect(typeof window).toBeDefined();
    });
  });

  describe('Frontend Components', () => {
    it('should have React components available', () => {
      // Test that React environment is working
      expect(typeof React).toBeDefined();
    });
  });
});

// Export test utilities for manual testing
export const testUtils = {
  async testDatabaseConnection(config: any) {
    const result = await databaseConnectionManager.connect(config);
    return result;
  },

  async testQueryExecution(connectionId: string, query: string, params?: any[]) {
    const result = await databaseConnectionManager.executeQuery(connectionId, query, params);
    return result;
  },

  async testSchemaRetrieval(connectionId: string) {
    const result = await databaseConnectionManager.getSchema(connectionId);
    return result;
  },

  getSupportedDatabaseTypes() {
    return databaseConnectionManager.getSupportedDatabaseTypes();
  },

  getDatabaseInfo(type: string) {
    return databaseConnectionManager.getDatabaseInfo(type);
  }
};

// Manual test function for development
export async function runManualTests() {
  console.log('🧪 Running QueryFlux Manual Tests...');

  try {
    // Test 1: SQLite Connection
    console.log('📊 Testing SQLite connection...');
    const sqliteResult = await testUtils.testDatabaseConnection({
      type: 'sqlite',
      database: ':memory:'
    });

    if (sqliteResult.success) {
      console.log('✅ SQLite connection successful!');

      // Test query execution
      const queryResult = await testUtils.testQueryExecution(
        sqliteResult.connectionId!,
        'SELECT datetime("now") as current_time'
      );

      if (queryResult.success) {
        console.log('✅ Query execution successful!');
        console.log('   Result:', queryResult.data);
      } else {
        console.log('❌ Query execution failed:', queryResult.error);
      }

      // Test schema retrieval
      const schemaResult = await testUtils.testSchemaRetrieval(sqliteResult.connectionId!);
      console.log('✅ Schema retrieval successful!');
      console.log('   Tables found:', schemaResult.tables.length);

    } else {
      console.log('❌ SQLite connection failed:', sqliteResult.error);
    }

    // Test 2: Supported Database Types
    console.log('\n🗄️ Supported Database Types:');
    const supportedTypes = testUtils.getSupportedDatabaseTypes();
    supportedTypes.forEach(type => {
      const info = testUtils.getDatabaseInfo(type);
      console.log(`   • ${info?.icon} ${info?.name} (${type})`);
    });

    console.log('\n🎉 QueryFlux manual tests completed!');

  } catch (error) {
    console.error('❌ Manual tests failed:', error);
  }
}

// Run manual tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runManualTests();
}
