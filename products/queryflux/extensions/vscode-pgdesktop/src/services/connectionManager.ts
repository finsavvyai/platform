/**
 * Database Connection Manager
 * Handles connections to multiple database types
 */

import * as vscode from 'vscode';
import { DatabaseConnection, ConnectionTestResult, QueryResult, ConnectionStatus, DatabaseType } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseConnectionManager {
    private connections: Map<string, DatabaseConnection> = new Map();
    private activeConnection: DatabaseConnection | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConnections();
    }

    async addConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<DatabaseConnection> {
        const newConnection: DatabaseConnection = {
            ...connection,
            id: uuidv4(),
            status: 'disconnected'
        };

        // Store password securely and remove from object
        if (newConnection.password) {
            await this.context.secrets.store(`ultimatedb:pwd:${newConnection.id}`, newConnection.password);
            newConnection.password = undefined;
        }

        this.connections.set(newConnection.id, newConnection);
        await this.saveConnections();
        this.notifyConnectionChanged();
        
        return newConnection;
    }

    async connect(id?: string): Promise<boolean> {
        if (!id) {
            // If no ID provided, try to connect to the first available connection
            const firstConnection = Array.from(this.connections.values())[0];
            if (!firstConnection) {
                throw new Error('No connections available');
            }
            id = firstConnection.id;
        }

        const connection = this.connections.get(id);
        if (!connection) {
            throw new Error(`Connection ${id} not found`);
        }

        try {
            await this.updateConnection(id, { status: 'testing' });
            await this.testConnectionByType(connection);
            this.activeConnection = connection;
            await this.updateConnection(id, { 
                status: 'connected',
                lastUsed: new Date()
            });
            this.notifyConnectionChanged();
            return true;
        } catch (error) {
            await this.updateConnection(id, { status: 'error' });
            throw error;
        }
    }

    private async testConnectionByType(connection: DatabaseConnection): Promise<void> {
        switch (connection.type) {
            case 'PostgreSQL':
                await this.testPostgreSQLConnection(connection);
                break;
            case 'MongoDB':
                await this.testMongoDBConnection(connection);
                break;
            case 'Redis':
                await this.testRedisConnection(connection);
                break;
            case 'Oracle':
                await this.testOracleConnection(connection);
                break;
            default:
                throw new Error(`Database type ${connection.type} not yet implemented`);
        }
    }

    private async getPassword(connection: DatabaseConnection): Promise<string | undefined> {
        // Prefer in-object (rare; we clear on save), then SecretStorage, else prompt
        if (connection.password && typeof connection.password === 'string' && connection.password.length > 0) {
            return connection.password;
        }

        const key = `ultimatedb:pwd:${connection.id}`;
        let pwd = await this.context.secrets.get(key);
        if (pwd && pwd.length > 0) {return pwd;}

        // Prompt user for a password and store it securely
        const entered = await vscode.window.showInputBox({
            prompt: `Enter password for ${connection.name}${connection.username ? ` (user ${connection.username})` : ''}`,
            password: true,
            ignoreFocusOut: true
        });
        if (!entered || entered.trim().length === 0) {return undefined;}
        await this.context.secrets.store(key, entered);
        return entered;
    }

    async testConnection(connection: DatabaseConnection): Promise<ConnectionTestResult> {
        const startTime = Date.now();
        try {
            await this.testConnectionByType(connection);
            const latency = Date.now() - startTime;
            return { 
                success: true, 
                latency,
                serverVersion: await this.getServerVersion(connection)
            };
        } catch (error: any) {
            return { 
                success: false, 
                error: error?.message || String(error),
                latency: Date.now() - startTime
            };
        }
    }

    private async getServerVersion(connection: DatabaseConnection): Promise<string | undefined> {
        try {
            switch (connection.type) {
                case 'PostgreSQL':
                    return await this.getPostgreSQLVersion(connection);
                case 'MongoDB':
                    return await this.getMongoDBVersion(connection);
                case 'Redis':
                    return await this.getRedisVersion(connection);
                default:
                    return undefined;
            }
        } catch (error) {
            return undefined;
        }
    }

    private async getPostgreSQLVersion(connection: DatabaseConnection): Promise<string> {
        const { Client } = require('pg');
        const password = await this.getPassword(connection);
        const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password,
            database: connection.database,
            ssl: connection.ssl
        });
        
        await client.connect();
        const result = await client.query('SELECT version()');
        await client.end();
        
        return result.rows[0]?.version || 'Unknown';
    }

    private async getMongoDBVersion(connection: DatabaseConnection): Promise<string> {
        const { MongoClient } = require('mongodb');
        const password = await this.getPassword(connection);
        const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
        const client = new MongoClient(uri);
        
        await client.connect();
        const adminDb = client.db().admin();
        const result = await adminDb.command({ buildInfo: 1 });
        await client.close();
        
        return result.version || 'Unknown';
    }

    private async getRedisVersion(connection: DatabaseConnection): Promise<string> {
        const { createClient } = require('redis');
        const password = await this.getPassword(connection);
        const client = createClient({
            socket: { host: connection.host, port: connection.port },
            password
        });
        
        await client.connect();
        const info = await client.info('server');
        await client.disconnect();
        
        const versionMatch = info.match(/redis_version:([^\r\n]+)/);
        return versionMatch ? versionMatch[1] : 'Unknown';
    }

    async deleteConnection(connectionId: string): Promise<void> {
        this.connections.delete(connectionId);
        await this.context.secrets.delete(`ultimatedb:pwd:${connectionId}`);
        await this.saveConnections();
    }

    private async testPostgreSQLConnection(connection: DatabaseConnection): Promise<void> {
        try {
            let Client: any;
            try {
                ({ Client } = require('pg'));
            } catch (_e) {
                throw new Error('PostgreSQL support requires the "pg" package. Please install dependencies.');
            }
            const password = await this.getPassword(connection);

            // Ensure password is a non-empty string for SASL authentication
            if (!password || typeof password !== 'string' || password.trim().length === 0) {
                throw new Error('Password is required for PostgreSQL connection. Please provide a valid password.');
            }

            const client = new Client({
                host: connection.host,
                port: connection.port,
                user: connection.username,
                password: password.trim(), // Ensure password is trimmed string
                database: connection.database,
                ssl: connection.ssl,
                // Additional SASL-related options
                application_name: 'Ultimate DB Manager VSCode'
            });
            await client.connect();
            await client.query('SELECT 1');
            await client.end();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('SASL') || errorMessage.includes('SCRAM')) {
                throw new Error(`PostgreSQL SASL authentication failed: Please check your username and password. Ensure the password is a non-empty string. Original error: ${errorMessage}`);
            }
            throw new Error(`PostgreSQL connection failed: ${errorMessage}`);
        }
    }

    private async testMongoDBConnection(connection: DatabaseConnection): Promise<void> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }
            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
            const client = new MongoClient(uri);
            await client.connect();
            await client.db().admin().ping();
            await client.close();
        } catch (error) {
            throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async testRedisConnection(connection: DatabaseConnection): Promise<void> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }
            const password = await this.getPassword(connection);
            const client = createClient({
                socket: { host: connection.host, port: connection.port },
                password
            });
            await client.connect();
            await client.ping();
            await client.disconnect();
        } catch (error) {
            throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async testOracleConnection(connection: DatabaseConnection): Promise<void> {
        try {
            let oracledb: any;
            try {
                oracledb = require('oracledb');
            } catch (_e) {
                throw new Error(
                    'Oracle support is optional. Please install the optional dependency "oracledb" and required client libraries.'
                );
            }
            const password = await this.getPassword(connection);
            const connectionConfig = {
                user: connection.username,
                password,
                connectString: `${connection.host}:${connection.port}/${connection.database}`
            };
            const conn = await oracledb.getConnection(connectionConfig);
            await conn.execute('SELECT 1 FROM DUAL');
            await conn.close();
        } catch (error: any) {
            throw new Error(`Oracle connection failed: ${error.message || error}`);
        }
    }

    async updateConnection(id: string, updates: Partial<DatabaseConnection>): Promise<void> {
        const connection = this.connections.get(id);
        if (!connection) {
            throw new Error(`Connection ${id} not found`);
        }
        const updatedConnection = { ...connection, ...updates };
        this.connections.set(id, updatedConnection);
        await this.saveConnections();
    }

    getConnection(id: string): DatabaseConnection | undefined {
        return this.connections.get(id);
    }

    getAllConnections(): DatabaseConnection[] {
        return Array.from(this.connections.values());
    }

    getActiveConnection(): DatabaseConnection | null {
        return this.activeConnection;
    }

    getActiveConnections(): DatabaseConnection[] {
        return Array.from(this.connections.values())
            .filter(conn => conn.status === 'connected');
    }

    private async loadConnections(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ultimatedb');
        const savedConnections = config.get<DatabaseConnection[]>('connections', []);
        savedConnections.forEach(conn => {
            this.connections.set(conn.id, { ...conn, status: 'disconnected' });
        });
    }

    private async saveConnections(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ultimatedb');
        const connections = Array.from(this.connections.values());
        const connectionsToSave = connections.map(conn => ({
            ...conn,
            password: undefined
        }));
        await config.update('connections', connectionsToSave, vscode.ConfigurationTarget.Global);
    }

    async removeSecret(connectionId: string): Promise<void> {
        await this.context.secrets.delete(`ultimatedb:pwd:${connectionId}`);
    }

    // Additional methods expected by commands and explorer
    async disconnect(): Promise<void> {
        // Disconnect from current connection
        this.activeConnection = null;
        this.notifyConnectionChanged();
    }

    isConnected(): boolean {
        return this.activeConnection !== null;
    }

    async executeQuery(query: string): Promise<QueryResult> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        const startTime = Date.now();
        try {
            const result = await this.executeQueryByType(this.activeConnection, query);
            const executionTime = Date.now() - startTime;
            return {
                ...result,
                executionTime
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || String(error),
                rows: [],
                rowCount: 0,
                executionTime: Date.now() - startTime
            };
        }
    }

    private async executeQueryByType(connection: DatabaseConnection, query: string): Promise<any> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.executePostgreSQLQuery(connection, query);
            case 'MongoDB':
                return this.executeMongoDBQuery(connection, query);
            case 'Redis':
                return this.executeRedisQuery(connection, query);
            case 'Oracle':
                return this.executeOracleQuery(connection, query);
            default:
                throw new Error(`Query execution for ${connection.type} not yet implemented`);
        }
    }

    private async executePostgreSQLQuery(connection: DatabaseConnection, query: string): Promise<any> {
        try {
            let Client: any;
            try {
                ({ Client } = require('pg'));
            } catch (_e) {
                throw new Error('PostgreSQL support requires the "pg" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);

            // Ensure password is a non-empty string for SASL authentication
            if (!password || typeof password !== 'string' || password.trim().length === 0) {
                throw new Error('Password is required for PostgreSQL connection. Please provide a valid password.');
            }

            const client = new Client({
                host: connection.host,
                port: connection.port,
                user: connection.username,
                password: password.trim(), // Ensure password is trimmed string
                database: connection.database,
                ssl: connection.ssl,
                application_name: 'Ultimate DB Manager VSCode'
            });

            await client.connect();
            const result = await client.query(query);
            await client.end();

            return {
                success: true,
                rows: result.rows,
                rowCount: result.rowCount,
                fields: result.fields,
                command: result.command
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

    private async executeMongoDBQuery(connection: DatabaseConnection, query: string): Promise<any> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
            const client = new MongoClient(uri);
            await client.connect();

            // Simple MongoDB query execution - would need more sophisticated parsing
            const db = client.db(connection.database);
            let result;

            // Basic query parsing - this could be enhanced
            if (query.trim().startsWith('db.')) {
                // Execute as MongoDB shell command
                result = await eval(`client.${query.replace('db.', `db("${connection.database}").`)}`);
            } else {
                // Try to parse as JSON query
                const parsedQuery = JSON.parse(query);
                const collection = db.collection(parsedQuery.collection || 'test');
                result = await collection.find(parsedQuery.filter || {}).toArray();
            }

            await client.close();

            return {
                success: true,
                rows: Array.isArray(result) ? result : [result],
                rowCount: Array.isArray(result) ? result.length : 1
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

    private async executeRedisQuery(connection: DatabaseConnection, query: string): Promise<any> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = createClient({
                socket: { host: connection.host, port: connection.port },
                password
            });

            await client.connect();

            // Parse Redis command
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
                case 'KEYS':
                    result = await client.keys(args[0] || '*');
                    break;
                case 'INFO':
                    result = await client.info(args[0]);
                    break;
                default:
                    // Generic command execution
                    result = await client.sendCommand(parts);
            }

            await client.disconnect();

            return {
                success: true,
                rows: Array.isArray(result) ? result.map((r, i) => ({ index: i, value: r })) : [{ result }],
                rowCount: Array.isArray(result) ? result.length : 1
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

    private async executeOracleQuery(connection: DatabaseConnection, query: string): Promise<any> {
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
            const result = await conn.execute(query);
            await conn.close();

            return {
                success: true,
                rows: result.rows,
                rowCount: result.rowCount,
                metaData: result.metaData
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

    async getDatabases(): Promise<string[]> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        return this.getDatabasesByType(this.activeConnection);
    }

    private async getDatabasesByType(connection: DatabaseConnection): Promise<string[]> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.getPostgreSQLDatabases(connection);
            case 'MongoDB':
                return this.getMongoDatabases(connection);
            case 'Redis':
                return this.getRedisDatabases(connection);
            case 'Oracle':
                return this.getOracleDatabases(connection);
            default:
                throw new Error(`Database listing for ${connection.type} not yet implemented`);
        }
    }

    private async getPostgreSQLDatabases(connection: DatabaseConnection): Promise<string[]> {
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
                database: 'postgres', // Connect to default database to list all databases
                ssl: connection.ssl
            });

            await client.connect();
            const result = await client.query(`
                SELECT datname FROM pg_database
                WHERE datistemplate = false
                ORDER BY datname
            `);
            await client.end();

            return result.rows.map((row: any) => row.datname);
        } catch (error) {
            console.error('Error getting PostgreSQL databases:', error);
            return ['postgres']; // Fallback
        }
    }

    private async getMongoDatabases(connection: DatabaseConnection): Promise<string[]> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}`;
            const client = new MongoClient(uri);
            await client.connect();

            const adminDb = client.db().admin();
            const result = await adminDb.listDatabases();
            await client.close();

            return result.databases.map((db: any) => db.name);
        } catch (error) {
            console.error('Error getting MongoDB databases:', error);
            return [connection.database || 'test']; // Fallback
        }
    }

    private async getRedisDatabases(connection: DatabaseConnection): Promise<string[]> {
        // Redis doesn't have traditional databases, but it has database numbers (0-15 by default)
        return Array.from({ length: 16 }, (_, i) => `db${i}`);
    }

    private async getOracleDatabases(connection: DatabaseConnection): Promise<string[]> {
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
            const result = await conn.execute(`
                SELECT name FROM v$database
                UNION ALL
                SELECT pdb_name FROM dba_pdbs WHERE pdb_name != 'PDB$SEED'
            `);
            await conn.close();

            return result.rows?.map((row: any) => row[0]) || [connection.database || 'ORCL'];
        } catch (error) {
            console.error('Error getting Oracle databases:', error);
            return [connection.database || 'ORCL']; // Fallback
        }
    }

    async getTables(database: string): Promise<string[]> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        return this.getTablesByType(this.activeConnection, database);
    }

    private async getTablesByType(connection: DatabaseConnection, database: string): Promise<string[]> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.getPostgreSQLTables(connection, database);
            case 'MongoDB':
                return this.getMongoCollections(connection, database);
            case 'Redis':
                return this.getRedisKeys(connection);
            case 'Oracle':
                return this.getOracleTables(connection, database);
            default:
                throw new Error(`Table listing for ${connection.type} not yet implemented`);
        }
    }

    private async getPostgreSQLTables(connection: DatabaseConnection, database: string): Promise<string[]> {
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
                database: database,
                ssl: connection.ssl
            });

            await client.connect();
            const result = await client.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            await client.end();

            return result.rows.map((row: any) => row.table_name);
        } catch (error) {
            console.error('Error getting PostgreSQL tables:', error);
            return [];
        }
    }

    private async getMongoCollections(connection: DatabaseConnection, database: string): Promise<string[]> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${database}`;
            const client = new MongoClient(uri);
            await client.connect();

            const db = client.db(database);
            const collections = await db.listCollections().toArray();
            await client.close();

            return collections.map((collection: any) => collection.name);
        } catch (error) {
            console.error('Error getting MongoDB collections:', error);
            return [];
        }
    }

    private async getRedisKeys(connection: DatabaseConnection): Promise<string[]> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = createClient({
                socket: { host: connection.host, port: connection.port },
                password
            });

            await client.connect();
            const keys = await client.keys('*');
            await client.disconnect();

            return keys.slice(0, 100); // Limit to first 100 keys for performance
        } catch (error) {
            console.error('Error getting Redis keys:', error);
            return [];
        }
    }

    private async getOracleTables(connection: DatabaseConnection, database: string): Promise<string[]> {
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
                connectString: `${connection.host}:${connection.port}/${database}`
            };

            const conn = await oracledb.getConnection(connectionConfig);
            const result = await conn.execute(`
                SELECT table_name
                FROM user_tables
                ORDER BY table_name
            `);
            await conn.close();

            return result.rows?.map((row: any) => row[0]) || [];
        } catch (error) {
            console.error('Error getting Oracle tables:', error);
            return [];
        }
    }

    async getTableColumns(tableName: string, schemaName: string = 'public'): Promise<any[]> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        return this.getColumnsByType(this.activeConnection, tableName, schemaName);
    }

    private async getColumnsByType(connection: DatabaseConnection, tableName: string, schemaName: string): Promise<any[]> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.getPostgreSQLColumns(connection, tableName, schemaName);
            case 'MongoDB':
                return this.getMongoDocumentStructure(connection, tableName);
            case 'Redis':
                return this.getRedisKeyInfo(connection, tableName);
            case 'Oracle':
                return this.getOracleColumns(connection, tableName, schemaName);
            default:
                throw new Error(`Column listing for ${connection.type} not yet implemented`);
        }
    }

    private async getPostgreSQLColumns(connection: DatabaseConnection, tableName: string, schemaName: string): Promise<any[]> {
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
                ssl: connection.ssl
            });

            await client.connect();
            const result = await client.query(`
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale,
                    ordinal_position
                FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = $2
                ORDER BY ordinal_position
            `, [tableName, schemaName]);
            await client.end();

            return result.rows;
        } catch (error) {
            console.error('Error getting PostgreSQL columns:', error);
            return [];
        }
    }

    private async getMongoDocumentStructure(connection: DatabaseConnection, collectionName: string): Promise<any[]> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
            const client = new MongoClient(uri);
            await client.connect();

            const db = client.db(connection.database);
            const collection = db.collection(collectionName);

            // Sample a few documents to infer structure
            const samples = await collection.find({}).limit(5).toArray();
            await client.close();

            const fields = new Set<string>();
            const fieldTypes: { [key: string]: Set<string> } = {};

            samples.forEach((doc: any) => {
                Object.keys(doc).forEach(key => {
                    fields.add(key);
                    if (!fieldTypes[key]) {
                        fieldTypes[key] = new Set();
                    }
                    fieldTypes[key].add(typeof doc[key]);
                });
            });

            return Array.from(fields).map(field => ({
                column_name: field,
                data_type: Array.from(fieldTypes[field]).join(' | '),
                is_nullable: 'YES',
                column_default: null
            }));
        } catch (error) {
            console.error('Error getting MongoDB document structure:', error);
            return [];
        }
    }

    private async getRedisKeyInfo(connection: DatabaseConnection, keyName: string): Promise<any[]> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = createClient({
                socket: { host: connection.host, port: connection.port },
                password
            });

            await client.connect();
            const type = await client.type(keyName);
            const ttl = await client.ttl(keyName);
            await client.disconnect();

            return [
                { column_name: 'key', data_type: 'string', value: keyName },
                { column_name: 'type', data_type: 'string', value: type },
                { column_name: 'ttl', data_type: 'integer', value: ttl }
            ];
        } catch (error) {
            console.error('Error getting Redis key info:', error);
            return [];
        }
    }

    private async getOracleColumns(connection: DatabaseConnection, tableName: string, schemaName: string): Promise<any[]> {
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
            const result = await conn.execute(`
                SELECT
                    column_name,
                    data_type,
                    nullable,
                    data_default,
                    data_length,
                    data_precision,
                    data_scale,
                    column_id
                FROM user_tab_columns
                WHERE table_name = UPPER(:tableName)
                ORDER BY column_id
            `, { tableName });
            await conn.close();

            return result.rows?.map((row: any) => ({
                column_name: row[0],
                data_type: row[1],
                is_nullable: row[2],
                column_default: row[3],
                character_maximum_length: row[4],
                numeric_precision: row[5],
                numeric_scale: row[6],
                ordinal_position: row[7]
            })) || [];
        } catch (error) {
            console.error('Error getting Oracle columns:', error);
            return [];
        }
    }

    async createDatabase(dbName: string): Promise<void> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        return this.createDatabaseByType(this.activeConnection, dbName);
    }

    async dropDatabase(dbName: string): Promise<void> {
        if (!this.activeConnection) {
            throw new Error('No active connection');
        }

        return this.dropDatabaseByType(this.activeConnection, dbName);
    }

    private async createDatabaseByType(connection: DatabaseConnection, dbName: string): Promise<void> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.createPostgreSQLDatabase(connection, dbName);
            case 'MongoDB':
                return this.createMongoDatabase(connection, dbName);
            case 'Redis':
                throw new Error('Redis does not support database creation');
            case 'Oracle':
                return this.createOracleDatabase(connection, dbName);
            default:
                throw new Error(`Database creation for ${connection.type} not yet implemented`);
        }
    }

    private async dropDatabaseByType(connection: DatabaseConnection, dbName: string): Promise<void> {
        switch (connection.type) {
            case 'PostgreSQL':
                return this.dropPostgreSQLDatabase(connection, dbName);
            case 'MongoDB':
                return this.dropMongoDatabase(connection, dbName);
            case 'Redis':
                return this.flushRedisDatabase(connection, dbName);
            case 'Oracle':
                return this.dropOracleDatabase(connection, dbName);
            default:
                throw new Error(`Database deletion for ${connection.type} not yet implemented`);
        }
    }

    private async createPostgreSQLDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
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
                database: 'postgres', // Connect to default database to create new one
                ssl: connection.ssl
            });

            await client.connect();
            // Use identifier quoting to prevent SQL injection
            await client.query(`CREATE DATABASE "${dbName}"`);
            await client.end();
        } catch (error) {
            throw new Error(`Failed to create PostgreSQL database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async dropPostgreSQLDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
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
                database: 'postgres', // Connect to default database to drop another
                ssl: connection.ssl
            });

            await client.connect();
            // Terminate existing connections to the database first
            await client.query(`
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [dbName]);

            // Use identifier quoting to prevent SQL injection
            await client.query(`DROP DATABASE "${dbName}"`);
            await client.end();
        } catch (error) {
            throw new Error(`Failed to drop PostgreSQL database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async createMongoDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}`;
            const client = new MongoClient(uri);
            await client.connect();

            // MongoDB creates databases implicitly when you first write to them
            const db = client.db(dbName);
            await db.createCollection('__init__'); // Create a dummy collection to initialize the database
            await client.close();
        } catch (error) {
            throw new Error(`Failed to create MongoDB database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async dropMongoDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
        try {
            let MongoClient: any;
            try {
                ({ MongoClient } = require('mongodb'));
            } catch (_e) {
                throw new Error('MongoDB support requires the "mongodb" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const uri = `mongodb://${connection.username}:${password}@${connection.host}:${connection.port}`;
            const client = new MongoClient(uri);
            await client.connect();

            const db = client.db(dbName);
            await db.dropDatabase();
            await client.close();
        } catch (error) {
            throw new Error(`Failed to drop MongoDB database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async flushRedisDatabase(connection: DatabaseConnection, dbNumber: string): Promise<void> {
        try {
            let createClient: any;
            try {
                ({ createClient } = require('redis'));
            } catch (_e) {
                throw new Error('Redis support requires the "redis" package. Please install dependencies.');
            }

            const password = await this.getPassword(connection);
            const client = createClient({
                socket: { host: connection.host, port: connection.port },
                password,
                database: parseInt(dbNumber.replace('db', ''))
            });

            await client.connect();
            await client.flushDb(); // Flush the selected database
            await client.disconnect();
        } catch (error) {
            throw new Error(`Failed to flush Redis database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async createOracleDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
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
                connectString: `${connection.host}:${connection.port}/${connection.database}`,
                privilege: oracledb.SYSDBA // May require DBA privileges
            };

            const conn = await oracledb.getConnection(connectionConfig);
            // Oracle database creation is complex and typically done by DBAs
            // This is a simplified version for pluggable databases
            await conn.execute(`CREATE PLUGGABLE DATABASE ${dbName} ADMIN USER pdb_admin IDENTIFIED BY "admin123"`);
            await conn.execute(`ALTER PLUGGABLE DATABASE ${dbName} OPEN`);
            await conn.close();
        } catch (error) {
            throw new Error(`Failed to create Oracle database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async dropOracleDatabase(connection: DatabaseConnection, dbName: string): Promise<void> {
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
                connectString: `${connection.host}:${connection.port}/${connection.database}`,
                privilege: oracledb.SYSDBA // May require DBA privileges
            };

            const conn = await oracledb.getConnection(connectionConfig);
            await conn.execute(`ALTER PLUGGABLE DATABASE ${dbName} CLOSE IMMEDIATE`);
            await conn.execute(`DROP PLUGGABLE DATABASE ${dbName} INCLUDING DATAFILES`);
            await conn.close();
        } catch (error) {
            throw new Error(`Failed to drop Oracle database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    getConnectionDetails(): any {
        return this.activeConnection;
    }

    onConnectionChanged(callback: () => void): void {
        // Initialize callbacks array if not exists
        this.connectionChangeCallbacks = this.connectionChangeCallbacks || [];
        this.connectionChangeCallbacks.push(callback);
    }
    
    /**
     * Notify all listeners of connection changes
     */
    private notifyConnectionChanged(): void {
        if (this.connectionChangeCallbacks) {
            this.connectionChangeCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('Error in connection change callback:', error);
                }
            });
        }
    }

    async openDesktopApp(): Promise<void> {
        // For now, just log - this would need proper implementation
        console.log('Opening desktop app');
    }

    private connectionChangeCallbacks?: (() => void)[];
}
