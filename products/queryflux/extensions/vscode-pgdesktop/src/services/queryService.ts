/**
 * Query Execution Service
 */

import * as vscode from 'vscode';
import { DatabaseConnection } from '../ultimateExtension';
import { DatabaseConnectionManager } from './connectionManager';

export class QueryExecutionService {
    private connectionManager: DatabaseConnectionManager;

    constructor(context: vscode.ExtensionContext) {
        this.connectionManager = new DatabaseConnectionManager(context);
    }

    async executeQuery(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        try {
            // Check if cancelled before starting
            if (token.isCancellationRequested) {
                return { success: false, error: 'Query execution was cancelled', rows: [], rowCount: 0 };
            }

            // Input validation
            if (!query || query.trim().length === 0) {
                return { success: false, error: 'Query cannot be empty', rows: [], rowCount: 0 };
            }

            // Security check for dangerous operations
            const dangerousPatterns = [
                /DROP\s+DATABASE/i,
                /DROP\s+SCHEMA/i,
                /TRUNCATE\s+TABLE/i,
                /DELETE\s+FROM.*WHERE\s*$/i, // DELETE without WHERE clause
                /UPDATE.*SET.*WHERE\s*$/i, // UPDATE without WHERE clause
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(query.trim())) {
                    const confirmed = await vscode.window.showWarningMessage(
                        `This query contains potentially dangerous operations: ${query.substring(0, 50)}...`,
                        { modal: true },
                        'Execute Anyway',
                        'Cancel'
                    );

                    if (confirmed !== 'Execute Anyway') {
                        return { success: false, error: 'Query execution cancelled by user', rows: [], rowCount: 0 };
                    }
                }
            }

            // Execute query using the connection manager
            const result = await this.executeQueryWithConnection(query, connection, token);

            // Check if cancelled after execution
            if (token.isCancellationRequested) {
                return { success: false, error: 'Query execution was cancelled', rows: [], rowCount: 0 };
            }

            return result;
        } catch (error) {
            console.error('Query execution error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                rows: [],
                rowCount: 0
            };
        }
    }

    private async executeQueryWithConnection(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.executePostgreSQLQuery(query, connection, token);
            case 'MongoDB':
                return this.executeMongoDBQuery(query, connection, token);
            case 'Redis':
                return this.executeRedisQuery(query, connection, token);
            case 'Oracle':
                return this.executeOracleQuery(query, connection, token);
            default:
                throw new Error(`Query execution for ${connection.type} not yet implemented`);
        }
    }

    private async executePostgreSQLQuery(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        try {
            let Client: any;
            try {
                ({ Client } = require('pg'));
            } catch (_e) {
                throw new Error('PostgreSQL support requires the "pg" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = new Client({
                host: connection.host,
                port: connection.port,
                user: connection.username,
                password,
                database: connection.database,
                ssl: connection.ssl,
                query_timeout: 30000, // 30 second timeout
                statement_timeout: 30000
            });

            // Set up cancellation
            const cancelPromise = new Promise<never>((_, reject) => {
                token.onCancellationRequested(() => {
                    client.end();
                    reject(new Error('Query execution cancelled'));
                });
            });

            await client.connect();

            try {
                const start = Date.now();
                const result = await Promise.race([
                    client.query(query),
                    cancelPromise
                ]);
                const duration = Date.now() - start;

                await client.end();

                return {
                    success: true,
                    rows: result.rows,
                    rowCount: result.rowCount,
                    fields: result.fields,
                    command: result.command,
                    duration: duration
                };
            } catch (queryError) {
                await client.end();
                throw queryError;
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                rows: [],
                rowCount: 0
            };
        }
    }

    private async executeMongoDBQuery(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
            const client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 30000
            });

            await client.connect();

            const start = Date.now();
            let result;
            const db = client.db(connection.database);

            try {
                // Parse MongoDB query - this is a simplified version
                if (query.trim().startsWith('db.')) {
                    // Handle MongoDB shell syntax
                    const collectionMatch = query.match(/db\.(\w+)\./);
                    if (collectionMatch) {
                        const collectionName = collectionMatch[1];
                        const collection = db.collection(collectionName);

                        if (query.includes('.find(')) {
                            const findMatch = query.match(/\.find\(([^)]*)\)/);
                            const filter = findMatch && findMatch[1] ? JSON.parse(findMatch[1] || '{}') : {};
                            result = await collection.find(filter).limit(100).toArray();
                        } else if (query.includes('.insertOne(')) {
                            const insertMatch = query.match(/\.insertOne\(([^)]*)\)/);
                            const doc = insertMatch && insertMatch[1] ? JSON.parse(insertMatch[1]) : {};
                            result = await collection.insertOne(doc);
                        } else if (query.includes('.updateOne(')) {
                            const updateMatch = query.match(/\.updateOne\(([^,]+),\s*([^)]+)\)/);
                            if (updateMatch) {
                                const filter = JSON.parse(updateMatch[1]);
                                const update = JSON.parse(updateMatch[2]);
                                result = await collection.updateOne(filter, update);
                            }
                        } else if (query.includes('.deleteOne(')) {
                            const deleteMatch = query.match(/\.deleteOne\(([^)]*)\)/);
                            const filter = deleteMatch && deleteMatch[1] ? JSON.parse(deleteMatch[1]) : {};
                            result = await collection.deleteOne(filter);
                        }
                    }
                } else {
                    // Try to parse as JSON query
                    const parsedQuery = JSON.parse(query);
                    const collection = db.collection(parsedQuery.collection || 'test');

                    if (parsedQuery.operation === 'find') {
                        result = await collection.find(parsedQuery.filter || {}).limit(parsedQuery.limit || 100).toArray();
                    } else if (parsedQuery.operation === 'insert') {
                        result = await collection.insertOne(parsedQuery.document);
                    } else if (parsedQuery.operation === 'update') {
                        result = await collection.updateOne(parsedQuery.filter, parsedQuery.update);
                    } else if (parsedQuery.operation === 'delete') {
                        result = await collection.deleteOne(parsedQuery.filter);
                    }
                }

                const duration = Date.now() - start;
                await client.close();

                return {
                    success: true,
                    rows: Array.isArray(result) ? result : [result],
                    rowCount: Array.isArray(result) ? result.length : 1,
                    duration: duration
                };
            } catch (queryError) {
                await client.close();
                throw queryError;
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                rows: [],
                rowCount: 0
            };
        }
    }

    private async executeRedisQuery(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = createClient({
                socket: {
                    host: connection.host,
                    port: connection.port,
                    connectTimeout: 5000
                },
                password
            });

            await client.connect();

            const start = Date.now();
            const parts = query.trim().split(' ');
            const command = parts[0].toUpperCase();
            const args = parts.slice(1);

            let result;
            switch (command) {
                case 'GET':
                    result = await client.get(args[0]);
                    break;
                case 'SET':
                    result = await client.set(args[0], args[1]);
                    break;
                case 'DEL':
                    result = await client.del(args);
                    break;
                case 'KEYS':
                    result = await client.keys(args[0] || '*');
                    break;
                case 'HGET':
                    result = await client.hGet(args[0], args[1]);
                    break;
                case 'HSET':
                    result = await client.hSet(args[0], args[1], args[2]);
                    break;
                case 'HGETALL':
                    result = await client.hGetAll(args[0]);
                    break;
                case 'LPUSH':
                    result = await client.lPush(args[0], args.slice(1));
                    break;
                case 'LRANGE':
                    result = await client.lRange(args[0], parseInt(args[1]), parseInt(args[2]));
                    break;
                case 'SADD':
                    result = await client.sAdd(args[0], args.slice(1));
                    break;
                case 'SMEMBERS':
                    result = await client.sMembers(args[0]);
                    break;
                case 'INFO':
                    result = await client.info(args[0]);
                    break;
                case 'PING':
                    result = await client.ping();
                    break;
                default:
                    // Generic command execution
                    result = await client.sendCommand(parts);
            }

            const duration = Date.now() - start;
            await client.disconnect();

            return {
                success: true,
                rows: Array.isArray(result) ? result.map((r, i) => ({ index: i, value: r })) : [{ result }],
                rowCount: Array.isArray(result) ? result.length : 1,
                duration: duration
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                rows: [],
                rowCount: 0
            };
        }
    }

    private async executeOracleQuery(query: string, connection: DatabaseConnection, token: vscode.CancellationToken): Promise<any> {
        try {
            let oracledb: any;
            try {
                oracledb = require('oracledb');
            } catch (_e) {
                throw new Error('Oracle support requires the "oracledb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const connectionConfig = {
                user: connection.username,
                password,
                connectString: `${connection.host}:${connection.port}/${connection.database}`
            };

            const conn = await oracledb.getConnection(connectionConfig);

            try {
                const start = Date.now();
                const result = await conn.execute(query, [], {
                    outFormat: oracledb.OUT_FORMAT_OBJECT,
                    maxRows: 1000
                });
                const duration = Date.now() - start;

                await conn.close();

                return {
                    success: true,
                    rows: result.rows,
                    rowCount: result.rowsAffected || result.rows?.length || 0,
                    metaData: result.metaData,
                    duration: duration
                };
            } catch (queryError) {
                await conn.close();
                throw queryError;
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                rows: [],
                rowCount: 0
            };
        }
    }

    private async getPassword(connection: DatabaseConnection): Promise<string | undefined> {
        // This should use the connection manager's method, but for now we'll implement it here
        if (connection.password) {return connection.password;}

        // In a real implementation, this would use VS Code's SecretStorage
        const entered = await vscode.window.showInputBox({
            prompt: `Enter password for ${connection.name}${connection.username ? ` (user ${connection.username})` : ''}`,
            password: true,
            ignoreFocusOut: true
        });

        return entered;
    }

    async validateQuery(query: string, connection: DatabaseConnection): Promise<{ isValid: boolean; error?: string; warnings?: string[] }> {
        try {
            const warnings: string[] = [];

            // Basic syntax validation
            if (!query || query.trim().length === 0) {
                return { isValid: false, error: 'Query cannot be empty' };
            }

            // Check for common SQL injection patterns
            const injectionPatterns = [
                /['"];?\s*(DROP|DELETE|UPDATE|INSERT)\s/i,
                /UNION\s+SELECT/i,
                /--.*$/m,
                /\/\*.*\*\//
            ];

            for (const pattern of injectionPatterns) {
                if (pattern.test(query)) {
                    warnings.push('Query contains potentially unsafe patterns');
                    break;
                }
            }

            // Check for dangerous operations
            if (query.match(/DROP\s+(DATABASE|SCHEMA|TABLE)/i)) {
                warnings.push('Query contains destructive operations');
            }

            if (query.match(/(DELETE|UPDATE).*WHERE\s*$/i)) {
                warnings.push('Query modifies data without proper WHERE clause');
            }

            return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
        } catch (error) {
            return { isValid: false, error: 'Failed to validate query' };
        }
    }
}