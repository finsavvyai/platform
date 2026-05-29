/**
 * Enhanced Query Provider
 * Provides query management and execution capabilities
 */

import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../enhancedExtension';

export class EnhancedDBQueryProvider implements vscode.TreeDataProvider<QueryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<QueryItem | undefined | null | void> = new vscode.EventEmitter<QueryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<QueryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private currentConnection: DatabaseConnection | undefined;
    private queryHistory: any[] = [];
    private savedQueries: any[] = [];

    constructor(private context: ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setConnection(connection: DatabaseConnection | undefined): void {
        this.currentConnection = connection;
        this.refresh();
    }

    async loadQueryHistory(): Promise<void> {
        try {
            if (this.currentConnection) {
                this.queryHistory = await this.context.queryHistoryManager.getQueryHistory(
                    this.currentConnection.id
                );
                this.refresh();
            }
        } catch (error) {
            console.error('Failed to load query history:', error);
        }
    }

    async loadSavedQueries(): Promise<void> {
        try {
            // Load saved queries from workspace or extension storage
            this.savedQueries = await this.context.queryHistoryManager.getSavedQueries();
            this.refresh();
        } catch (error) {
            console.error('Failed to load saved queries:', error);
        }
    }

    getTreeItem(element: QueryItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: QueryItem): Thenable<QueryItem[]> {
        if (!this.currentConnection) {
            return Promise.resolve([new QueryItem(
                'No connection active',
                'info',
                vscode.TreeItemCollapsibleState.None
            )]);
        }

        if (!element) {
            // Root level - show query categories
            return this.getQueryCategories();
        } else if (element.contextValue === 'queryHistory') {
            // Query history level - show recent queries
            return this.getQueryHistory();
        } else if (element.contextValue === 'savedQueries') {
            // Saved queries level - show saved queries
            return this.getSavedQueries();
        } else if (element.contextValue === 'queryActions') {
            // Query actions level - show available actions
            return this.getQueryActions();
        }
        
        return Promise.resolve([]);
    }

    private async getQueryCategories(): Promise<QueryItem[]> {
        const items: QueryItem[] = [];

        // Query actions
        items.push(new QueryItem(
            'Query Actions',
            'queryActions',
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Query history
        items.push(new QueryItem(
            `Query History (${this.queryHistory.length})`,
            'queryHistory',
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Saved queries
        items.push(new QueryItem(
            `Saved Queries (${this.savedQueries.length})`,
            'savedQueries',
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        return items;
    }

    private async getQueryActions(): Promise<QueryItem[]> {
        const items: QueryItem[] = [];

        // New SQL query
        items.push(new QueryItem(
            'New SQL Query',
            'newSqlQuery',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'add'
        ));

        // Execute current query
        items.push(new QueryItem(
            'Execute Current Query',
            'executeQuery',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'play'
        ));

        // Execute selection
        items.push(new QueryItem(
            'Execute Selection',
            'executeSelection',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'play-circle'
        ));

        // Save current query
        items.push(new QueryItem(
            'Save Current Query',
            'saveQuery',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'save'
        ));

        // Load query from file
        items.push(new QueryItem(
            'Load Query from File',
            'loadQuery',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'folder-opened'
        ));

        return items;
    }

    private async getQueryHistory(): Promise<QueryItem[]> {
        if (this.queryHistory.length === 0) {
            return [new QueryItem(
                'No query history available',
                'info',
                vscode.TreeItemCollapsibleState.None
            )];
        }

        return this.queryHistory.slice(0, 20).map((query, index) => new QueryItem(
            `${query.query.substring(0, 50)}${query.query.length > 50 ? '...' : ''}`,
            'historyQuery',
            vscode.TreeItemCollapsibleState.None,
            query,
            query.success ? 'check' : 'error'
        ));
    }

    private async getSavedQueries(): Promise<QueryItem[]> {
        if (this.savedQueries.length === 0) {
            return [new QueryItem(
                'No saved queries available',
                'info',
                vscode.TreeItemCollapsibleState.None
            )];
        }

        return this.savedQueries.map(query => new QueryItem(
            query.name || 'Unnamed Query',
            'savedQuery',
            vscode.TreeItemCollapsibleState.None,
            query,
            'bookmark'
        ));
    }
}

export class QueryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly queryData?: any,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.command = this.getCommand();
    }

    private getTooltip(): string {
        if (this.queryData) {
            if (this.type === 'historyQuery') {
                return `Query: ${this.queryData.query}\nExecuted: ${this.queryData.timestamp}\nSuccess: ${this.queryData.success}\nExecution Time: ${this.queryData.executionTime}ms`;
            } else if (this.type === 'savedQuery') {
                return `Saved Query: ${this.queryData.name}\nDescription: ${this.queryData.description || 'No description'}\nCreated: ${this.queryData.createdAt}`;
            }
        }

        switch (this.type) {
            case 'queryActions':
                return 'Available query actions';
            case 'queryHistory':
                return 'Recent query execution history';
            case 'savedQueries':
                return 'Saved queries for reuse';
            case 'newSqlQuery':
                return 'Create a new SQL query file';
            case 'executeQuery':
                return 'Execute the current query in the active editor';
            case 'executeSelection':
                return 'Execute the selected text in the active editor';
            case 'saveQuery':
                return 'Save the current query to a file';
            case 'loadQuery':
                return 'Load a query from a file';
            default:
                return this.label;
        }
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.iconName) {
            return new vscode.ThemeIcon(this.iconName);
        }

        switch (this.type) {
            case 'queryActions':
                return new vscode.ThemeIcon('tools');
            case 'queryHistory':
                return new vscode.ThemeIcon('history');
            case 'savedQueries':
                return new vscode.ThemeIcon('bookmark');
            case 'newSqlQuery':
                return new vscode.ThemeIcon('add');
            case 'executeQuery':
                return new vscode.ThemeIcon('play');
            case 'executeSelection':
                return new vscode.ThemeIcon('play-circle');
            case 'saveQuery':
                return new vscode.ThemeIcon('save');
            case 'loadQuery':
                return new vscode.ThemeIcon('folder-opened');
            case 'historyQuery':
                return new vscode.ThemeIcon('history');
            case 'savedQuery':
                return new vscode.ThemeIcon('bookmark');
            case 'error':
                return new vscode.ThemeIcon('error');
            case 'info':
                return new vscode.ThemeIcon('info');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getContextValue(): string {
        return this.type;
    }

    private getCommand(): vscode.Command | undefined {
        switch (this.type) {
            case 'newSqlQuery':
                return {
                    command: 'enhanceddb.newSqlQuery',
                    title: 'New SQL Query'
                };
            case 'executeQuery':
                return {
                    command: 'enhanceddb.executeQuery',
                    title: 'Execute Query'
                };
            case 'executeSelection':
                return {
                    command: 'enhanceddb.executeSelection',
                    title: 'Execute Selection'
                };
            case 'saveQuery':
                return {
                    command: 'enhanceddb.saveQuery',
                    title: 'Save Query'
                };
            case 'loadQuery':
                return {
                    command: 'enhanceddb.loadQuery',
                    title: 'Load Query'
                };
            case 'historyQuery':
                return {
                    command: 'vscode.open',
                    title: 'Open Query',
                    arguments: [vscode.Uri.parse(`data:text/plain,${encodeURIComponent(this.queryData.query)}`)]
                };
            case 'savedQuery':
                return {
                    command: 'vscode.open',
                    title: 'Open Query',
                    arguments: [vscode.Uri.parse(`data:text/plain,${encodeURIComponent(this.queryData.query)}`)]
                };
            default:
                return undefined;
        }
    }
}


