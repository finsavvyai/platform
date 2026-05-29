import * as vscode from 'vscode';
import { DatabaseConnectionManager } from '../services/connectionManager';

/**
 * Types of database objects
 */
export enum NodeType {
    SERVER = 'server',
    DATABASE = 'database',
    SCHEMA = 'schema',
    TABLE = 'table',
    VIEW = 'view',
    COLUMN = 'column',
    FUNCTION = 'function'
}

/**
 * Class representing a node in the PostgreSQL explorer tree
 */
export class PostgreSQLNode extends vscode.TreeItem {
    public readonly breadcrumb: string[];
    
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: NodeType,
        public readonly parent?: PostgreSQLNode,
        public readonly details?: any
    ) {
        super(label, collapsibleState);
        
        // Set context value for when/context clauses
        this.contextValue = `pg${type.charAt(0).toUpperCase() + type.slice(1)}`;
        
        // Set icon
        this.iconPath = this.getIconPath();
        
        // Set tooltip
        this.tooltip = this.getTooltip();
        
        // Build breadcrumb path
        this.breadcrumb = this.buildBreadcrumb();
        
        // Enhanced description for better UX
        this.description = this.getDescription();
    }
    
    /**
     * Build breadcrumb navigation path
     */
    private buildBreadcrumb(): string[] {
        const breadcrumb: string[] = [];
        let current: PostgreSQLNode | undefined = this;
        
        while (current) {
            breadcrumb.unshift(current.label);
            current = current.parent;
        }
        
        return breadcrumb;
    }
    
    /**
     * Get enhanced description for the node
     */
    private getDescription(): string | undefined {
        switch (this.type) {
            case NodeType.SERVER:
                const serverDetails = this.details;
                if (serverDetails) {
                    return `${serverDetails.type || 'PostgreSQL'} • ${serverDetails.status || 'Connected'}`;
                }
                return 'Database Server';
            case NodeType.DATABASE:
                return 'Database';
            case NodeType.SCHEMA:
                return 'Schema';
            case NodeType.TABLE:
                const tableDetails = this.details;
                if (tableDetails && tableDetails.row_count !== undefined) {
                    return `${tableDetails.row_count} rows`;
                }
                return 'Table';
            case NodeType.VIEW:
                return 'View';
            case NodeType.COLUMN:
                const column = this.details;
                if (column) {
                    let desc = column.data_type;
                    if (column.character_maximum_length) {
                        desc += `(${column.character_maximum_length})`;
                    }
                    if (column.is_nullable === 'NO') {
                        desc += ' • NOT NULL';
                    }
                    return desc;
                }
                return 'Column';
            case NodeType.FUNCTION:
                return 'Function';
            default:
                return undefined;
        }
    }
    
    /**
     * Get the appropriate icon for this node type
     */
    private getIconPath(): { light: vscode.Uri; dark: vscode.Uri } | undefined {
        const baseIconName = (): string => {
            switch (this.type) {
                case NodeType.SERVER:
                    return 'server';
                case NodeType.DATABASE:
                    return 'database';
                case NodeType.SCHEMA:
                    return 'schema';
                case NodeType.TABLE:
                    return 'table';
                case NodeType.VIEW:
                    return 'view';
                case NodeType.COLUMN:
                    return 'column';
                case NodeType.FUNCTION:
                    return 'function';
                default:
                    return 'default';
            }
        };
        
        const iconName = baseIconName();
        
        return {
            light: vscode.Uri.file(`resources/light/${iconName}.svg`),
            dark: vscode.Uri.file(`resources/dark/${iconName}.svg`)
        };
    }
    
    /**
     * Generate a helpful tooltip for this node
     */
    private getTooltip(): string {
        switch (this.type) {
            case NodeType.SERVER:
                return `PostgreSQL Server: ${this.label}`;
            case NodeType.DATABASE:
                return `Database: ${this.label}`;
            case NodeType.SCHEMA:
                return `Schema: ${this.label}`;
            case NodeType.TABLE:
                return `Table: ${this.parent?.label}.${this.label}`;
            case NodeType.VIEW:
                return `View: ${this.parent?.label}.${this.label}`;
            case NodeType.COLUMN:
                const column = this.details;
                if (column) {
                    return `${this.label} (${column.data_type})${column.is_nullable === 'YES' ? ', Nullable' : ''}`;
                }
                return `Column: ${this.label}`;
            case NodeType.FUNCTION:
                return `Function: ${this.label}`;
            default:
                return this.label;
        }
    }
}

