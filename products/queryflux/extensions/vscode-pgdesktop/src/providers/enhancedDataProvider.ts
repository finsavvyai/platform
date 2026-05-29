/**
 * Enhanced Data Editor Provider
 * Provides data editing capabilities with inline editing support
 */

import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../enhancedExtension';

export class EnhancedDBDataProvider implements vscode.TreeDataProvider<DataItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DataItem | undefined | null | void> = new vscode.EventEmitter<DataItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DataItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private currentConnection: DatabaseConnection | undefined;
    private currentTable: string | undefined;
    private currentSchema: string | undefined;
    private editMode: boolean = false;
    private pendingChanges: Map<string, any> = new Map();

    constructor(private context: ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setConnection(connection: DatabaseConnection | undefined): void {
        this.currentConnection = connection;
        this.refresh();
    }

    setTable(schema: string, table: string): void {
        this.currentSchema = schema;
        this.currentTable = table;
        this.refresh();
    }

    toggleEditMode(): void {
        this.editMode = !this.editMode;
        this.refresh();
    }

    getEditMode(): boolean {
        return this.editMode;
    }

    getPendingChangesCount(): number {
        return this.pendingChanges.size;
    }

    clearPendingChanges(): void {
        this.pendingChanges.clear();
        this.refresh();
    }

    getTreeItem(element: DataItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DataItem): Thenable<DataItem[]> {
        if (!this.currentConnection || !this.currentTable) {
            return Promise.resolve([new DataItem(
                'No table selected',
                'info',
                vscode.TreeItemCollapsibleState.None
            )]);
        }

        if (!element) {
            // Root level - show table info and actions
            return this.getTableInfo();
        } else if (element.contextValue === 'tableInfo') {
            // Table info level - show data actions
            return this.getDataActions();
        }
        
        return Promise.resolve([]);
    }

    private async getTableInfo(): Promise<DataItem[]> {
        const items: DataItem[] = [];
        
        // Table information
        items.push(new DataItem(
            `Table: ${this.currentSchema}.${this.currentTable}`,
            'tableInfo',
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        // Edit mode status
        const editStatus = this.editMode ? 'Enabled' : 'Disabled';
        const editIcon = this.editMode ? 'check' : 'x';
        items.push(new DataItem(
            `Edit Mode: ${editStatus}`,
            'editStatus',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            editIcon
        ));

        // Pending changes
        const changesCount = this.pendingChanges.size;
        if (changesCount > 0) {
            items.push(new DataItem(
                `Pending Changes: ${changesCount}`,
                'pendingChanges',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'warning'
            ));
        }

        return items;
    }

    private async getDataActions(): Promise<DataItem[]> {
        const items: DataItem[] = [];

        // View data action
        items.push(new DataItem(
            'View Data',
            'viewData',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'eye'
        ));

        // Edit data action
        items.push(new DataItem(
            'Edit Data',
            'editData',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'edit'
        ));

        // Table structure action
        items.push(new DataItem(
            'View Structure',
            'viewStructure',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'list-unordered'
        ));

        // Constraints action
        items.push(new DataItem(
            'View Constraints',
            'viewConstraints',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'link'
        ));

        // Export action
        items.push(new DataItem(
            'Export Data',
            'exportData',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            'export'
        ));

        return items;
    }
}

export class DataItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly connection?: DatabaseConnection,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.command = this.getCommand();
    }

    private getTooltip(): string {
        switch (this.type) {
            case 'tableInfo':
                return 'Table information and actions';
            case 'editStatus':
                return 'Current edit mode status';
            case 'pendingChanges':
                return 'Number of pending changes';
            case 'viewData':
                return 'View table data in read-only mode';
            case 'editData':
                return 'Edit table data with inline editing';
            case 'viewStructure':
                return 'View detailed table structure';
            case 'viewConstraints':
                return 'View table constraints and indexes';
            case 'exportData':
                return 'Export table data to file';
            default:
                return this.label;
        }
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.iconName) {
            return new vscode.ThemeIcon(this.iconName);
        }

        switch (this.type) {
            case 'tableInfo':
                return new vscode.ThemeIcon('table');
            case 'editStatus':
                return new vscode.ThemeIcon('edit');
            case 'pendingChanges':
                return new vscode.ThemeIcon('warning');
            case 'viewData':
                return new vscode.ThemeIcon('eye');
            case 'editData':
                return new vscode.ThemeIcon('edit');
            case 'viewStructure':
                return new vscode.ThemeIcon('list-unordered');
            case 'viewConstraints':
                return new vscode.ThemeIcon('link');
            case 'exportData':
                return new vscode.ThemeIcon('export');
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
            case 'viewData':
                return {
                    command: 'enhanceddb.viewTableData',
                    title: 'View Data',
                    arguments: [{
                        connectionId: this.connection?.id,
                        schema: 'current',
                        table: 'current',
                        type: 'table'
                    }]
                };
            case 'editData':
                return {
                    command: 'enhanceddb.editTableData',
                    title: 'Edit Data',
                    arguments: [{
                        connectionId: this.connection?.id,
                        schema: 'current',
                        table: 'current',
                        type: 'table'
                    }]
                };
            case 'viewStructure':
                return {
                    command: 'enhanceddb.viewTableStructure',
                    title: 'View Structure',
                    arguments: [{
                        connectionId: this.connection?.id,
                        schema: 'current',
                        table: 'current',
                        type: 'table'
                    }]
                };
            case 'viewConstraints':
                return {
                    command: 'enhanceddb.showConstraints',
                    title: 'View Constraints',
                    arguments: [{
                        connectionId: this.connection?.id,
                        schema: 'current',
                        table: 'current',
                        type: 'table'
                    }]
                };
            case 'exportData':
                return {
                    command: 'enhanceddb.exportData',
                    title: 'Export Data',
                    arguments: [{
                        connectionId: this.connection?.id,
                        schema: 'current',
                        table: 'current',
                        type: 'table'
                    }]
                };
            default:
                return undefined;
        }
    }
}


