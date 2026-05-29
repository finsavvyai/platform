import * as vscode from 'vscode';
import { Client } from 'ssh2';
import * as crypto from 'crypto';

export interface AdvancedConnectionConfig {
    id: string;
    name: string;
    type: 'PostgreSQL' | 'MySQL' | 'MongoDB' | 'Redis' | 'Oracle' | 'SQLite' | 'SQL Server' | 'ClickHouse' | 'BigQuery' | 'Cassandra';
    host: string;
    port: number;
    username: string;
    password?: string;
    database?: string;
    ssl: boolean;
    ssh?: {
        enabled: boolean;
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKey?: string;
        passphrase?: string;
    };
    cloud?: {
        provider: 'AWS' | 'Azure' | 'GCP';
        region?: string;
        instanceId?: string;
        iamRole?: string;
    };
    connectionPool?: {
        min: number;
        max: number;
        idleTimeout: number;
    };
    timeout?: number;
    tags: string[];
    favorite: boolean;
    color?: string;
    lastUsed?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConnectionGroup {
    id: string;
    name: string;
    connections: string[];
    color?: string;
    collapsed: boolean;
}

export class AdvancedConnectionManager {
    private connections: Map<string, AdvancedConnectionConfig> = new Map();
    private groups: Map<string, ConnectionGroup> = new Map();
    private activeConnection: string | null = null;
    private sshTunnels: Map<string, Client> = new Map();
    private connectionPools: Map<string, any> = new Map();

    constructor() {
        this.loadConnections();
        this.setupAutoReconnect();
    }