/**
 * Tree data provider for PostgreSQL objects
 */
export class PostgreSQLTreeProvider implements vscode.TreeDataProvider<PostgreSQLNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<PostgreSQLNode | undefined | void> = new vscode.EventEmitter<PostgreSQLNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<PostgreSQLNode | undefined | void> = this._onDidChangeTreeData.event;
    private loadingNodes: Set<string> = new Set();
    
    constructor(private connectionManager: DatabaseConnectionManager) {
        // Listen for connection changes to refresh the tree
        this.connectionManager.onConnectionChanged(() => {
            this.refresh();
        });
    }
    
    /**
     * Refresh the explorer tree
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Get a tree item for a given node
     */
    getTreeItem(element: PostgreSQLNode): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get children for a given node
     */
    async getChildren(element?: PostgreSQLNode): Promise<PostgreSQLNode[]> {
        // If not connected, show enhanced connection info
        if (!this.connectionManager.isConnected()) {
            const connections = this.connectionManager.getAllConnections();
            if (connections.length === 0) {
                return [
                    new PostgreSQLNode(
                        'No connections configured',
                        vscode.TreeItemCollapsibleState.None,
                        NodeType.SERVER,
                        undefined,
                        { description: 'Click + to add a connection' }
                    )
                ];
            } else {
                return [
                    new PostgreSQLNode(
                        'Not connected',
                        vscode.TreeItemCollapsibleState.None,
                        NodeType.SERVER,
                        undefined,
                        { description: 'Select a connection to connect' }
                    )
                ];
            }
        }
        
        const nodeKey = element ? `${element.type}-${element.label}` : 'root';
        
        try {
            // Show loading state
            if (this.loadingNodes.has(nodeKey)) {
                return [
                    new PostgreSQLNode(
                        'Loading...',
                        vscode.TreeItemCollapsibleState.None,
                        NodeType.SERVER,
                        element,
                        { isLoading: true }
                    )
                ];
            }
            
            this.loadingNodes.add(nodeKey);
            
            // Root node - show server with enhanced details
            if (!element) {
                const details = this.connectionManager.getConnectionDetails();
                if (details) {
                    const serverNode = new PostgreSQLNode(
                        `${details.name || details.host}`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        NodeType.SERVER,
                        undefined,
                        { 
                            ...details, 
                            status: 'Connected',
                            description: `${details.host}:${details.port}`
                        }
                    );
                    this.loadingNodes.delete(nodeKey);
                    return [serverNode];
                }
                this.loadingNodes.delete(nodeKey);
                return [];
            }
            
            // Children of server node - databases with enhanced info
            if (element.type === NodeType.SERVER) {
                const databases = await this.connectionManager.getDatabases();
                const dbNodes = databases.map((db: any) => 
                    new PostgreSQLNode(
                        typeof db === 'string' ? db : db.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        NodeType.DATABASE,
                        element,
                        { 
                            name: typeof db === 'string' ? db : db.name,
                            size: typeof db === 'object' ? db.size : undefined
                        }
                    )
                );
                this.loadingNodes.delete(nodeKey);
                return dbNodes;
            }
            
            // Children of database node - schemas with better organization
            if (element.type === NodeType.DATABASE) {
                // Show public schema and system schemas separately
                const schemas = [
                    new PostgreSQLNode(
                        'public',
                        vscode.TreeItemCollapsibleState.Expanded,
                        NodeType.SCHEMA,
                        element,
                        { isDefault: true }
                    ),
                    new PostgreSQLNode(
                        'information_schema',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        NodeType.SCHEMA,
                        element,
                        { isSystem: true }
                    )
                ];
                this.loadingNodes.delete(nodeKey);
                return schemas;
            }
            
            // Children of schema node - tables and views with enhanced info
            if (element.type === NodeType.SCHEMA) {
                const dbName = element.parent?.label || '';
                const tables = await this.connectionManager.getTables(dbName);
                
                const tableNodes: PostgreSQLNode[] = [];
                const viewNodes: PostgreSQLNode[] = [];
                
                // Process tables with enhanced metadata
                for (const table of tables) {
                    const tableName = typeof table === 'string' ? table : (table as any)?.table_name || table;
                    const tableType = typeof table === 'object' && table !== null ? (table as any)?.table_type || 'BASE TABLE' : 'BASE TABLE';
                    
                    const tableDetails = typeof table === 'object' && table !== null ? table : { table_name: tableName, table_type: tableType };
                    
                    if (tableType === 'BASE TABLE' || !tableType) {
                        tableNodes.push(
                            new PostgreSQLNode(
                                tableName,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                NodeType.TABLE,
                                element,
                                { 
                                    ...tableDetails,
                                    table_name: tableName,
                                    table_type: 'BASE TABLE'
                                }
                            )
                        );
                    } else if (tableType === 'VIEW') {
                        viewNodes.push(
                            new PostgreSQLNode(
                                tableName,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                NodeType.VIEW,
                                element,
                                { 
                                    ...tableDetails,
                                    table_name: tableName,
                                    table_type: 'VIEW'
                                }
                            )
                        );
                    }
                }
                
                this.loadingNodes.delete(nodeKey);
                return [...tableNodes, ...viewNodes];
            }
            
            // Children of table or view node - columns with enhanced details
            if (element.type === NodeType.TABLE || element.type === NodeType.VIEW) {
                const schemaName = element.parent?.label || 'public';
                const tableName = element.label;
                
                const columns = await this.connectionManager.getTableColumns(tableName, schemaName);
                
                const columnNodes = columns.map((col: any) => {
                    let displayName = col.column_name;
                    
                    // Add key indicators
                    if (col.is_primary_key) {
                        displayName += ' 🔑';
                    } else if (col.is_foreign_key) {
                        displayName += ' 🔗';
                    }
                    
                    return new PostgreSQLNode(
                        displayName,
                        vscode.TreeItemCollapsibleState.None,
                        NodeType.COLUMN,
                        element,
                        col
                    );
                });
                
                this.loadingNodes.delete(nodeKey);
                return columnNodes;
            }
            
            this.loadingNodes.delete(nodeKey);
            return [];
        } 
        catch (err: any) {
            this.loadingNodes.delete(nodeKey);
            console.error('Error loading database objects:', err);
            
            // Show user-friendly error messages
            const errorMessage = this.getErrorMessage(err);
            vscode.window.showErrorMessage(`Database Explorer: ${errorMessage}`);
            
            return [
                new PostgreSQLNode(
                    '⚠️ Error loading data',
                    vscode.TreeItemCollapsibleState.None,
                    NodeType.SERVER,
                    element,
                    { 
                        error: true,
                        errorMessage: errorMessage,
                        description: 'Click to retry'
                    }
                )
            ];
        }
    }
    
    /**
     * Get user-friendly error message
     */
    private getErrorMessage(error: any): string {
        const message = error.message || String(error);
        
        if (message.includes('ECONNREFUSED')) {
            return 'Connection refused - check if database is running';
        } else if (message.includes('ENOTFOUND')) {
            return 'Host not found - check connection settings';
        } else if (message.includes('authentication failed')) {
            return 'Authentication failed - check username/password';
        } else if (message.includes('database') && message.includes('does not exist')) {
            return 'Database does not exist';
        } else if (message.includes('timeout')) {
            return 'Connection timeout - check network connectivity';
        } else {
            return message.length > 100 ? message.substring(0, 100) + '...' : message;
        }
    }
}
