import * as vscode from 'vscode';
import { Client } from 'pg';

export interface ConnectionDetails {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
}

export class SimpleConnectionManager {
    private client: Client | null = null;
    private connectionDetails: ConnectionDetails | undefined;

    public isConnected(): boolean {
        return this.client !== null;
    }

    /**
     * Connect using a PostgreSQL URL directly
     */
    public async connectWithUrl(url?: string): Promise<boolean> {
        try {
            if (!url) {
                url = await vscode.window.showInputBox({
                    prompt: 'PostgreSQL Connection URL',
                    placeHolder: 'postgresql://username:password@host:port/database',
                    value: 'postgresql://postgres:password@localhost:5432/postgres'
                });
                
                if (!url) {return false;}
            }

            // Parse and connect
            this.connectionDetails = this.parseConnectionUrl(url);
            this.client = new Client(this.connectionDetails);
            await this.client.connect();

            vscode.window.showInformationMessage(`Connected to PostgreSQL: ${this.connectionDetails.host}:${this.connectionDetails.port}/${this.connectionDetails.database}`);
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
            return false;
        }
    }

    public async connect(): Promise<boolean> {
        try {
            // Ask user for connection method
            const connectionMethod = await vscode.window.showQuickPick([
                { label: 'Connection URL', description: 'postgresql://user:pass@host:port/db' },
                { label: 'Individual Fields', description: 'Enter host, port, database, etc. separately' }
            ], {
                placeHolder: 'How would you like to connect?'
            });

            if (!connectionMethod) {return false;}

            let connectionDetails: ConnectionDetails;

            if (connectionMethod.label === 'Connection URL') {
                // Get connection URL
                const connectionUrl = await vscode.window.showInputBox({
                    prompt: 'PostgreSQL Connection URL',
                    placeHolder: 'postgresql://username:password@host:port/database',
                    value: 'postgresql://postgres:password@localhost:5432/postgres'
                });
                
                if (!connectionUrl) {return false;}

                // Parse connection URL
                connectionDetails = this.parseConnectionUrl(connectionUrl);
            } else {
                // Get connection details individually
                const host = await vscode.window.showInputBox({
                    prompt: 'PostgreSQL Host',
                    value: 'localhost'
                });
                if (!host) {return false;}

                const port = await vscode.window.showInputBox({
                    prompt: 'PostgreSQL Port',
                    value: '5432'
                });
                if (!port) {return false;}

                const database = await vscode.window.showInputBox({
                    prompt: 'Database Name',
                    value: 'postgres'
                });
                if (!database) {return false;}

                const username = await vscode.window.showInputBox({
                    prompt: 'Username',
                    value: 'postgres'
                });
                if (!username) {return false;}

                const password = await vscode.window.showInputBox({
                    prompt: 'Password',
                    password: true
                });
                if (!password) {return false;}

                connectionDetails = {
                    host,
                    port: parseInt(port),
                    database,
                    username,
                    password
                };
            }

            this.connectionDetails = connectionDetails;

            this.client = new Client(this.connectionDetails);
            await this.client.connect();

            vscode.window.showInformationMessage(`Connected to PostgreSQL: ${this.connectionDetails.host}:${this.connectionDetails.port}/${this.connectionDetails.database}`);
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Parse PostgreSQL connection URL
     * Supports formats: postgresql://user:pass@host:port/db or postgres://user:pass@host:port/db
     */
    private parseConnectionUrl(url: string): ConnectionDetails {
        try {
            // Handle both postgresql:// and postgres:// schemes
            const normalizedUrl = url.replace(/^postgres:\/\//, 'postgresql://');
            const parsedUrl = new URL(normalizedUrl);

            const host = parsedUrl.hostname || 'localhost';
            const port = parsedUrl.port ? parseInt(parsedUrl.port) : 5432;
            const database = parsedUrl.pathname.slice(1) || 'postgres'; // Remove leading slash
            const username = parsedUrl.username || 'postgres';
            const password = decodeURIComponent(parsedUrl.password || '');

            return {
                host,
                port,
                database,
                username,
                password
            };
        } catch (error) {
            throw new Error(`Invalid connection URL format. Expected: postgresql://username:password@host:port/database`);
        }
    }

    public async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
            this.connectionDetails = undefined;
            vscode.window.showInformationMessage('Disconnected from PostgreSQL');
        }
    }

    public async executeQuery(query: string): Promise<any[]> {
        if (!this.client) {
            throw new Error('Not connected to database');
        }

        const result = await this.client.query(query);
        return result.rows;
    }

    public async getDatabases(): Promise<string[]> {
        const result = await this.executeQuery("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname");
        return result.map((row: any) => row.datname);
    }

    public async getTables(): Promise<any[]> {
        const result = await this.executeQuery(`
            SELECT table_name, table_schema 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name
        `);
        return result;
    }

    public async createDatabase(name: string): Promise<void> {
        await this.executeQuery(`CREATE DATABASE "${name}"`);
        vscode.window.showInformationMessage(`Database '${name}' created successfully`);
    }

    public async dropDatabase(name: string): Promise<void> {
        await this.executeQuery(`DROP DATABASE "${name}"`);
        vscode.window.showInformationMessage(`Database '${name}' dropped successfully`);
    }
}
