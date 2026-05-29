import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../ultimateExtension';

type ExplorerNodeType = 'root' | 'schema' | 'table' | 'column' | 'message';

class ExplorerItem extends vscode.TreeItem {
    constructor(
        public readonly nodeType: ExplorerNodeType,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly schema?: string,
        public readonly table?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = nodeType === 'table' ? 'dbTable' : nodeType;
        if (nodeType === 'schema') {this.iconPath = new vscode.ThemeIcon('library');}
        if (nodeType === 'table') {this.iconPath = new vscode.ThemeIcon('table');}
        if (nodeType === 'column') {this.iconPath = new vscode.ThemeIcon('symbol-field');}
    }
}

export class UltimateDBExplorerProvider implements vscode.TreeDataProvider<ExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExplorerItem | undefined | null | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<ExplorerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private ext: ExtensionContext) {}

    refresh(): void { this._onDidChangeTreeData.fire(null); }
    getTreeItem(element: ExplorerItem): vscode.TreeItem { return element; }

    async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
        const active = this.ext.connectionManager.getActiveConnection();
        if (!active) {
            return [new ExplorerItem('message', 'No active connection', vscode.TreeItemCollapsibleState.None)];
        }
        if (active.type !== 'PostgreSQL') {
            return [new ExplorerItem('message', `${active.type} explorer not implemented yet`, vscode.TreeItemCollapsibleState.None)];
        }

        if (!element) {
            // Root -> list schemas
            const schemas = await this.fetchPostgresSchemas(active);
            return schemas.map(s => new ExplorerItem('schema', s, vscode.TreeItemCollapsibleState.Collapsed, s));
        }

        if (element.nodeType === 'schema' && element.schema) {
            const tables = await this.fetchPostgresTables(active, element.schema);
            return tables.map(t => new ExplorerItem('table', t, vscode.TreeItemCollapsibleState.Collapsed, element.schema, t));
        }

        if (element.nodeType === 'table' && element.schema && element.table) {
            const cols = await this.fetchPostgresColumns(active, element.schema, element.table);
            return cols.map(c => new ExplorerItem('column', c, vscode.TreeItemCollapsibleState.None, element.schema, element.table));
        }

        return [];
    }

    private async fetchPostgresSchemas(conn: DatabaseConnection): Promise<string[]> {
        try {
            const result = await this.ext.connectionManager.executeQuery(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name"
            );
            return result.rows?.map((r: any) => r.schema_name) || [];
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to load schemas: ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }

    private async fetchPostgresTables(conn: DatabaseConnection, schema: string): Promise<string[]> {
        try {
            const result = await this.ext.connectionManager.executeQuery(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`
            );
            return result.rows?.map((r: any) => r.table_name) || [];
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to load tables: ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }

    private async fetchPostgresColumns(conn: DatabaseConnection, schema: string, table: string): Promise<string[]> {
        try {
            const result = await this.ext.connectionManager.executeQuery(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY ordinal_position`
            );
            return result.rows?.map((r: any) => `${r.column_name} (${r.data_type})`) || [];
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to load columns: ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }
}