    /**
     * Add a new database connection with advanced features
     */
    async addConnection(config: Omit<AdvancedConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const connection: AdvancedConnectionConfig = {
            ...config,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Test connection before saving
        const testResult = await this.testConnection(connection);
        if (!testResult.success) {
            throw new Error(`Connection test failed: ${testResult.error}`);
        }

        this.connections.set(id, connection);
        await this.saveConnections();
        
        vscode.window.showInformationMessage(`✅ Connection "${connection.name}" added successfully`);
        return id;
    }

    /**
     * Test connection with detailed diagnostics
     */
    async testConnection(config: AdvancedConnectionConfig): Promise<{success: boolean, error?: string, latency?: number, details?: any}> {
        const startTime = Date.now();
        
        try {
            // Setup SSH tunnel if needed
            let actualHost = config.host;
            let actualPort = config.port;
            
            if (config.ssh?.enabled) {
                const tunnelResult = await this.setupSSHTunnel(config);
                if (!tunnelResult.success) {
                    return { success: false, error: `SSH tunnel failed: ${tunnelResult.error}` };
                }
                actualHost = 'localhost';
                actualPort = tunnelResult.localPort!;
            }

            // Test database connection based on type
            const connectionResult = await this.testDatabaseConnection(config, actualHost, actualPort);
            const latency = Date.now() - startTime;

            if (connectionResult.success) {
                return {
                    success: true,
                    latency,
                    details: connectionResult.details
                };
            } else {
                return {
                    success: false,
                    error: connectionResult.error,
                    latency
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                latency: Date.now() - startTime
            };
        }
    }

    /**
     * Connect to database with connection pooling
     */
    async connect(connectionId: string): Promise<boolean> {
        const config = this.connections.get(connectionId);
        if (!config) {
            throw new Error('Connection not found');
        }

        try {
            // Setup SSH tunnel if needed
            if (config.ssh?.enabled) {
                const tunnelResult = await this.setupSSHTunnel(config);
                if (!tunnelResult.success) {
                    throw new Error(`SSH tunnel failed: ${tunnelResult.error}`);
                }
            }

            // Create connection pool
            const pool = await this.createConnectionPool(config);
            this.connectionPools.set(connectionId, pool);

            // Update last used timestamp
            config.lastUsed = new Date();
            config.updatedAt = new Date();
            this.connections.set(connectionId, config);
            await this.saveConnections();

            this.activeConnection = connectionId;
            vscode.window.showInformationMessage(`🔗 Connected to "${config.name}"`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Connection failed: ${error}`);
            return false;
        }
    }

    /**
     * Disconnect from database
     */
    async disconnect(connectionId?: string): Promise<void> {
        const id = connectionId || this.activeConnection;
        if (!id) {return;}

        const config = this.connections.get(id);
        if (!config) {return;}

        try {
            // Close connection pool
            const pool = this.connectionPools.get(id);
            if (pool) {
                await pool.end();
                this.connectionPools.delete(id);
            }

            // Close SSH tunnel
            if (config.ssh?.enabled) {
                const tunnel = this.sshTunnels.get(id);
                if (tunnel) {
                    tunnel.end();
                    this.sshTunnels.delete(id);
                }
            }

            if (this.activeConnection === id) {
                this.activeConnection = null;
            }

            vscode.window.showInformationMessage(`🔌 Disconnected from "${config.name}"`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Disconnect failed: ${error}`);
        }
    }

    /**
     * Setup SSH tunnel for secure connections
     */
    private async setupSSHTunnel(config: AdvancedConnectionConfig): Promise<{success: boolean, error?: string, localPort?: number}> {
        return new Promise((resolve) => {
            const ssh = new Client();
            const localPort = 0; // Let SSH client choose available port

            ssh.on('ready', () => {
                ssh.forwardOut('127.0.0.1', localPort, config.host, config.port, (err, stream) => {
                    if (err) {
                        resolve({ success: false, error: err.message });
                        return;
                    }

                    this.sshTunnels.set(config.id, ssh);
                    resolve({ success: true, localPort: localPort });
                });
            });

            ssh.on('error', (err) => {
                resolve({ success: false, error: err.message });
            });

            const sshConfig: any = {
                host: config.ssh!.host,
                port: config.ssh!.port,
                username: config.ssh!.username
            };

            if (config.ssh!.privateKey) {
                sshConfig.privateKey = config.ssh!.privateKey;
                if (config.ssh!.passphrase) {
                    sshConfig.passphrase = config.ssh!.passphrase;
                }
            } else if (config.ssh!.password) {
                sshConfig.password = config.ssh!.password;
            }

            ssh.connect(sshConfig);
        });
    }

    /**
     * Test database connection based on type
     */
    private async testDatabaseConnection(config: AdvancedConnectionConfig, host: string, port: number): Promise<{success: boolean, error?: string, details?: any}> {
        switch (config.type) {
            case 'PostgreSQL':
                return this.testPostgreSQLConnection(config, host, port);
            case 'MySQL':
                return this.testMySQLConnection(config, host, port);
            case 'MongoDB':
                return this.testMongoDBConnection(config, host, port);
            case 'Redis':
                return this.testRedisConnection(config, host, port);
            default:
                return { success: false, error: `Unsupported database type: ${config.type}` };
        }
    }

    /**
     * Test PostgreSQL connection
     */
    private async testPostgreSQLConnection(config: AdvancedConnectionConfig, host: string, port: number): Promise<{success: boolean, error?: string, details?: any}> {
        try {
            const { Client } = require('pg');
            const client = new Client({
                host,
                port,
                user: config.username,
                password: config.password,
                database: config.database || 'postgres',
                ssl: config.ssl
            });

            await client.connect();
            const result = await client.query('SELECT version(), current_database(), current_user');
            await client.end();

            return {
                success: true,
                details: {
                    version: result.rows[0].version,
                    database: result.rows[0].current_database,
                    user: result.rows[0].current_user
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Test MySQL connection
     */
    private async testMySQLConnection(config: AdvancedConnectionConfig, host: string, port: number): Promise<{success: boolean, error?: string, details?: any}> {
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host,
                port,
                user: config.username,
                password: config.password,
                database: config.database
            });

            const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as database, USER() as user');
            await connection.end();

            return {
                success: true,
                details: {
                    version: rows[0].version,
                    database: rows[0].database,
                    user: rows[0].user
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Test MongoDB connection
     */
    private async testMongoDBConnection(config: AdvancedConnectionConfig, host: string, port: number): Promise<{success: boolean, error?: string, details?: any}> {
        try {
            const { MongoClient } = require('mongodb');
            const uri = `mongodb://${config.username}:${config.password}@${host}:${port}/${config.database || 'admin'}`;
            
            const client = new MongoClient(uri);
            await client.connect();
            
            const admin = client.db().admin();
            const serverInfo = await admin.serverStatus();
            await client.close();

            return {
                success: true,
                details: {
                    version: serverInfo.version,
                    uptime: serverInfo.uptime,
                    host: serverInfo.host
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Test Redis connection
     */
    private async testRedisConnection(config: AdvancedConnectionConfig, host: string, port: number): Promise<{success: boolean, error?: string, details?: any}> {
        try {
            const redis = require('redis');
            const client = redis.createClient({
                host,
                port,
                password: config.password
            });

            await client.connect();
            const info = await client.info('server');
            await client.disconnect();

            return {
                success: true,
                details: {
                    info: info
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Create connection pool
     */
    private async createConnectionPool(config: AdvancedConnectionConfig): Promise<any> {
        const poolConfig = config.connectionPool || { min: 2, max: 10, idleTimeout: 30000 };
        
        switch (config.type) {
            case 'PostgreSQL':
                const { Pool } = require('pg');
                return new Pool({
                    host: config.host,
                    port: config.port,
                    user: config.username,
                    password: config.password,
                    database: config.database,
                    ssl: config.ssl,
                    min: poolConfig.min,
                    max: poolConfig.max,
                    idleTimeoutMillis: poolConfig.idleTimeout
                });
            case 'MySQL':
                const mysql = require('mysql2/promise');
                return mysql.createPool({
                    host: config.host,
                    port: config.port,
                    user: config.username,
                    password: config.password,
                    database: config.database,
                    connectionLimit: poolConfig.max,
                    acquireTimeout: poolConfig.idleTimeout
                });
            default:
                throw new Error(`Connection pooling not supported for ${config.type}`);
        }
    }

    /**
     * Get connection by ID
     */
    getConnection(id: string): AdvancedConnectionConfig | undefined {
        return this.connections.get(id);
    }

    /**
     * Get all connections
     */
    getAllConnections(): AdvancedConnectionConfig[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get active connection
     */
    getActiveConnection(): AdvancedConnectionConfig | undefined {
        if (!this.activeConnection) {return undefined;}
        return this.connections.get(this.activeConnection);
    }

    /**
     * Get connection pool
     */
    getConnectionPool(connectionId?: string): any {
        const id = connectionId || this.activeConnection;
        if (!id) {return null;}
        return this.connectionPools.get(id);
    }

    /**
     * Update connection
     */
    async updateConnection(id: string, updates: Partial<AdvancedConnectionConfig>): Promise<void> {
        const connection = this.connections.get(id);
        if (!connection) {
            throw new Error('Connection not found');
        }

        const updatedConnection = {
            ...connection,
            ...updates,
            id, // Ensure ID doesn't change
            updatedAt: new Date()
        };

        this.connections.set(id, updatedConnection);
        await this.saveConnections();
        
        vscode.window.showInformationMessage(`✅ Connection "${updatedConnection.name}" updated`);
    }

    /**
     * Delete connection
     */
    async deleteConnection(id: string): Promise<void> {
        const connection = this.connections.get(id);
        if (!connection) {
            throw new Error('Connection not found');
        }

        // Disconnect if active
        if (this.activeConnection === id) {
            await this.disconnect(id);
        }

        this.connections.delete(id);
        await this.saveConnections();
        
        vscode.window.showInformationMessage(`🗑️ Connection "${connection.name}" deleted`);
    }

    /**
     * Create connection group
     */
    async createGroup(name: string, color?: string): Promise<string> {
        const id = crypto.randomUUID();
        const group: ConnectionGroup = {
            id,
            name,
            connections: [],
            color,
            collapsed: false
        };

        this.groups.set(id, group);
        await this.saveConnections();
        return id;
    }

    /**
     * Add connection to group
     */
    async addConnectionToGroup(connectionId: string, groupId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        if (!group.connections.includes(connectionId)) {
            group.connections.push(connectionId);
            await this.saveConnections();
        }
    }

    /**
     * Setup auto-reconnect for dropped connections
     */
    private setupAutoReconnect(): void {
        setInterval(async () => {
            if (this.activeConnection) {
                const pool = this.connectionPools.get(this.activeConnection);
                if (pool) {
                    try {
                        // Test connection health
                        await this.testConnectionHealth(this.activeConnection);
                    } catch (error) {
                        console.log('Connection health check failed, attempting reconnect...');
                        await this.reconnect(this.activeConnection);
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Test connection health
     */
    private async testConnectionHealth(connectionId: string): Promise<void> {
        const pool = this.connectionPools.get(connectionId);
        if (!pool) {return;}

        // Simple query to test connection
        const connection = this.connections.get(connectionId);
        if (!connection) {return;}

        switch (connection.type) {
            case 'PostgreSQL':
                await pool.query('SELECT 1');
                break;
            case 'MySQL':
                await pool.execute('SELECT 1');
                break;
            default:
                // For other types, just check if pool exists
                break;
        }
    }

    /**
     * Reconnect to database
     */
    private async reconnect(connectionId: string): Promise<void> {
        try {
            await this.disconnect(connectionId);
            await this.connect(connectionId);
        } catch (error) {
            console.error('Reconnect failed:', error);
        }
    }

    /**
     * Load connections from storage
     */
    private async loadConnections(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb');
            const connections = config.get<AdvancedConnectionConfig[]>('connections', []);
            
            for (const conn of connections) {
                this.connections.set(conn.id, conn);
            }
        } catch (error) {
            console.error('Failed to load connections:', error);
        }
    }

    /**
     * Save connections to storage
     */
    private async saveConnections(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb');
            const connections = Array.from(this.connections.values());
            await config.update('connections', connections, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save connections:', error);
        }
    }
}
