/**
 * Enhanced Database Connection Provider
 * Provides connection management with modern UI
 */

import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../enhancedExtension';

export class EnhancedDBConnectionProvider implements vscode.TreeDataProvider<ConnectionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionItem | undefined | null | void> = new vscode.EventEmitter<ConnectionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConnectionItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConnectionItem): Thenable<ConnectionItem[]> {
        if (!element) {
            // Root level - show connections
            return this.getConnections();
        } else if (element.contextValue === 'connection') {
            // Connection level - show databases
            return this.getDatabases(element.connection);
        } else if (element.contextValue === 'database') {
            // Database level - show schemas
            return this.getSchemas(element.connection, element.database);
        }
        
        return Promise.resolve([]);
    }

    private async getConnections(): Promise<ConnectionItem[]> {
        try {
            const connections = await this.context.connectionManager.getConnections();
            return connections.map(conn => new ConnectionItem(
                conn.name,
                conn.type,
                conn.status || 'disconnected',
                vscode.TreeItemCollapsibleState.Collapsed,
                conn
            ));
        } catch (error) {
            return [new ConnectionItem(
                'No connections found',
                'info',
                'disconnected',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }

    private async getDatabases(connection: DatabaseConnection): Promise<ConnectionItem[]> {
        try {
            const databases = await this.context.queryService.getDatabases(connection.id);
            return databases.map(db => new ConnectionItem(
                db,
                'database',
                'connected',
                vscode.TreeItemCollapsibleState.Collapsed,
                connection,
                db
            ));
        } catch (error) {
            return [new ConnectionItem(
                'Failed to load databases',
                'error',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }

    private async getSchemas(connection: DatabaseConnection, database: string): Promise<ConnectionItem[]> {
        try {
            const schemas = await this.context.queryService.getSchemas(connection.id, database);
            return schemas.map(schema => new ConnectionItem(
                schema,
                'schema',
                'connected',
                vscode.TreeItemCollapsibleState.None,
                connection,
                database,
                schema
            ));
        } catch (error) {
            return [new ConnectionItem(
                'Failed to load schemas',
                'error',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }
}

export class ConnectionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: string,
        public readonly status: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly connection?: DatabaseConnection,
        public readonly database?: string,
        public readonly schema?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.command = this.getCommand();
    }

    private getTooltip(): string {
        if (this.connection) {
            return `${this.connection.name} (${this.connection.type})\n${this.connection.host}:${this.connection.port}\nStatus: ${this.status}`;
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.type) {
            case 'PostgreSQL':
                return new vscode.ThemeIcon('database', this.getStatusColor());
            case 'MongoDB':
                return new vscode.ThemeIcon('database', this.getStatusColor());
            case 'Redis':
                return new vscode.ThemeIcon('database', this.getStatusColor());
            case 'Oracle':
                return new vscode.ThemeIcon('database', this.getStatusColor());
            case 'database':
                return new vscode.ThemeIcon('folder-opened');
            case 'schema':
                return new vscode.ThemeIcon('folder');
            case 'error':
                return new vscode.ThemeIcon('error');
            case 'info':
                return new vscode.ThemeIcon('info');
            default:
                return new vscode.ThemeIcon('database');
        }
    }

    private getStatusColor(): vscode.ThemeColor | undefined {
        switch (this.status) {
            case 'connected':
                return new vscode.ThemeColor('charts.green');
            case 'disconnected':
                return new vscode.ThemeColor('charts.gray');
            case 'error':
                return new vscode.ThemeColor('charts.red');
            case 'testing':
                return new vscode.ThemeColor('charts.yellow');
            default:
                return undefined;
        }
    }

    private getContextValue(): string {
        if (this.connection) {
            return 'connection';
        } else if (this.database) {
            return 'database';
        } else if (this.schema) {
            return 'schema';
        }
        return 'item';
    }

    private getCommand(): vscode.Command | undefined {
        if (this.connection && this.type !== 'database' && this.type !== 'schema') {
            return {
                command: 'enhanceddb.connect',
                title: 'Connect',
                arguments: [this.connection]
            };
        }
        return undefined;
    }
}


