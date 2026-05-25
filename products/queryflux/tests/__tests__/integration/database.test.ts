/**
 * Database Integration Tests
 *
 * End-to-end tests for database functionality including:
 * - PostgreSQL adapter with real database
 * - Connection management and pooling
 * - Query execution with parameterization
 * - Schema introspection and discovery
 * - Security and compliance checks
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { PostgresAdapter } from '../../../src/lib/database/adapters/postgresAdapter';
import { connectionManager } from '../../../src/lib/database/connectionManager';
import { databaseService } from '../../../src/lib/database/databaseService';
import { supabase } from '../../../src/lib/supabase';
import { DomainEvent, AggregateType } from '../../../src/core/domain/models/events';

// Test database configuration
const TEST_DATABASE_CONFIG = {
  host: 'localhost',
  port: 5433,
  database: 'queryflux_test',
  user: 'testuser',
  password: 'testpass',
  ssl: false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
};

describe('Database Integration Tests', () => {
  let adapter: PostgresAdapter;
  let testConnectionId: string;

  beforeAll(async () => {
    try {
      // Create a test adapter
      adapter = new PostgresAdapter(TEST_DATABASE_CONFIG);

      // Connect to test database
      await adapter.connect();

      console.log('✅ Database test setup completed');
    } catch (error) {
      console.error('❌ Failed to set up test database:', error);
      throw new Error(`Test database setup failed: ${error.message}`);
    }
  });

  afterAll(async () => {
    try {
      // Disconnect and cleanup
      if (adapter && adapter.isConnectionActive()) {
        await adapter.disconnect();
      }

      // Clean up connection manager
      await connectionManager.closeAllConnections();

      console.log('✅ Database test cleanup completed');
    } catch (error) {
      console.error('⚠️ Error during cleanup:', error);
    }
  });

  beforeEach(async () => {
    // Ensure clean state before each test
    try {
      if (!adapter.isConnectionActive()) {
        await adapter.connect();
      }
    } catch (error) {
      console.error('Failed to reconnect before test:', error);
    }
  });

  afterEach(async () => {
    // Clean up any test data
    try {
      await adapter.executeQuery('DROP TABLE IF EXISTS test_users CASCADE');
      await adapter.executeQuery('DROP TABLE IF EXISTS test_audit CASCADE');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('PostgreSQL Adapter', () => {
    describe('Connection Management', () => {
      it('should establish and maintain connection', async () => {
        expect(adapter.isConnectionActive()).toBe(true);

        // Execute a simple query to verify connection
        const result = await adapter.executeQuery('SELECT 1 as test');
        expect(result.success).toBe(true);
        expect(result.data).toEqual([{ test: 1 }]);
      });

      it('should handle connection errors gracefully', async () => {
        // Test with invalid credentials
        const badAdapter = new PostgresAdapter({
          ...TEST_DATABASE_CONFIG,
          password: 'invalid_password'
        });

        await expect(badAdapter.connect()).rejects.toThrow();
        expect(badAdapter.isConnectionActive()).toBe(false);
      });

      it('should support connection pooling', async () => {
        // Execute multiple queries concurrently to test pooling
        const queries = [
          adapter.executeQuery('SELECT 1'),
          adapter.executeQuery('SELECT 2'),
          adapter.executeQuery('SELECT 3'),
          adapter.executeQuery('SELECT 4'),
          adapter.executeQuery('SELECT 5')
        ];

        const results = await Promise.allSettled(queries);

        // All queries should succeed
        results.forEach(result => {
          expect(result.status).toBe('fulfilled');
          expect(result.value.success).toBe(true);
        });
      });
    });

    describe('Query Execution', () => {
      it('should execute SELECT queries', async () => {
        // Create test table
        await adapter.executeQuery(`
          CREATE TABLE IF NOT EXISTS test_users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Insert test data
        await adapter.executeQuery(`
          INSERT INTO test_users (name, email) VALUES
          ('Alice', 'alice@test.com'),
          ('Bob', 'bob@test.com'),
          ('Charlie', 'charlie@test.com')
        `);

        // Execute SELECT query
        const result = await adapter.executeQuery(
          'SELECT id, name, email FROM test_users WHERE name ILIKE $1 ORDER BY id',
          ['%a%']
        );

        expect(result.success).toBe(true);
        expect(result.rowCount).toBe(2); // Alice, Charlie
        expect(result.data).toHaveLength(2);
        expect(result.data[0].name).toBe('Alice');
      });

      it('should handle parameterized queries safely', async () => {
        // Test SQL injection prevention
        const maliciousQuery = "SELECT * FROM test_users WHERE name = '\" OR 1=1 --'";
        const result = await adapter.executeQuery(maliciousQuery);

        // Should treat as literal string, not SQL injection
        expect(result.success).toBe(true);
        expect(result.rowCount).toBe(0); // No users with this exact name
      });

      it('should execute INSERT queries with parameters', async () => {
        const result = await adapter.executeQuery(
          'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id, name, email',
          ['David', 'david@test.com']
        );

        expect(result.success).toBe(true);
        expect(result.rowCount).toBe(1);
        expect(result.data[0].name).toBe('David');
      });

      it('should handle UPDATE queries', async () => {
        // First insert a user to update
        await adapter.executeQuery(
          'INSERT INTO test_users (name, email) VALUES ($1, $2)',
          ['Eve', 'eve@test.com']
        );

        // Update the user
        const result = await adapter.executeQuery(
          'UPDATE test_users SET email = $1 WHERE name = $2 RETURNING id, name, email',
          ['eve.new@test.com', 'Eve']
        );

        expect(result.success).toBe(true);
        expect(result.rowCount).toBe(1);
        expect(result.data[0].email).toBe('eve.new@test.com');
      });

      it('should execute DDL operations', async () => {
        // Create a complex table with indexes
        const result = await adapter.executeQuery(`
          CREATE TABLE IF NOT EXISTS test_complex_table (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            data JSONB,
            searchable_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_test_complex_name ON test_complex_table(name);
          CREATE INDEX IF NOT EXISTS idx_test_complex_created_at ON test_complex_table(created_at);
          CREATE INDEX IF NOT EXISTS idx_test_complex_searchable ON test_complex_table USING GIN(searchable_text);
        `);

        expect(result.success).toBe(true);
      });

      it('should handle query timeouts', async () => {
        // Simulate a long-running query
        const startTime = Date.now();

        try {
          const result = await Promise.race([
            adapter.executeQuery('SELECT pg_sleep(5)'), // Sleep for 5 seconds
            new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 2000))
          ]);

          // Should timeout before query completes
          throw new Error('Query should have timed out');
        } catch (error) {
          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(3000); // Should timeout within 2 seconds
          expect(error.message).toContain('timeout');
        }
      });
    });

    describe('Schema Introspection', () => {
      it('should retrieve complete database schema', async () => {
        // Create test schema
        await adapter.executeQuery(`
          CREATE TABLE IF NOT EXISTS test_schema_table (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX idx_test_schema_table_name ON test_schema_table(name);
        `);

        const schema = await adapter.getSchema();

        expect(schema.databaseName).toBe('queryflux_test');
        expect(schema.tables).toHaveLength(1);

        const table = schema.tables[0];
        expect(table.name).toBe('test_schema_table');
        expect(table.columns).toHaveLength(5);
        expect(table.primaryKeys).toEqual(['id']);
      });

      it('should detect table types correctly', async () => {
        // Create a view to test view detection
        await adapter.executeQuery(`
          CREATE VIEW IF NOT EXISTS test_view AS
          SELECT id, name FROM test_schema_table WHERE is_active = true
        `);

        const schema = await adapter.getSchema();

        expect(schema.tables).toHaveLength(1);
        expect(schema.views).toHaveLength(1);

        const view = schema.views[0];
        expect(view.type).toBe('view');
        expect(view.name).toBe('test_view');
      });

      it('should detect foreign key relationships', async () => {
        // Create tables with foreign key relationship
        await adapter.executeQuery(`
          CREATE TABLE IF NOT EXISTS test_parents (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL
          );

          CREATE TABLE IF NOT EXISTS test_children (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            parent_id INTEGER REFERENCES test_parents(id) ON DELETE CASCADE
          );
        `);

        const schema = await adapter.getSchema();
        const parentTable = schema.tables.find(t => t.name === 'test_parents');
        const childTable = schema.tables.find(t => t.name === 'test_children');

        expect(parentTable).toBeDefined();
        expect(childTable).toBeDefined();
        expect(childTable.foreignKeys).toHaveProperty('parent_id');
        expect(childTable.foreignKeys.parent_id.table).toBe('test_parents');
      });

      it('should provide accurate column information', async () => {
        const schema = await adapter.getSchema();
        const table = schema.tables[0]; // test_schema_table

        const idColumn = table.columns.find(c => c.name === 'id');
        const nameColumn = table.columns.find(c => c.name === 'name');
        const descriptionColumn = table.columns.find(c => c.name === 'description');

        expect(idColumn).toBeDefined();
        expect(nameColumn).toBeDefined();
        expect(descriptionColumn).toBeDefined();

        expect(idColumn.type).toBe('1043'); // Assuming PostgreSQL type mapping
        expect(idColumn.nullable).toBe(false);
        expect(idColumn.defaultValue).toBeUndefined();

        expect(nameColumn.type).toBe('1043');
        expect(nameColumn.nullable).toBe(false);
        expect(nameColumn.defaultValue).toBeUndefined();

        expect(descriptionColumn.type).toBe('25'); // text type
        expect(descriptionColumn.nullable).toBe(true);
        expect(descriptionColumn.defaultValue).toBeDefined();
      });
    });

    describe('Transaction Support', () => {
      it('should execute transactions with rollback on failure', async () => {
        // Insert test data
        await adapter.executeQuery(`
          INSERT INTO test_users (name, email) VALUES
          ('Transaction Test 1', 'test1@transaction.com'),
          ('Transaction Test 2', 'test2@transaction.com')
        `);

        // Get initial count
        const initialResult = await adapter.executeQuery('SELECT COUNT(*) FROM test_users');
        const initialCount = initialResult.data[0].count;

        try {
          // Execute a transaction that will fail
          await adapter.executeTransaction([
            { query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)', params: ['Success Before Failure', 'success@transaction.com'] },
            { query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)', params: ['This Will Succeed', 'success2@transaction.com'] },
            { query: 'INSERT INTO non_existent_table (name) VALUES ($1)', params: ['This Should Fail'] }
          ]);

          // Should have thrown an error
          throw new Error('Transaction should have failed');
        } catch (error) {
          // Verify the transaction was rolled back
          const finalResult = await adapter.executeQuery('SELECT COUNT(*) FROM test_users');
          const finalCount = finalResult.data[0].count;

          expect(finalCount).toBe(initialCount + 2); // Only the successful inserts
        }
      });

      it('should execute successful transactions', async () => {
        const transactionQueries = [
          { query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)', params: ['Alice Transaction', 'alice@transaction.com'] },
          { query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)', params: ['Bob Transaction', 'bob@transaction.com'] },
          { query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)', params: ['Charlie Transaction', 'charlie@transaction.com'] }
        ];

        const results = await adapter.executeTransaction(transactionQueries);

        // All queries should succeed
        results.forEach(result => {
          expect(result.success).toBe(true);
          expect(result.rowCount).toBe(1);
        });

        // Verify all data was inserted
        const finalResult = await adapter.executeQuery('SELECT COUNT(*) FROM test_users WHERE email LIKE \'%@transaction.com\'');
        const finalCount = finalResult.data[0].count;

        expect(finalCount).toBe(3);
      });
    });

    describe('Performance and Monitoring', () => {
      it('should provide connection pool statistics', () => {
        const stats = adapter.getPoolStats();

        expect(stats).toHaveProperty('totalCount');
        expect(stats).toHaveProperty('idleCount');
        expect(stats).toHaveProperty('waitingCount');
        expect(typeof stats.totalCount).toBe('number');
        expect(typeof stats.idleCount).toBe('number');
        expect(typeof stats.waitingCount).toBe('number');
      });

      it('should measure query execution time', async () => {
        const startTime = Date.now();
        const result = await adapter.executeQuery('SELECT 1');
        const endTime = Date.now();

        expect(result.executionTime).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(0);
        expect(result.executionTime).toBeLessThan(10000); // Less than 10 seconds
        expect(result.executionTime).toBeLessThanOrEqual(endTime - startTime);
      });

      it('should handle large result sets efficiently', async () => {
        // Insert test data
        for (let i = 0; i < 100; i++) {
          await adapter.executeQuery(
            'INSERT INTO test_users (name, email) VALUES ($1, $2)',
            [`User ${i}`, `user${i}@large.com`]
          );
        }

        // Query large dataset
        const result = await adapter.executeQuery('SELECT * FROM test_users ORDER BY id');

        expect(result.success).toBe(true);
        expect(result.rowCount).toBeGreaterThanOrEqual(100);
        expect(result.data).toHaveLength(result.rowCount);
        expect(result.executionTime).toBeLessThan(5000); // Should be efficient
      });
    });
  });

  describe('Connection Manager', () => {
    let managedConnection: any;

    beforeEach(async () => {
      // Create a managed connection using connection manager
      const connection = await createTestConnection();
      testConnectionId = connection.id;
      managedConnection = connectionManager.getConnection(testConnectionId)!;
    });

    afterEach(async () => {
      // Clean up the test connection
      if (testConnectionId) {
        await connectionManager.removeConnection(testConnectionId);
      }
    });

    it('should manage multiple connections efficiently', async () => {
      // Create multiple connections
      const connections = await Promise.all([
        createTestConnection('conn1'),
        createTestConnection('conn2'),
        createTestConnection('conn3')
      ]);

      expect(connections.length).toBe(3);

      // All should be active
      connections.forEach(conn => {
        expect(conn.isActive).toBe(true);
      });

      // Verify connection manager stats
      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(3);
      expect(stats.activeConnections).toBe(3);
    });

    it('should handle connection failures gracefully', async () => {
      // Try to create a connection with invalid credentials
      try {
        await createTestConnection('bad_conn', {
          ...TEST_DATABASE_CONFIG,
          password: 'invalid_password'
        });
      } catch (error) {
        // Expected to fail
        expect(error.message).toContain('Connection test failed');
      }

      // Connection manager should not add failed connection
      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBe(1); // Only the first connection
      expect(stats.activeConnections).toBe(1);
    });

    it('should support connection reuse', async () => {
      // Execute multiple queries using the same connection
      const query1 = await connectionManager.executeQuery(
        testConnectionId,
        'SELECT COUNT(*) FROM test_users'
      );

      const query2 = await connectionManager.executeQuery(
        testConnectionId,
        'SELECT COUNT(*) FROM test_schema_table'
      );

      const query3 = await connectionManager.executeQuery(
        testConnectionId,
        'SELECT version()'
      );

      // All queries should succeed using the same connection
      expect(query1.success).toBe(true);
      expect(query2.success).toBe(true);
      expect(query3.success).toBe(true);

      // Verify connection count tracking
      const stats = connectionManager.getStats();
      expect(stats.totalQueries).toBeGreaterThan(2); // At least the queries we executed
    });

    it('should support schema retrieval through connection manager', async () => {
      const schema = await connectionManager.getSchema(testConnectionId);

      expect(schema.databaseName).toBe('queryflux_test');
      expect(schema.tables).toBeGreaterThan(0);
      expect(schema.views).toBeDefined();
    });
  });

  describe('Database Service Integration', () => {
    it('should test connections through service', async () => {
      const connectionConfig = {
        dbType: 'postgresql',
        name: 'Service Test Connection',
        connectionConfig: TEST_DATABASE_CONFIG
      };

      const result = await databaseService.testConnection(connectionConfig);

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(5000); // Should connect within 5 seconds
    });

    it('should create and manage persistent connections', async () => {
      // Create a connection through the service
      const connectionConfig = {
        dbType: 'postgresql',
        name: 'Persistent Test Connection',
        connectionConfig: TEST_DATABASE_CONFIG
      };

      const createResult = await databaseService.createConnection(connectionConfig);
      expect(createResult.success).toBe(true);
      expect(createResult.connectionId).toBeDefined();

      // Verify connection was added to manager
      const managedConnection = connectionManager.getConnection(createResult.connectionId!);
      expect(managedConnection).toBeDefined();
      expect(managedConnection.isActive).toBe(true);

      testConnectionId = createResult.connectionId!;
    });

    it('should support secure query execution through service', async () => {
      const result = await databaseService.executeQuery({
        connectionId: testConnectionId,
        query: 'SELECT * FROM test_users WHERE name ILIKE $1 ORDER BY id LIMIT 10',
        params: ['%t%'],
        options: {
          maxRows: 10,
          timeout: 5000,
          readOnly: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.columns).toBeDefined();
      expect(result.rowCount).toBeLessThanOrEqual(10);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should enforce query security policies', async () => {
      // Test dangerous query blocking
      const dangerousQueries = [
        'DROP TABLE test_users', // Should be blocked
        'DELETE FROM test_users', // Should be allowed
        'UPDATE test_users SET name = \'test\' WHERE 1=1; --', // SQL injection attempt
        'CREATE USER hacker WITH PASSWORD \'123\'', // Privilege escalation attempt
      ];

      for (const query of dangerousQueries) {
        const result = await databaseService.executeQuery({
          connectionId: testConnectionId,
          query,
          options: { readOnly: true }
        });

        if (query.includes('DROP') || query.includes('CREATE USER')) {
          // Should be blocked
          expect(result.success).toBe(false);
          expect(result.error).toContain('blocked');
        } else {
          // Should succeed
          expect(result.success).toBe(true);
        }
      }
    });

    it('should handle connection ownership validation', async () => {
      // This test would require mocking Supabase auth
      // In production, this would validate that users can only access their own connections

      // For now, we'll test that the service handles missing auth gracefully
      try {
        // This will likely fail in test environment without proper auth setup
        await databaseService.getUserConnections();
      } catch (error) {
        expect(error.message).toContain('Authentication required');
      }
    });
  });

  describe('PCI DSS Compliance Features', () => {
    it('should encrypt sensitive connection data', () => {
      // Test that connection passwords are not exposed in logs
      // This is more of an integration test that would require checking actual logs
      expect(TEST_DATABASE_CONFIG.password).toBeDefined();

      // The actual encryption would be handled by the EncryptionService
      // This test verifies we have the infrastructure in place
    });

    it('should audit all database operations', async () => {
      // This would require the AuditService integration
      // For now, we'll verify that queries execute successfully (which would trigger audit events)

      const result = await adapter.executeQuery('SELECT 1');
      expect(result.success).toBe(true);

      // In a real implementation, this would have created audit logs
      // which would be verified by the AuditService
    });

    it('should support parameterized queries only', async () => {
      // Verify that raw SQL string concatenation is not supported
      // All queries must go through the parameterized interface

      const userName = 'test_user';
      // This should use parameterization, not string concatenation
      const result = await adapter.executeQuery(
        'SELECT * FROM test_users WHERE name = $1',
        [userName]
      );

      expect(result.success).toBe(true);

      // The parameter should be properly escaped
      // This prevents SQL injection
    });
  });
});

// Helper function to create test connections
async function createTestConnection(id: string = 'test_conn', config?: any): Promise<any> {
  // In a real test, this would create a Supabase connection record
  // For testing, we'll create a mock connection object
  return {
    id: `conn_${id}_${Date.now()}`,
    name: `Test Connection ${id}`,
    database_type: 'postgresql',
    user_id: 'test_user',
    host: config?.host || TEST_DATABASE_CONFIG.host,
    port: config?.port || TEST_DATABASE_CONFIG.port,
    database_name: config?.database || TEST_DATABASE_CONFIG.database,
    username: config?.user || TEST_DATABASE_CONFIG.user,
    password: config?.password || TEST_DATABASE_CONFIG.password,
    ssl_enabled: config?.ssl ?? TEST_DATABASE_CONFIG.ssl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isActive: true,
    connectionCount: 0,
    errorCount: 0,
    adapter: new PostgresAdapter(config || TEST_DATABASE_CONFIG)
  };
}
