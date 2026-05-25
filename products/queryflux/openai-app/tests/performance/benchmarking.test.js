/**
 * Performance Tests: QueryFlux OpenAI App Benchmarking
 *
 * Comprehensive performance testing including load testing,
 * stress testing, and benchmarking of all components
 */
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnectionManager } from '../../src/database/connection-manager.js';
import { NaturalLanguageToSQLEngine } from '../../src/actions/natural-language-to-sql.js';
import { testUtils } from '../setup.js';
// Mock OpenAI with performance tracking
jest.mock('openai', () => ({
    default: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }))
}));
// Mock dependencies
jest.mock('../../src/security/query-validator.js', () => ({
    QueryValidator: jest.fn().mockImplementation(() => ({
        validateSQL: jest.fn().mockResolvedValue({
            valid: true,
            errors: [],
            warnings: [],
            security: { hasInjection: false, hasDataLeak: false, hasPrivilegeEscalation: false }
        })
    }))
}));
jest.mock('../../src/database/schema-analyzer.js', () => ({
    SchemaAnalyzer: jest.fn().mockImplementation(() => ({
        getSchema: jest.fn().mockResolvedValue(testUtils.createTestSchema())
    }))
}));
describe('Performance Benchmarking Tests', () => {
    let connectionManager;
    let sqlEngine;
    let connectionIds = [];
    let mockOpenAI;
    beforeAll(async () => {
        console.log('🚀 Initializing performance test environment');
        connectionManager = new DatabaseConnectionManager();
        sqlEngine = new NaturalLanguageToSQLEngine();
        mockOpenAI = require('openai').default().chat.completions.create;
        // Setup performance-optimized mock responses
        setupPerformanceMockResponses();
        // Create multiple test connections for concurrent testing
        for (let i = 0; i < 5; i++) {
            const config = testUtils.createTestConnectionConfig('postgresql');
            config.name = `perf-test-connection-${i}`;
            const connection = await connectionManager.createConnection(config);
            connectionIds.push(connection.id);
        }
    });
    afterAll(async () => {
        console.log('🧹 Cleaning up performance test environment');
        // Close all connections
        for (const connectionId of connectionIds) {
            try {
                await connectionManager.closeConnection(connectionId);
            }
            catch (error) {
                // Ignore cleanup errors
            }
        }
    });
    function setupPerformanceMockResponses() {
        mockOpenAI.mockImplementation(({ messages }) => {
            // Simulate realistic API response times
            const delay = Math.random() * 100 + 50; // 50-150ms delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        choices: [{
                                message: {
                                    function_call: {
                                        name: 'generate_sql_query',
                                        arguments: JSON.stringify({
                                            sql: 'SELECT * FROM users LIMIT 1000',
                                            explanation: 'Performance test query',
                                            complexity: 'medium',
                                            optimizations: ['Added LIMIT clause'],
                                            estimatedExecutionTime: '50ms',
                                            suggestedIndexes: [],
                                            potentialIssues: []
                                        })
                                    }
                                }
                            }]
                    });
                }, delay);
            });
        });
    }
    describe('Query Generation Performance', () => {
        it('should generate simple queries within performance thresholds', async () => {
            const simpleQueries = [
                'Show me all users',
                'Count total users',
                'Get user names',
                'List active users',
                'Show recent registrations'
            ];
            const performanceMetrics = [];
            for (const query of simpleQueries) {
                const startTime = performance.now();
                const startMemory = process.memoryUsage().heapUsed;
                const result = await sqlEngine.convertToSQL({
                    naturalLanguage: query,
                    connectionId: connectionIds[0],
                    databaseType: 'postgresql'
                });
                const endTime = performance.now();
                const endMemory = process.memoryUsage().heapUsed;
                const executionTime = endTime - startTime;
                const memoryUsed = endMemory - startMemory;
                performanceMetrics.push({
                    query,
                    time: executionTime,
                    memory: memoryUsed
                });
                expect(result.success).toBe(true);
                expect(executionTime).toBeLessThan(1000); // Less than 1 second
                expect(memoryUsed).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
            }
            // Calculate average performance
            const avgTime = performanceMetrics.reduce((sum, m) => sum + m.time, 0) / performanceMetrics.length;
            const avgMemory = performanceMetrics.reduce((sum, m) => sum + m.memory, 0) / performanceMetrics.length;
            console.log(`📊 Simple Query Performance - Avg Time: ${avgTime.toFixed(2)}ms, Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
            expect(avgTime).toBeLessThan(500); // Average less than 500ms
            expect(avgMemory).toBeLessThan(5 * 1024 * 1024); // Average less than 5MB
        });
        it('should generate complex queries within performance thresholds', async () => {
            const complexQueries = [
                'Show me active users with their profiles and order history from the last 30 days',
                'Count users by department and filter by registration date with specific conditions',
                'Get comprehensive user analytics including joins across multiple tables with aggregations',
                'Show me user engagement metrics with complex filtering and sorting requirements',
                'Generate detailed user reports with multiple joins and subqueries'
            ];
            const performanceMetrics = [];
            for (const query of complexQueries) {
                const startTime = performance.now();
                const result = await sqlEngine.convertToSQL({
                    naturalLanguage: query,
                    connectionId: connectionIds[0],
                    databaseType: 'postgresql',
                    includeOptimizations: true
                });
                const endTime = performance.now();
                const executionTime = endTime - startTime;
                performanceMetrics.push({
                    query: query.substring(0, 50) + '...',
                    time: executionTime,
                    complexity: result.generatedSQL?.complexity || 'unknown'
                });
                expect(result.success).toBe(true);
                expect(executionTime).toBeLessThan(2000); // Less than 2 seconds
            }
            const avgTime = performanceMetrics.reduce((sum, m) => sum + m.time, 0) / performanceMetrics.length;
            console.log(`📊 Complex Query Performance - Avg Time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(1500); // Average less than 1.5 seconds
        });
        it('should maintain performance under sustained load', async () => {
            const queryCount = 50;
            const queries = Array.from({ length: queryCount }, (_, i) => `Show me users where id = ${i + 1}`);
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;
            const results = await Promise.all(queries.map((query, index) => sqlEngine.convertToSQL({
                naturalLanguage: query,
                connectionId: connectionIds[index % connectionIds.length],
                databaseType: 'postgresql'
            })));
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            const totalTime = endTime - startTime;
            const memoryIncrease = endMemory - startMemory;
            const avgTimePerQuery = totalTime / queryCount;
            const throughput = queryCount / (totalTime / 1000); // Queries per second
            console.log(`📊 Sustained Load Performance:`);
            console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
            console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Avg Time per Query: ${avgTimePerQuery.toFixed(2)}ms`);
            console.log(`   Throughput: ${throughput.toFixed(2)} queries/second`);
            // Performance assertions
            expect(results.every(r => r.success)).toBe(true);
            expect(avgTimePerQuery).toBeLessThan(300); // Less than 300ms per query
            expect(throughput).toBeGreaterThan(3); // More than 3 queries per second
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
        });
    });
    describe('Database Connection Performance', () => {
        it('should handle concurrent database connections efficiently', async () => {
            const concurrentConnections = 10;
            const queriesPerConnection = 5;
            const startTime = performance.now();
            const connectionPromises = Array.from({ length: concurrentConnections }, async (_, connIndex) => {
                const connectionId = connectionIds[connIndex % connectionIds.length];
                const queryPromises = Array.from({ length: queriesPerConnection }, async (_, queryIndex) => {
                    return connectionManager.executeQuery(connectionId, `SELECT ${queryIndex + 1} as test_value, '${connIndex}-${queryIndex}' as test_id`);
                });
                return Promise.all(queryPromises);
            });
            const results = await Promise.all(connectionPromises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const totalQueries = concurrentConnections * queriesPerConnection;
            const avgTimePerQuery = totalTime / totalQueries;
            const throughput = totalQueries / (totalTime / 1000);
            console.log(`📊 Concurrent Connection Performance:`);
            console.log(`   Concurrent Connections: ${concurrentConnections}`);
            console.log(`   Queries per Connection: ${queriesPerConnection}`);
            console.log(`   Total Queries: ${totalQueries}`);
            console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
            console.log(`   Avg Time per Query: ${avgTimePerQuery.toFixed(2)}ms`);
            console.log(`   Throughput: ${throughput.toFixed(2)} queries/second`);
            // Flatten results and verify all succeeded
            const allResults = results.flat();
            expect(allResults.every(r => r.success)).toBe(true);
            expect(throughput).toBeGreaterThan(10); // More than 10 queries per second
        });
        it('should maintain connection pool efficiency', async () => {
            const testConnection = connectionManager.getConnection(connectionIds[0]);
            const initialMetrics = { ...testConnection.metrics };
            // Execute multiple queries to test pool efficiency
            const queryCount = 20;
            const queries = Array.from({ length: queryCount }, (_, i) => `SELECT ${i} as iteration_id, pg_sleep(0.01)` // Small delay to simulate real queries
            );
            const startTime = performance.now();
            const results = await Promise.all(queries.map(query => connectionManager.executeQuery(connectionIds[0], query)));
            const endTime = performance.now();
            const finalMetrics = testConnection.metrics;
            const poolEfficiency = finalMetrics.successfulQueries / finalMetrics.totalQueries;
            const avgQueryTime = (endTime - startTime) / queryCount;
            console.log(`📊 Connection Pool Efficiency:`);
            console.log(`   Success Rate: ${(poolEfficiency * 100).toFixed(2)}%`);
            console.log(`   Total Queries: ${finalMetrics.totalQueries}`);
            console.log(`   Successful Queries: ${finalMetrics.successfulQueries}`);
            console.log(`   Failed Queries: ${finalMetrics.failedQueries}`);
            console.log(`   Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
            console.log(`   Average Connection Query Time: ${finalMetrics.averageQueryTime.toFixed(2)}ms`);
            expect(results.every(r => r.success)).toBe(true);
            expect(poolEfficiency).toBeGreaterThan(0.95); // 95% success rate
            expect(avgQueryTime).toBeLessThan(100); // Less than 100ms per query
        });
        it('should handle connection timeout and recovery', async () => {
            const testConnectionId = connectionIds[1];
            // Test normal performance
            const normalStartTime = performance.now();
            await connectionManager.executeQuery(testConnectionId, 'SELECT 1');
            const normalTime = performance.now() - normalStartTime;
            // Test with artificially slow connection (mocked)
            const originalConnect = require('pg').Pool.prototype.connect;
            let slowConnectCalled = false;
            require('pg').Pool.prototype.connect = jest.fn().mockImplementation(async () => {
                slowConnectCalled = true;
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
                return {
                    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
                    release: jest.fn()
                };
            });
            const slowStartTime = performance.now();
            try {
                await connectionManager.executeQuery(testConnectionId, 'SELECT 1');
            }
            catch (error) {
                // Expected to fail due to timeout
            }
            const slowTime = performance.now() - slowStartTime;
            // Restore original function
            require('pg').Pool.prototype.connect = originalConnect;
            console.log(`📊 Connection Timeout Performance:`);
            console.log(`   Normal Query Time: ${normalTime.toFixed(2)}ms`);
            console.log(`   Timeout Query Time: ${slowTime.toFixed(2)}ms`);
            console.log(`   Slow Connect Called: ${slowConnectCalled}`);
            expect(normalTime).toBeLessThan(100); // Normal queries should be fast
            expect(slowTime).toBeGreaterThan(50); // Slow connection should take longer
        });
    });
    describe('Memory Usage and Resource Management', () => {
        it('should maintain stable memory usage under load', async () => {
            const initialMemory = process.memoryUsage();
            const memorySnapshots = [];
            // Run multiple iterations and track memory
            for (let i = 0; i < 10; i++) {
                const iterationStart = performance.now();
                // Execute multiple operations
                await Promise.all([
                    sqlEngine.convertToSQL({
                        naturalLanguage: `Test query ${i}`,
                        connectionId: connectionIds[0],
                        databaseType: 'postgresql'
                    }),
                    connectionManager.executeQuery(connectionIds[1], `SELECT ${i}`),
                    connectionManager.getSchema(connectionIds[2])
                ]);
                const iterationEnd = performance.now();
                const currentMemory = process.memoryUsage();
                memorySnapshots.push({
                    iteration: i + 1,
                    memory: { ...currentMemory },
                    time: iterationEnd - iterationStart
                });
                // Allow garbage collection
                if (global.gc) {
                    global.gc();
                }
            }
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const maxMemory = Math.max(...memorySnapshots.map(s => s.memory.heapUsed));
            const avgIterationTime = memorySnapshots.reduce((sum, s) => sum + s.time, 0) / memorySnapshots.length;
            console.log(`📊 Memory Usage Analysis:`);
            console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Max Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Avg Iteration Time: ${avgIterationTime.toFixed(2)}ms`);
            // Memory should not increase significantly
            expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
            expect(avgIterationTime).toBeLessThan(500); // Less than 500ms per iteration
        });
        it('should efficiently handle large query results', async () => {
            // Mock large result set
            const mockLargeResult = {
                rows: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `User ${i}`,
                    email: `user${i}@test.com`,
                    created_at: new Date().toISOString()
                })),
                rowCount: 1000,
                executionTime: 0
            };
            const Pool = require('pg').Pool;
            const originalQuery = Pool.prototype.query || Pool.prototype.connect;
            Pool.prototype.connect = jest.fn().mockResolvedValue({
                query: jest.fn().mockResolvedValue(mockLargeResult),
                release: jest.fn()
            });
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;
            const result = await connectionManager.executeQuery(connectionIds[0], 'SELECT * FROM large_table LIMIT 1000');
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            const executionTime = endTime - startTime;
            const memoryUsed = endMemory - startMemory;
            console.log(`📊 Large Result Performance:`);
            console.log(`   Rows Returned: ${result.rowCount}`);
            console.log(`   Execution Time: ${executionTime.toFixed(2)}ms`);
            console.log(`   Memory Used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
            expect(result.success).toBe(true);
            expect(result.rowCount).toBe(1000);
            expect(executionTime).toBeLessThan(1000); // Less than 1 second
            expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
            // Restore original function
            Pool.prototype.connect = originalQuery;
        });
    });
    describe('OpenAI API Performance', () => {
        it('should handle OpenAI API rate limiting gracefully', async () => {
            const rapidQueries = Array.from({ length: 10 }, (_, i) => sqlEngine.convertToSQL({
                naturalLanguage: `Rapid query ${i}`,
                connectionId: connectionIds[0],
                databaseType: 'postgresql'
            }));
            const startTime = performance.now();
            // Simulate rate limiting by delaying some responses
            let callCount = 0;
            mockOpenAI.mockImplementation(({ messages }) => {
                callCount++;
                const delay = callCount > 5 ? 1000 : 100; // Delay after 5 calls
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            choices: [{
                                    message: {
                                        function_call: {
                                            name: 'generate_sql_query',
                                            arguments: JSON.stringify({
                                                sql: 'SELECT * FROM users LIMIT 1000',
                                                explanation: 'Rate limit test query',
                                                complexity: 'low',
                                                optimizations: ['Added LIMIT clause'],
                                                estimatedExecutionTime: '50ms'
                                            })
                                        }
                                    }
                                }]
                        });
                    }, delay);
                });
            });
            const results = await Promise.allSettled(rapidQueries);
            const endTime = performance.now();
            const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.success);
            const failedResults = results.filter(r => r.status === 'rejected');
            console.log(`📊 Rate Limiting Performance:`);
            console.log(`   Total Queries: ${results.length}`);
            console.log(`   Successful: ${successfulResults.length}`);
            console.log(`   Failed: ${failedResults.length}`);
            console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
            console.log(`   API Calls Made: ${callCount}`);
            // Should handle rate limiting without complete failure
            expect(successfulResults.length).toBeGreaterThan(0);
            expect(endTime - startTime).toBeLessThan(5000); // Complete within 5 seconds
        });
        it('should optimize OpenAI token usage', async () => {
            const testQueries = [
                'Simple query',
                'Show me users',
                'Get user data with profile information and order history',
                'Complex analytical query requiring multiple table joins with aggregations and complex filtering conditions'
            ];
            const tokenUsageMetrics = [];
            // Mock to track input size (proxy for token usage)
            mockOpenAI.mockImplementation(({ messages }) => {
                const inputText = JSON.stringify(messages);
                const estimatedTokens = Math.ceil(inputText.length / 4); // Rough estimate
                tokenUsageMetrics.push({
                    query: messages[messages.length - 1]?.content?.substring(0, 50) || 'unknown',
                    estimatedTokens
                });
                return Promise.resolve({
                    choices: [{
                            message: {
                                function_call: {
                                    name: 'generate_sql_query',
                                    arguments: JSON.stringify({
                                        sql: 'SELECT * FROM users LIMIT 1000',
                                        explanation: 'Token optimization test',
                                        complexity: 'medium',
                                        optimizations: ['Optimized for token usage'],
                                        estimatedExecutionTime: '50ms'
                                    })
                                }
                            }
                        }]
                });
            });
            for (const query of testQueries) {
                const result = await sqlEngine.convertToSQL({
                    naturalLanguage: query,
                    connectionId: connectionIds[0],
                    databaseType: 'postgresql'
                });
                expect(result.success).toBe(true);
            }
            const avgTokens = tokenUsageMetrics.reduce((sum, m) => sum + m.estimatedTokens, 0) / tokenUsageMetrics.length;
            const maxTokens = Math.max(...tokenUsageMetrics.map(m => m.estimatedTokens));
            console.log(`📊 Token Usage Optimization:`);
            console.log(`   Average Tokens per Query: ${avgTokens.toFixed(0)}`);
            console.log(`   Max Tokens per Query: ${maxTokens.toFixed(0)}`);
            console.log(`   Total Queries: ${tokenUsageMetrics.length}`);
            // Token usage should be reasonable
            expect(avgTokens).toBeLessThan(1000); // Average less than 1000 tokens
            expect(maxTokens).toBeLessThan(2000); // Maximum less than 2000 tokens
        });
    });
    describe('Stress Testing', () => {
        it('should handle high concurrent load without degradation', async () => {
            const highConcurrency = 50;
            const queriesPerWorker = 3;
            console.log(`🚀 Starting stress test: ${highConcurrency} concurrent workers, ${queriesPerWorker} queries each`);
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;
            const stressPromises = Array.from({ length: highConcurrency }, async (_, workerIndex) => {
                const workerStartTime = performance.now();
                const workerResults = [];
                for (let queryIndex = 0; queryIndex < queriesPerWorker; queryIndex++) {
                    const queryStart = performance.now();
                    try {
                        const result = await sqlEngine.convertToSQL({
                            naturalLanguage: `Stress test query ${workerIndex}-${queryIndex}`,
                            connectionId: connectionIds[workerIndex % connectionIds.length],
                            databaseType: 'postgresql'
                        });
                        const queryTime = performance.now() - queryStart;
                        workerResults.push({ success: true, time: queryTime });
                    }
                    catch (error) {
                        const queryTime = performance.now() - queryStart;
                        workerResults.push({ success: false, time: queryTime, error: error.message });
                    }
                }
                const workerTime = performance.now() - workerStartTime;
                return {
                    workerIndex,
                    workerTime,
                    results: workerResults,
                    successRate: workerResults.filter(r => r.success).length / workerResults.length
                };
            });
            const workerResults = await Promise.all(stressPromises);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            // Calculate overall metrics
            const totalQueries = highConcurrency * queriesPerWorker;
            const successfulQueries = workerResults.reduce((sum, w) => sum + w.results.filter(r => r.success).length, 0);
            const totalTime = endTime - startTime;
            const memoryIncrease = endMemory - startMemory;
            const overallSuccessRate = successfulQueries / totalQueries;
            const throughput = successfulQueries / (totalTime / 1000);
            const avgWorkerTime = workerResults.reduce((sum, w) => sum + w.workerTime, 0) / workerResults.length;
            const minWorkerSuccessRate = Math.min(...workerResults.map(w => w.successRate));
            console.log(`📊 Stress Test Results:`);
            console.log(`   Total Workers: ${highConcurrency}`);
            console.log(`   Queries per Worker: ${queriesPerWorker}`);
            console.log(`   Total Queries: ${totalQueries}`);
            console.log(`   Successful Queries: ${successfulQueries}`);
            console.log(`   Overall Success Rate: ${(overallSuccessRate * 100).toFixed(2)}%`);
            console.log(`   Min Worker Success Rate: ${(minWorkerSuccessRate * 100).toFixed(2)}%`);
            console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
            console.log(`   Throughput: ${throughput.toFixed(2)} queries/second`);
            console.log(`   Avg Worker Time: ${avgWorkerTime.toFixed(2)}ms`);
            console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            // Stress test assertions
            expect(overallSuccessRate).toBeGreaterThan(0.8); // At least 80% success rate
            expect(minWorkerSuccessRate).toBeGreaterThan(0.7); // Each worker at least 70% success
            expect(throughput).toBeGreaterThan(5); // More than 5 queries per second
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
        });
        it('should maintain performance with increasing complexity', async () => {
            const complexityLevels = [
                { level: 'simple', queries: ['Show users', 'Count users', 'Get names'] },
                { level: 'medium', queries: ['Users with profiles', 'Orders by user', 'Department statistics'] },
                { level: 'complex', queries: ['Comprehensive user analytics with joins', 'Multi-table aggregations', 'Complex filtering with subqueries'] }
            ];
            const complexityMetrics = [];
            for (const { level, queries } of complexityLevels) {
                const startTime = performance.now();
                const results = await Promise.all(queries.map(query => sqlEngine.convertToSQL({
                    naturalLanguage: query,
                    connectionId: connectionIds[0],
                    databaseType: 'postgresql',
                    includeOptimizations: true
                })));
                const endTime = performance.now();
                const avgTime = (endTime - startTime) / queries.length;
                const successRate = results.filter(r => r.success).length / results.length;
                complexityMetrics.push({ level, avgTime, successRate });
                expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
            }
            console.log(`📊 Complexity Performance Analysis:`);
            complexityMetrics.forEach(({ level, avgTime, successRate }) => {
                console.log(`   ${level.charAt(0).toUpperCase() + level.slice(1)}: ${avgTime.toFixed(2)}ms, ${(successRate * 100).toFixed(1)}% success`);
            });
            // Performance should not degrade excessively with complexity
            const simpleTime = complexityMetrics.find(m => m.level === 'simple').avgTime;
            const complexTime = complexityMetrics.find(m => m.level === 'complex').avgTime;
            const performanceDegradation = complexTime / simpleTime;
            expect(performanceDegradation).toBeLessThan(5); // Complex queries should not be more than 5x slower
        });
    });
    describe('Resource Cleanup and Memory Leaks', () => {
        it('should properly clean up resources after operations', async () => {
            const initialMemory = process.memoryUsage();
            const gcCalls = [];
            // Run multiple operations with explicit garbage collection
            for (let i = 0; i < 20; i++) {
                await sqlEngine.convertToSQL({
                    naturalLanguage: `Cleanup test query ${i}`,
                    connectionId: connectionIds[0],
                    databaseType: 'postgresql'
                });
                await connectionManager.executeQuery(connectionIds[1], `SELECT ${i}`);
                if (global.gc && i % 5 === 0) {
                    global.gc();
                    gcCalls.push(i);
                }
            }
            // Final garbage collection
            if (global.gc) {
                global.gc();
            }
            const finalMemory = process.memoryUsage();
            const memoryLeak = finalMemory.heapUsed - initialMemory.heapUsed;
            console.log(`📊 Resource Cleanup Analysis:`);
            console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Memory Leak: ${(memoryLeak / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   GC Calls: ${gcCalls.length}`);
            // Should not have significant memory leaks
            expect(memoryLeak).toBeLessThan(10 * 1024 * 1024); // Less than 10MB leak
        });
        it('should handle connection cleanup properly', async () => {
            const tempConnection = await connectionManager.createConnection(testUtils.createTestConnectionConfig('postgresql'));
            // Use connection
            await connectionManager.executeQuery(tempConnection.id, 'SELECT 1');
            // Get connection metrics before cleanup
            const beforeCleanup = connectionManager.getConnection(tempConnection.id);
            const beforeMetrics = { ...beforeCleanup.metrics };
            // Close connection
            await connectionManager.closeConnection(tempConnection.id);
            // Verify connection is removed from active connections
            expect(() => connectionManager.getConnection(tempConnection.id))
                .toThrow('Connection not found');
            console.log(`📊 Connection Cleanup:`);
            console.log(`   Connection ID: ${tempConnection.id}`);
            console.log(`   Queries Executed: ${beforeMetrics.totalQueries}`);
            console.log(`   Success Rate: ${(beforeMetrics.successfulQueries / beforeMetrics.totalQueries * 100).toFixed(2)}%`);
            expect(beforeMetrics.totalQueries).toBeGreaterThan(0);
            expect(beforeMetrics.successfulQueries).toBe(1);
        });
    });
});
//# sourceMappingURL=benchmarking.test.js.map