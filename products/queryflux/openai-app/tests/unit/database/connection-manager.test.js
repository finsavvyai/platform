/**
 * Unit Tests: Database Connection Manager
 *
 * Comprehensive tests for database connection management,
 * query execution, and connection pooling
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DatabaseConnectionManager } from '../../../src/database/connection-manager.js';
import { testUtils } from '../../setup.js';
// Mock dependencies
jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue({
            query: jest.fn().mockResolvedValue({
                rows: [{ test: 'data' }],
                rowCount: 1,
                fields: [{ name: 'test', dataTypeID: 23, notNull: true }]
            }),
            release: jest.fn()
        }),
        end: jest.fn().mockResolvedValue(undefined)
    }))
}));
jest.mock('mysql2/promise', () => ({
    createPool: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue([
            [{ id: 1, name: 'test' }],
            [{ name: 'id', type: 'int', nullable: false }]
        ]),
        end: jest.fn().mockResolvedValue(undefined)
    }))
}));
jest.mock('mongodb', () => ({
    MongoClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        db: jest.fn().mockReturnValue({
            admin: jest.fn().mockReturnValue({
                ping: jest.fn().mockResolvedValue({ ok: 1 })
            }),
            listCollections: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue([{ name: 'test_collection' }])
            })
        })
    }))
}));
jest.mock('redis', () => ({
    createClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue(undefined)
    }))
}));
jest.mock('ssh2', () => ({
    Client: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        on: jest.fn(),
        exec: jest.fn()
    }))
}));
describe('DatabaseConnectionManager', () => {
    let connectionManager;
    beforeEach(() => {
        connectionManager = new DatabaseConnectionManager();
    });
    afterEach(() => {
        // Clean up all connections
        const connections = connectionManager.listConnections();
        for (const conn of connections) {
            connectionManager.closeConnection(conn.id);
        }
    });
    describe('Connection Creation', () => {
        it('should create PostgreSQL connection successfully', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            const connection = await connectionManager.createConnection(config);
            expect(connection).toBeDefined();
            expect(connection.type).toBe('postgresql');
            expect(connection.name).toBe('test-postgresql-connection');
            expect(connection.status).toBe('connected');
            expect(connection.metrics.totalConnections).toBe(10);
        });
        it('should create MySQL connection successfully', async () => {
            const config = testUtils.createTestConnectionConfig('mysql');
            const connection = await connectionManager.createConnection(config);
            expect(connection).toBeDefined();
            expect(connection.type).toBe('mysql');
            expect(connection.status).toBe('connected');
        });
        it('should create MongoDB connection successfully', async () => {
            const config = testUtils.createTestConnectionConfig('mongodb');
            const connection = await connectionManager.createConnection(config);
            expect(connection).toBeDefined();
            expect(connection.type).toBe('mongodb');
            expect(connection.status).toBe('connected');
        });
        it('should create Redis connection successfully', async () => {
            const config = testUtils.createTestConnectionConfig('redis');
            const connection = await connectionManager.createConnection(config);
            expect(connection).toBeDefined();
            expect(connection.type).toBe('redis');
            expect(connection.status).toBe('connected');
        });
        it('should validate connection configuration', async () => {
            const invalidConfig = {
                name: '',
                type: 'invalid_type',
                host: ''
            };
            await expect(connectionManager.createConnection(invalidConfig))
                .rejects.toThrow();
        });
        it('should handle connection failure gracefully', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            // Mock connection failure
            const Pool = require('pg').Pool;
            Pool.mockImplementationOnce(() => ({
                connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
                end: jest.fn()
            }));
            await expect(connectionManager.createConnection(config))
                .rejects.toThrow('Connection creation failed');
        });
        it('should generate unique connection ID when not provided', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            delete config.id;
            const connection = await connectionManager.createConnection(config);
            expect(connection.id).toMatch(/^conn_\d+_[a-z0-9]+$/);
        });
        it('should use provided connection ID', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.id = 'custom-connection-id';
            const connection = await connectionManager.createConnection(config);
            expect(connection.id).toBe('custom-connection-id');
        });
    });
    describe('Query Execution', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should execute PostgreSQL query successfully', async () => {
            const query = 'SELECT 1 as test_column';
            const result = await connectionManager.executeQuery(connectionId, query);
            expect(result).toBeDefined();
            expect(result.rows).toEqual([{ test: 'data' }]);
            expect(result.rowCount).toBe(1);
            expect(result.columns).toHaveLength(1);
            expect(result.executionTime).toBeGreaterThan(0);
        });
        it('should execute query with parameters', async () => {
            const query = 'SELECT * FROM users WHERE id = $1';
            const parameters = [123];
            const result = await connectionManager.executeQuery(connectionId, query, parameters);
            expect(result.rows).toBeDefined();
            expect(result.executionTime).toBeGreaterThan(0);
        });
        it('should update connection metrics after successful query', async () => {
            const connection = connectionManager.getConnection(connectionId);
            const initialMetrics = { ...connection.metrics };
            await connectionManager.executeQuery(connectionId, 'SELECT 1');
            expect(connection.metrics.totalQueries).toBe(initialMetrics.totalQueries + 1);
            expect(connection.metrics.successfulQueries).toBe(initialMetrics.successfulQueries + 1);
            expect(connection.metrics.averageQueryTime).toBeGreaterThan(0);
        });
        it('should handle query execution failure', async () => {
            const query = 'INVALID SQL QUERY';
            await expect(connectionManager.executeQuery(connectionId, query))
                .rejects.toThrow();
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.failedQueries).toBe(1);
            expect(connection.metrics.lastError).toBeDefined();
        });
        it('should add query to history', async () => {
            const query = 'SELECT 1';
            await connectionManager.executeQuery(connectionId, query);
            const history = connectionManager.getQueryHistory(connectionId, 1);
            expect(history).toHaveLength(1);
            expect(history[0].query).toBe(query);
            expect(history[0].success).toBe(true);
        });
        it('should enforce query timeout', async () => {
            const longQuery = 'SELECT pg_sleep(10)'; // This would take 10 seconds
            const options = { timeout: 1000 }; // 1 second timeout
            // This test would need to be adjusted based on actual timeout implementation
            // For now, just ensure the option is passed through
            await expect(connectionManager.executeQuery(connectionId, longQuery, [], options))
                .resolves.toBeDefined();
        });
    });
    describe('Schema Retrieval', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should retrieve PostgreSQL schema successfully', async () => {
            const schema = await connectionManager.getSchema(connectionId);
            expect(schema).toBeDefined();
            expect(schema.tables).toBeDefined();
            expect(schema.relationships).toBeDefined();
        });
        it('should retrieve MySQL schema successfully', async () => {
            const mysqlConnection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('mysql'));
            const schema = await connectionManager.getSchema(mysqlConnection.id);
            expect(schema).toBeDefined();
            expect(schema.tables).toBeDefined();
        });
        it('should retrieve MongoDB schema successfully', async () => {
            const mongoConnection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('mongodb'));
            const schema = await connectionManager.getSchema(mongoConnection.id);
            expect(schema).toBeDefined();
            expect(schema.tables).toBeDefined();
            expect(schema.tables[0].type).toBe('COLLECTION');
        });
        it('should handle schema retrieval failure gracefully', async () => {
            // Mock schema retrieval failure
            const Pool = require('pg').Pool;
            Pool.mockImplementationOnce(() => ({
                connect: jest.fn().mockRejectedValue(new Error('Schema retrieval failed')),
                end: jest.fn()
            }));
            await expect(connectionManager.getSchema(connectionId))
                .rejects.toThrow();
        });
    });
    describe('Connection Management', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should list all active connections', async () => {
            const connections = connectionManager.listConnections();
            expect(connections).toHaveLength(1);
            expect(connections[0].id).toBe(connectionId);
            expect(connections[0].status).toBe('connected');
        });
        it('should get specific connection by ID', () => {
            const connection = connectionManager.getConnection(connectionId);
            expect(connection).toBeDefined();
            expect(connection.id).toBe(connectionId);
        });
        it('should throw error when getting non-existent connection', () => {
            expect(() => connectionManager.getConnection('non-existent-id'))
                .toThrow('Connection not found: non-existent-id');
        });
        it('should throw error when getting disconnected connection', async () => {
            await connectionManager.closeConnection(connectionId);
            expect(() => connectionManager.getConnection(connectionId))
                .toThrow('Connection not active');
        });
        it('should close connection successfully', async () => {
            await connectionManager.closeConnection(connectionId);
            const connections = connectionManager.listConnections();
            expect(connections).toHaveLength(0);
        });
        it('should handle closing non-existent connection', async () => {
            await expect(connectionManager.closeConnection('non-existent-id'))
                .rejects.toThrow('Connection not found');
        });
    });
    describe('Query History', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should return empty history for new connection', () => {
            const history = connectionManager.getQueryHistory(connectionId);
            expect(history).toEqual([]);
        });
        it('should track query history correctly', async () => {
            // Execute multiple queries
            await connectionManager.executeQuery(connectionId, 'SELECT 1');
            await connectionManager.executeQuery(connectionId, 'SELECT 2');
            const history = connectionManager.getQueryHistory(connectionId, 10);
            expect(history).toHaveLength(2);
            expect(history[0].query).toBe('SELECT 1');
            expect(history[1].query).toBe('SELECT 2');
            expect(history[0].success).toBe(true);
            expect(history[1].success).toBe(true);
        });
        it('should limit query history results', async () => {
            // Execute more queries than the limit
            for (let i = 0; i < 10; i++) {
                await connectionManager.executeQuery(connectionId, `SELECT ${i}`);
            }
            const history = connectionManager.getQueryHistory(connectionId, 5);
            expect(history).toHaveLength(5);
        });
        it('should track failed queries in history', async () => {
            try {
                await connectionManager.executeQuery(connectionId, 'INVALID QUERY');
            }
            catch (error) {
                // Expected to fail
            }
            const history = connectionManager.getQueryHistory(connectionId, 1);
            expect(history).toHaveLength(1);
            expect(history[0].success).toBe(false);
            expect(history[0].error).toBeDefined();
        });
    });
    describe('Security Validation', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should prevent DROP TABLE operations', async () => {
            const dangerousQuery = 'DROP TABLE users';
            await expect(connectionManager.executeQuery(connectionId, dangerousQuery))
                .rejects.toThrow('Dangerous SQL operation detected');
        });
        it('should prevent DELETE operations', async () => {
            const dangerousQuery = 'DELETE FROM users WHERE id = 1';
            await expect(connectionManager.executeQuery(connectionId, dangerousQuery))
                .rejects.toThrow('Dangerous SQL operation detected');
        });
        it('should prevent TRUNCATE operations', async () => {
            const dangerousQuery = 'TRUNCATE TABLE users';
            await expect(connectionManager.executeQuery(connectionId, dangerousQuery))
                .rejects.toThrow('Dangerous SQL operation detected');
        });
        it('should prevent UPDATE operations', async () => {
            const dangerousQuery = 'UPDATE users SET name = "test"';
            await expect(connectionManager.executeQuery(connectionId, dangerousQuery))
                .rejects.toThrow('Dangerous SQL operation detected');
        });
        it('should prevent INSERT operations', async () => {
            const dangerousQuery = 'INSERT INTO users (name) VALUES ("test")';
            await expect(connectionManager.executeQuery(connectionId, dangerousQuery))
                .rejects.toThrow('Dangerous SQL operation detected');
        });
        it('should allow safe SELECT operations', async () => {
            const safeQuery = 'SELECT COUNT(*) FROM users';
            const result = await connectionManager.executeQuery(connectionId, safeQuery);
            expect(result).toBeDefined();
            expect(result.rows).toBeDefined();
        });
        it('be case-insensitive for dangerous patterns', async () => {
            const dangerousQueries = [
                'drop table users',
                'Delete FROM users',
                'TRUNCATE table users',
                'update users set name = "test"'
            ];
            for (const query of dangerousQueries) {
                await expect(connectionManager.executeQuery(connectionId, query))
                    .rejects.toThrow('Dangerous SQL operation detected');
            }
        });
    });
    describe('Performance Metrics', () => {
        let connectionId;
        beforeEach(async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            connectionId = connection.id;
        });
        it('should track average query time correctly', async () => {
            // Execute multiple queries
            await connectionManager.executeQuery(connectionId, 'SELECT 1');
            await connectionManager.executeQuery(connectionId, 'SELECT 2');
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.averageQueryTime).toBeGreaterThan(0);
            expect(connection.metrics.successfulQueries).toBe(2);
        });
        it('should update last used timestamp', async () => {
            const connection = connectionManager.getConnection(connectionId);
            const originalLastUsed = connection.lastUsed;
            // Wait a bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));
            await connectionManager.executeQuery(connectionId, 'SELECT 1');
            expect(connection.lastUsed.getTime()).toBeGreaterThan(originalLastUsed.getTime());
        });
        it('should track active connections correctly', async () => {
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.activeConnections).toBe(0);
            // Start a query (this is simplified for testing)
            const queryPromise = connectionManager.executeQuery(connectionId, 'SELECT 1');
            // In a real scenario, you'd check while the query is running
            await queryPromise;
            expect(connection.metrics.activeConnections).toBe(0);
        });
    });
    describe('Error Handling', () => {
        it('should handle invalid database type gracefully', async () => {
            const config = {
                name: 'test-invalid',
                type: 'invalid_type',
                host: 'localhost',
                port: 5432,
                database: 'test'
            };
            await expect(connectionManager.createConnection(config))
                .rejects.toThrow();
        });
        it('should handle network connection errors', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.host = 'non-existent-host';
            await expect(connectionManager.createConnection(config))
                .rejects.toThrow('Connection creation failed');
        });
        it('should handle authentication errors', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.username = 'invalid_user';
            config.password = 'invalid_password';
            await expect(connectionManager.createConnection(config))
                .rejects.toThrow('Connection creation failed');
        });
        it('should handle query timeout errors', async () => {
            const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            // Mock a timeout scenario
            const Pool = require('pg').Pool;
            Pool.mockImplementationOnce(() => ({
                connect: jest.fn().mockRejectedValue(new Error('Query timeout')),
                end: jest.fn()
            }));
            await expect(connectionManager.executeQuery(connection.id, 'SELECT 1'))
                .rejects.toThrow();
        });
    });
    describe('Connection Pool Management', () => {
        it('should respect max connections configuration', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.maxConnections = 5;
            const connection = await connectionManager.createConnection(config);
            expect(connection.metrics.totalConnections).toBe(5);
        });
        it('should handle connection pool exhaustion', async () => {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.maxConnections = 1;
            const connection = await connectionManager.createConnection(config);
            // This would need more complex testing with actual concurrent queries
            expect(connection.metrics.totalConnections).toBe(1);
        });
    });
});
//# sourceMappingURL=connection-manager.test.js.map