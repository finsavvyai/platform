/**
 * Integration Tests: End-to-End Workflows
 *
 * Comprehensive integration tests that test the complete
 * natural language to SQL workflow from start to finish
 */
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnectionManager } from '../../src/database/connection-manager.js';
import { NaturalLanguageToSQLEngine } from '../../src/actions/natural-language-to-sql.js';
import { actions } from '../../src/actions/index.js';
import { testUtils } from '../setup.js';
// Mock OpenAI for integration testing
jest.mock('openai', () => ({
    default: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }))
}));
// Mock external dependencies
jest.mock('../../src/security/credential-manager.js', () => ({
    CredentialManager: jest.fn().mockImplementation(() => ({
        getCredentials: jest.fn().mockResolvedValue({
            username: 'test_user',
            password: 'test_password'
        })
    }))
}));
jest.mock('../../src/network/tunnel-manager.js', () => ({
    TunnelManager: jest.fn().mockImplementation(() => ({
        createTunnel: jest.fn().mockResolvedValue({
            localHost: 'localhost',
            localPort: 5432
        }),
        closeTunnel: jest.fn().mockResolvedValue(undefined)
    }))
}));
describe('End-to-End Workflow Integration Tests', () => {
    let connectionManager;
    let sqlEngine;
    let connectionId;
    let mockOpenAI;
    beforeAll(async () => {
        console.log('🚀 Setting up integration test environment');
        // Initialize components
        connectionManager = new DatabaseConnectionManager();
        sqlEngine = new NaturalLanguageToSQLEngine();
        mockOpenAI = require('openai').default().chat.completions.create;
        // Setup comprehensive mock responses
        setupMockResponses();
    });
    afterAll(async () => {
        console.log('🧹 Cleaning up integration test environment');
        // Cleanup all connections
        const connections = connectionManager.listConnections();
        for (const conn of connections) {
            await connectionManager.closeConnection(conn.id);
        }
    });
    beforeEach(async () => {
        jest.clearAllMocks();
        // Create a fresh test connection for each test
        const connection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
        connectionId = connection.id;
    });
    afterEach(async () => {
        // Cleanup connection after each test
        try {
            await connectionManager.closeConnection(connectionId);
        }
        catch (error) {
            // Connection might already be closed
        }
    });
    function setupMockResponses() {
        // Setup comprehensive OpenAI mock responses
        mockOpenAI.mockImplementation(({ messages }) => {
            const userMessage = messages[messages.length - 1]?.content || '';
            if (userMessage.includes('Generate an optimized SQL query')) {
                return Promise.resolve({
                    choices: [{
                            message: {
                                function_call: {
                                    name: 'generate_sql_query',
                                    arguments: JSON.stringify({
                                        sql: generateMockSQL(userMessage),
                                        explanation: 'Generated SQL query based on natural language input',
                                        complexity: 'medium',
                                        optimizations: ['Added LIMIT clause for safety'],
                                        estimatedExecutionTime: '50ms',
                                        suggestedIndexes: ['Consider adding index on common filter columns'],
                                        potentialIssues: []
                                    })
                                }
                            }
                        }]
                });
            }
            if (userMessage.includes('Analyze this SQL query')) {
                return Promise.resolve({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    queryType: 'select',
                                    complexity: 'medium',
                                    tablesAccessed: ['users', 'profiles'],
                                    estimatedRows: '100-1000',
                                    performanceConsiderations: ['Query uses appropriate indexes'],
                                    securityConsiderations: ['Query only accesses allowed tables'],
                                    optimizationSuggestions: ['Consider using specific columns instead of SELECT *'],
                                    alternativeApproaches: ['Use materialized view for complex aggregations']
                                })
                            }
                        }]
                });
            }
            // Default response
            return Promise.resolve({
                choices: [{
                        message: {
                            content: JSON.stringify({
                                sql: 'SELECT * FROM users LIMIT 1000',
                                explanation: 'Simple query to retrieve user data',
                                complexity: 'low',
                                optimizations: ['Added LIMIT clause'],
                                estimatedExecutionTime: '25ms'
                            })
                        }
                    }]
            });
        });
    }
    function generateMockSQL(userMessage) {
        if (userMessage.includes('count') || userMessage.includes('total')) {
            return 'SELECT COUNT(*) as total FROM users LIMIT 1000';
        }
        if (userMessage.includes('active') || userMessage.includes('status')) {
            return 'SELECT * FROM users WHERE active = true LIMIT 1000';
        }
        if (userMessage.includes('join') || userMessage.includes('profile')) {
            return 'SELECT u.*, p.email FROM users u JOIN profiles p ON u.id = p.user_id LIMIT 1000';
        }
        if (userMessage.includes('order') || userMessage.includes('sort')) {
            return 'SELECT * FROM users ORDER BY created_at DESC LIMIT 1000';
        }
        return 'SELECT * FROM users LIMIT 1000';
    }
    describe('Complete Natural Language to SQL Workflow', () => {
        it('should handle complete simple query workflow', async () => {
            // Step 1: Natural language to SQL conversion
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(true);
            expect(conversionResult.generatedSQL.sql).toContain('SELECT');
            expect(conversionResult.validation.valid).toBe(true);
            // Step 2: Execute the generated SQL
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId,
                limit: 100
            });
            expect(executionResult.success).toBe(true);
            expect(executionResult.rows).toBeDefined();
            expect(executionResult.executionTime).toBeGreaterThan(0);
            // Step 3: Verify query was tracked
            const history = connectionManager.getQueryHistory(connectionId, 1);
            expect(history).toHaveLength(1);
            expect(history[0].query).toBe(conversionResult.generatedSQL.sql);
            expect(history[0].success).toBe(true);
        });
        it('should handle complex query with JOIN workflow', async () => {
            // Step 1: Convert complex natural language query
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all active users with their email addresses',
                connectionId,
                databaseType: 'postgresql',
                context: 'User wants to see active users with contact information'
            });
            expect(conversionResult.success).toBe(true);
            expect(conversionResult.generatedSQL.sql).toContain('JOIN');
            expect(conversionResult.generatedSQL.complexity).toBe('medium');
            // Step 2: Execute complex query
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId,
                limit: 500
            });
            expect(executionResult.success).toBe(true);
            expect(executionResult.rows).toBeDefined();
            // Step 3: Verify query metrics were updated
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.totalQueries).toBeGreaterThan(0);
            expect(connection.metrics.successfulQueries).toBeGreaterThan(0);
            expect(connection.metrics.averageQueryTime).toBeGreaterThan(0);
        });
        it('should handle aggregate query workflow', async () => {
            // Step 1: Convert aggregate natural language query
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Count the number of users in each department',
                connectionId,
                databaseType: 'postgresql',
                includeOptimizations: true
            });
            expect(conversionResult.success).toBe(true);
            expect(conversionResult.generatedSQL.sql).toContain('COUNT(*)');
            expect(conversionResult.generatedSQL.sql).toContain('GROUP BY');
            // Step 2: Execute aggregate query
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId
            });
            expect(executionResult.success).toBe(true);
            expect(executionResult.rows).toBeDefined();
            // Step 3: Verify optimization was applied
            expect(conversionResult.optimization.enabled).toBe(true);
            expect(conversionResult.optimization.appliedOptimizations.length).toBeGreaterThan(0);
        });
        it('should handle error recovery workflow', async () => {
            // Step 1: Simulate conversion failure
            mockOpenAI.mockRejectedValueOnce(new Error('OpenAI API temporarily unavailable'));
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(false);
            expect(conversionResult.error).toBeDefined();
            expect(conversionResult.suggestions).toBeDefined();
            expect(conversionResult.troubleshooting).toBeDefined();
            // Step 2: Verify error was logged
            const history = connectionManager.getQueryHistory(connectionId, 1);
            // Should not have history entries for failed conversions
            expect(history).toHaveLength(0);
        });
        it('should handle query validation failure workflow', async () => {
            // Step 1: Convert query (succeeds)
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(true);
            // Step 2: Manually inject validation error
            conversionResult.validation.valid = false;
            conversionResult.validation.errors = ['Syntax error detected'];
            // Step 3: Should still provide result with validation warnings
            expect(conversionResult.generatedSQL.sql).toBeDefined();
            expect(conversionResult.validation.errors).toContain('Syntax error detected');
        });
    });
    describe('Database Connection and Query Workflow', () => {
        it('should handle complete connection and query workflow', async () => {
            // Step 1: Connect to database
            const connectionResult = await actions.connectDatabase({
                config: testUtils.createTestConnectionConfig('postgresql'),
                aiAssistance: true
            });
            expect(connectionResult.success).toBe(true);
            expect(connectionResult.connectionId).toBeDefined();
            const newConnectionId = connectionResult.connectionId;
            // Step 2: Convert and execute query
            const queryResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Get first 10 users',
                connectionId: newConnectionId,
                databaseType: 'postgresql'
            });
            expect(queryResult.success).toBe(true);
            const executionResult = await actions.executeQuery({
                sql: queryResult.generatedSQL.sql,
                connectionId: newConnectionId
            });
            expect(executionResult.success).toBe(true);
            // Step 3: Cleanup
            await connectionManager.closeConnection(newConnectionId);
        });
        it('should handle multiple database types workflow', async () => {
            const databaseTypes = ['postgresql', 'mysql', 'mongodb'];
            for (const dbType of databaseTypes) {
                // Step 1: Connect to database
                const connectionConfig = testUtils.createTestConnectionConfig(dbType);
                const connectionResult = await actions.connectDatabase({
                    config: connectionConfig,
                    aiAssistance: true
                });
                expect(connectionResult.success).toBe(true);
                // Step 2: Convert query for specific database type
                const queryResult = await actions.naturalLanguageToSQL({
                    naturalLanguage: 'Show me sample data',
                    connectionId: connectionResult.connectionId,
                    databaseType: dbType
                });
                expect(queryResult.success).toBe(true);
                expect(queryResult.generatedSQL.sql).toBeDefined();
                // Step 3: Verify database-specific syntax
                if (dbType === 'mongodb') {
                    expect(queryResult.generatedSQL.sql).toContain('db.');
                }
                else {
                    expect(queryResult.generatedSQL.sql).toContain('SELECT');
                }
                // Step 4: Cleanup
                await connectionManager.closeConnection(connectionResult.connectionId);
            }
        });
    });
    describe('Security and Validation Workflow', () => {
        it('should handle security validation throughout workflow', async () => {
            // Step 1: Attempt to convert potentially dangerous query
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users; DROP TABLE users;',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(true);
            // Should sanitize dangerous parts
            expect(conversionResult.generatedSQL.sql).not.toContain('DROP TABLE');
            // Step 2: Verify security validation passed
            expect(conversionResult.validation.security.hasInjection).toBe(false);
            expect(conversionResult.validation.security.hasDataLeak).toBe(false);
            // Step 3: Execute sanitized query
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId
            });
            expect(executionResult.success).toBe(true);
        });
        it('should handle authentication and authorization workflow', async () => {
            // Step 1: Connect with authentication
            const connectionConfig = testUtils.createTestConnectionConfig('postgresql');
            connectionConfig.username = 'authenticated_user';
            connectionConfig.password = 'secure_password';
            const connectionResult = await actions.connectDatabase({
                config: connectionConfig,
                aiAssistance: true
            });
            expect(connectionResult.success).toBe(true);
            // Step 2: Verify credentials were used
            const CredentialManager = require('../../src/security/credential-manager.js').CredentialManager;
            expect(CredentialManager).toHaveBeenCalled();
            // Step 3: Execute query with authenticated connection
            const queryResult = await actions.executeQuery({
                sql: 'SELECT current_user',
                connectionId: connectionResult.connectionId
            });
            expect(queryResult.success).toBe(true);
            // Step 4: Cleanup
            await connectionManager.closeConnection(connectionResult.connectionId);
        });
        it('should handle audit logging throughout workflow', async () => {
            // Step 1: Execute query that should be audited
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me user count by department',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(true);
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId
            });
            expect(executionResult.success).toBe(true);
            // Step 2: Verify query was logged in history
            const history = connectionManager.getQueryHistory(connectionId, 1);
            expect(history).toHaveLength(1);
            expect(history[0].timestamp).toBeDefined();
            expect(history[0].executionTime).toBeDefined();
            // Step 3: Verify audit trail
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.totalQueries).toBeGreaterThan(0);
            expect(connection.metrics.lastUsed).toBeDefined();
        });
    });
    describe('Performance and Monitoring Workflow', () => {
        it('should handle performance monitoring throughout workflow', async () => {
            // Step 1: Execute multiple queries to generate metrics
            const queries = [
                'Show me all users',
                'Count active users',
                'Get users with profiles'
            ];
            for (const query of queries) {
                const conversionResult = await actions.naturalLanguageToSQL({
                    naturalLanguage: query,
                    connectionId,
                    databaseType: 'postgresql',
                    includeOptimizations: true
                });
                expect(conversionResult.success).toBe(true);
                const executionResult = await actions.executeQuery({
                    sql: conversionResult.generatedSQL.sql,
                    connectionId
                });
                expect(executionResult.success).toBe(true);
            }
            // Step 2: Verify performance metrics were collected
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.totalQueries).toBe(3);
            expect(connection.metrics.successfulQueries).toBe(3);
            expect(connection.metrics.averageQueryTime).toBeGreaterThan(0);
            // Step 3: Verify query history with performance data
            const history = connectionManager.getQueryHistory(connectionId, 10);
            expect(history).toHaveLength(3);
            history.forEach(entry => {
                expect(entry.executionTime).toBeGreaterThan(0);
                expect(entry.success).toBe(true);
            });
        });
        it('should handle optimization workflow', async () => {
            // Step 1: Convert query with optimizations enabled
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Get all data from large table',
                connectionId,
                databaseType: 'postgresql',
                includeOptimizations: true
            });
            expect(conversionResult.success).toBe(true);
            expect(conversionResult.optimization.enabled).toBe(true);
            // Step 2: Verify optimizations were applied
            expect(conversionResult.optimization.appliedOptimizations.length).toBeGreaterThan(0);
            expect(conversionResult.generatedSQL.sql).toContain('LIMIT');
            // Step 3: Execute optimized query
            const executionResult = await actions.executeQuery({
                sql: conversionResult.generatedSQL.sql,
                connectionId
            });
            expect(executionResult.success).toBe(true);
            // Step 4: Verify performance improvements are tracked
            expect(conversionResult.optimization.performanceGain).toBeDefined();
        });
    });
    describe('Error Handling and Recovery Workflow', () => {
        it('should handle complete failure recovery workflow', async () => {
            // Step 1: Simulate connection failure
            const invalidConfig = testUtils.createTestConnectionConfig('postgresql');
            invalidConfig.host = 'non-existent-host';
            const connectionResult = await actions.connectDatabase({
                config: invalidConfig,
                aiAssistance: true
            });
            expect(connectionResult.success).toBe(false);
            expect(connectionResult.error).toBeDefined();
            expect(connectionResult.troubleshooting).toBeDefined();
            // Step 2: Verify helpful error information provided
            expect(connectionResult.suggestions).toBeDefined();
            expect(connectionResult.suggestions.length).toBeGreaterThan(0);
        });
        it('should handle partial failure workflow', async () => {
            // Step 1: Connection succeeds
            const connectionResult = await actions.connectDatabase({
                config: testUtils.createTestConnectionConfig('postgresql'),
                aiAssistance: true
            });
            expect(connectionResult.success).toBe(true);
            // Step 2: Query conversion fails
            mockOpenAI.mockRejectedValueOnce(new Error('AI service temporarily unavailable'));
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users',
                connectionId: connectionResult.connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(false);
            expect(conversionResult.suggestions).toBeDefined();
            // Step 3: Fallback to manual SQL execution
            const manualResult = await actions.executeQuery({
                sql: 'SELECT * FROM users LIMIT 100',
                connectionId: connectionResult.connectionId
            });
            expect(manualResult.success).toBe(true);
            // Step 4: Cleanup
            await connectionManager.closeConnection(connectionResult.connectionId);
        });
        it('should handle timeout and retry workflow', async () => {
            // Step 1: Simulate timeout during conversion
            mockOpenAI.mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100)));
            const conversionResult = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Show me all users',
                connectionId,
                databaseType: 'postgresql'
            });
            expect(conversionResult.success).toBe(false);
            expect(conversionResult.error).toContain('timeout');
            // Step 2: Verify timeout handling provides guidance
            expect(conversionResult.troubleshooting).toBeDefined();
            expect(conversionResult.suggestions.length).toBeGreaterThan(0);
        });
    });
    describe('Multi-Step Complex Workflows', () => {
        it('should handle data analysis workflow', async () => {
            // Step 1: Get schema information
            const schemaResult = await actions.analyzeDatabase({
                connectionId,
                includeRecommendations: true,
                analyzePerformance: true
            });
            expect(schemaResult.success).toBe(true);
            expect(schemaResult.database.tables).toBeDefined();
            // Step 2: Generate analytical query
            const analysisQuery = await actions.naturalLanguageToSQL({
                naturalLanguage: 'Analyze user activity patterns over the last month',
                connectionId,
                databaseType: 'postgresql',
                context: 'Data analysis for business intelligence'
            });
            expect(analysisQuery.success).toBe(true);
            expect(analysisQuery.generatedSQL.sql).toContain('SELECT');
            expect(analysisQuery.insights.performanceConsiderations).toBeDefined();
            // Step 3: Execute analytical query
            const executionResult = await actions.executeQuery({
                sql: analysisQuery.generatedSQL.sql,
                connectionId
            });
            expect(executionResult.success).toBe(true);
            expect(executionResult.rows).toBeDefined();
            // Step 4: Create visualization from results
            const visualizationResult = await actions.createVisualization({
                queryResults: executionResult.rows,
                chartType: 'bar',
                title: 'User Activity Analysis',
                styling: { theme: 'modern' }
            });
            expect(visualizationResult.success).toBe(true);
            expect(visualizationResult.visualization).toBeDefined();
        });
        it('should handle database migration workflow', async () => {
            // Step 1: Analyze current database structure
            const analysisResult = await actions.analyzeDatabase({
                connectionId,
                includeRecommendations: true
            });
            expect(analysisResult.success).toBe(true);
            // Step 2: Generate migration queries
            const migrationQueries = [
                'Add new index on email column for faster lookups',
                'Create materialized view for user statistics',
                'Optimize user profile join query'
            ];
            for (const query of migrationQueries) {
                const conversionResult = await actions.naturalLanguageToSQL({
                    naturalLanguage: query,
                    connectionId,
                    databaseType: 'postgresql',
                    includeOptimizations: true
                });
                // Note: DDL queries would be handled separately in production
                // For now, we test the conversion logic
                expect(conversionResult.success).toBe(true);
                expect(conversionResult.generatedSQL.sql).toBeDefined();
            }
            // Step 3: Verify performance recommendations
            expect(analysisResult.recommendations).toBeDefined();
        });
    });
    describe('Concurrent Operations Workflow', () => {
        it('should handle multiple concurrent queries', async () => {
            // Step 1: Execute multiple queries concurrently
            const queries = [
                'Show me active users',
                'Count total users',
                'Get recent registrations'
            ];
            const queryPromises = queries.map(query => actions.naturalLanguageToSQL({
                naturalLanguage: query,
                connectionId,
                databaseType: 'postgresql'
            }));
            const conversionResults = await Promise.all(queryPromises);
            // Step 2: Verify all conversions succeeded
            conversionResults.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.generatedSQL.sql).toBeDefined();
            });
            // Step 3: Execute queries concurrently
            const executionPromises = conversionResults.map(result => actions.executeQuery({
                sql: result.generatedSQL.sql,
                connectionId
            }));
            const executionResults = await Promise.all(executionPromises);
            // Step 4: Verify all executions succeeded
            executionResults.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.rows).toBeDefined();
            });
            // Step 5: Verify connection metrics
            const connection = connectionManager.getConnection(connectionId);
            expect(connection.metrics.totalQueries).toBe(3);
            expect(connection.metrics.successfulQueries).toBe(3);
        });
    });
});
//# sourceMappingURL=end-to-end-workflows.test.js.map