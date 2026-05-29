/**
 * Enhanced Schema Browser Provider
 * Provides schema and table browsing with structure information
 */

import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../enhancedExtension';

export class EnhancedDBSchemaProvider implements vscode.TreeDataProvider<SchemaItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SchemaItem | undefined | null | void> = new vscode.EventEmitter<SchemaItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SchemaItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private currentConnection: DatabaseConnection | undefined;
    private currentSchema: string = 'public';

    constructor(private context: ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setConnection(connection: DatabaseConnection | undefined): void {
        this.currentConnection = connection;
        this.refresh();
    }

    setSchema(schema: string): void {
        this.currentSchema = schema;
        this.refresh();
    }

    getTreeItem(element: SchemaItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SchemaItem): Thenable<SchemaItem[]> {
        if (!this.currentConnection) {
            return Promise.resolve([new SchemaItem(
                'No connection active',
                'info',
                vscode.TreeItemCollapsibleState.None
            )]);
        }

        if (!element) {
            // Root level - show schemas
            return this.getSchemas();
        } else if (element.contextValue === 'schema') {
            // Schema level - show tables and views
            return this.getTablesAndViews(element.schema);
        } else if (element.contextValue === 'tables') {
            // Tables folder - show tables
            return this.getTables(element.schema);
        } else if (element.contextValue === 'views') {
            // Views folder - show views
            return this.getViews(element.schema);
        }
        
        return Promise.resolve([]);
    }

    private async getSchemas(): Promise<SchemaItem[]> {
        try {
            const schemas = await this.context.queryService.getSchemas(
                this.currentConnection!.id,
                this.currentConnection!.database || 'postgres'
            );
            
            return schemas.map(schema => new SchemaItem(
                schema,
                'schema',
                vscode.TreeItemCollapsibleState.Collapsed,
                this.currentConnection!,
                schema
            ));
        } catch (error) {
            return [new SchemaItem(
                'Failed to load schemas',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }

    private async getTablesAndViews(schema: string): Promise<SchemaItem[]> {
        const items: SchemaItem[] = [];
        
        try {
            // Add tables folder
            const tables = await this.context.queryService.getTables(
                this.currentConnection!.id,
                schema
            );
            
            if (tables.length > 0) {
                items.push(new SchemaItem(
                    `Tables (${tables.length})`,
                    'tables',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    this.currentConnection!,
                    schema
                ));
            }

            // Add views folder
            const views = await this.context.queryService.getViews(
                this.currentConnection!.id,
                schema
            );
            
            if (views.length > 0) {
                items.push(new SchemaItem(
                    `Views (${views.length})`,
                    'views',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    this.currentConnection!,
                    schema
                ));
            }

            return items;
        } catch (error) {
            return [new SchemaItem(
                'Failed to load tables and views',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }

    private async getTables(schema: string): Promise<SchemaItem[]> {
        try {
            const tables = await this.context.queryService.getTables(
                this.currentConnection!.id,
                schema
            );
            
            return tables.map(table => new SchemaItem(
                table.table_name,
                'table',
                vscode.TreeItemCollapsibleState.None,
                this.currentConnection!,
                schema,
                table.table_name,
                'table'
            ));
        } catch (error) {
            return [new SchemaItem(
                'Failed to load tables',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }

    private async getViews(schema: string): Promise<SchemaItem[]> {
        try {
            const views = await this.context.queryService.getViews(
                this.currentConnection!.id,
                schema
            );
            
            return views.map(view => new SchemaItem(
                view.table_name,
                'view',
                vscode.TreeItemCollapsibleState.None,
                this.currentConnection!,
                schema,
                view.table_name,
                'view'
            ));
        } catch (error) {
            return [new SchemaItem(
                'Failed to load views',
                'error',
                vscode.TreeItemCollapsibleState.None
            )];
        }
    }
}

export class SchemaItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly connection?: DatabaseConnection,
        public readonly schema?: string,
        public readonly tableName?: string,
        public readonly objectType?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.command = this.getCommand();
    }

    private getTooltip(): string {
        if (this.connection && this.schema && this.tableName) {
            return `${this.schema}.${this.tableName}\nType: ${this.objectType}\nConnection: ${this.connection.name}`;
        } else if (this.connection && this.schema) {
            return `Schema: ${this.schema}\nConnection: ${this.connection.name}`;
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.type) {
            case 'schema':
                return new vscode.ThemeIcon('folder-opened');
            case 'tables':
                return new vscode.ThemeIcon('list-unordered');
            case 'views':
                return new vscode.ThemeIcon('eye');
            case 'table':
                return new vscode.ThemeIcon('table');
            case 'view':
                return new vscode.ThemeIcon('eye');
            case 'error':
                return new vscode.ThemeIcon('error');
            case 'info':
                return new vscode.ThemeIcon('info');
            default:
                return new vscode.ThemeIcon('folder');
        }
    }

    private getContextValue(): string {
        if (this.type === 'table' || this.type === 'view') {
            return 'table';
        } else if (this.type === 'schema') {
            return 'schema';
        } else if (this.type === 'tables') {
            return 'tables';
        } else if (this.type === 'views') {
            return 'views';
        }
        return 'item';
    }

    private getCommand(): vscode.Command | undefined {
        if (this.type === 'table' || this.type === 'view') {
            return {
                command: 'enhanceddb.viewTableData',
                title: 'View Data',
                arguments: [{
                    connectionId: this.connection!.id,
                    schema: this.schema,
                    table: this.tableName,
                    type: this.objectType
                }]
            };
        }
        return undefined;
    }
}


