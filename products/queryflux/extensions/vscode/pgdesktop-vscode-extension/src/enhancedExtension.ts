/**
 * Enhanced Database Manager VSCode Extension
 * Features: Inline Data Editing, Schema Selection, Table Structure Viewing, Modern UI
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Import our providers and services
import { EnhancedDBConnectionProvider } from './providers/enhancedConnectionProvider';
import { EnhancedDBSchemaProvider } from './providers/enhancedSchemaProvider';
import { EnhancedDBDataProvider } from './providers/enhancedDataProvider';
import { EnhancedDBQueryProvider } from './providers/enhancedQueryProvider';
import { DatabaseConnectionManager } from './services/connectionManager';
import { QueryExecutionService } from './services/queryService';
import { QueryHistoryManager } from './services/queryHistoryManager';

// Types
export interface DatabaseConnection {
    id: string;
    name: string;
    type: 'PostgreSQL' | 'MongoDB' | 'Redis' | 'Oracle';
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
    schema?: string;
    ssl?: boolean;
    favorite?: boolean;
    tags?: string[];
    lastUsed?: Date;
    status?: 'connected' | 'disconnected' | 'error' | 'testing';
}

export interface TableStructure {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default?: string;
    character_maximum_length?: number;
    numeric_precision?: number;
    numeric_scale?: number;
    ordinal_position: number;
}

export interface TableConstraint {
    constraint_name: string;
    constraint_type: string;
    column_name?: string;
    foreign_table_name?: string;
    foreign_column_name?: string;
}

export interface TableIndex {
    indexname: string;
    indexdef: string;
}

export interface EditChange {
    item: string;
    column: string;
    column_index: number;
    old_value: string;
    new_value: string;
}

export interface ExtensionContext {
    connectionManager: DatabaseConnectionManager;
    queryService: QueryExecutionService;
    queryHistoryManager: QueryHistoryManager;
    outputChannel: vscode.OutputChannel;
    extensionPath: string;
}

// Extension state
let extensionContext: ExtensionContext;
let statusBarItem: vscode.StatusBarItem;

// Keep references to providers so we can refresh them
let connectionProviderRef: EnhancedDBConnectionProvider | undefined;
let schemaProviderRef: EnhancedDBSchemaProvider | undefined;
let dataProviderRef: EnhancedDBDataProvider | undefined;
let queryProviderRef: EnhancedDBQueryProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
    console.log('🚀 Enhanced Database Manager is now active!');

    // Create output channel
    const outputChannel = vscode.window.createOutputChannel('Enhanced DB Manager');
    outputChannel.appendLine('🚀 Enhanced Database Manager Extension Activated');

    // Initialize services
    const connectionManager = new DatabaseConnectionManager(context);
    const queryService = new QueryExecutionService(context);
    const queryHistoryManager = new QueryHistoryManager(connectionManager);

    // Store extension context
    extensionContext = {
        connectionManager,
        queryService,
        queryHistoryManager,
        outputChannel,
        extensionPath: context.extensionPath
    };

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(database) Enhanced DB";
    statusBarItem.tooltip = "Enhanced Database Manager - Click to connect";
    statusBarItem.command = 'enhanceddb.connectionManager';
    statusBarItem.show();

    // Register providers
    registerProviders(context);

    // Register commands
    registerCommands(context);

    // Register webview providers
    registerWebviewProviders(context);

    // Show welcome message
    showWelcomeMessage();

    console.log('✅ Enhanced Database Manager extension activated successfully!');
}

export function deactivate(): void {
    console.log('Enhanced Database Manager extension deactivated');
    
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    
    if (extensionContext) {
        extensionContext.outputChannel.dispose();
    }
}

function registerProviders(context: vscode.ExtensionContext): void {
    // Connection Provider
    connectionProviderRef = new EnhancedDBConnectionProvider(extensionContext);
    vscode.window.registerTreeDataProvider('enhanceddbConnections', connectionProviderRef);

    // Schema Browser Provider
    schemaProviderRef = new EnhancedDBSchemaProvider(extensionContext);
    vscode.window.registerTreeDataProvider('enhanceddbSchemaBrowser', schemaProviderRef);

    // Data Editor Provider
    dataProviderRef = new EnhancedDBDataProvider(extensionContext);
    vscode.window.registerTreeDataProvider('enhanceddbDataEditor', dataProviderRef);

    // Query Provider
    queryProviderRef = new EnhancedDBQueryProvider(extensionContext);
    vscode.window.registerTreeDataProvider('enhanceddbQueries', queryProviderRef);
}

function registerCommands(context: vscode.ExtensionContext): void {
    // Connection Management Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.connectionManager', () => {
            showConnectionManager();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.connect', async (connection?: DatabaseConnection) => {
            if (connection) {
                await connectToDatabase(connection);
            } else {
                showConnectionManager();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.addConnection', () => {
            showAddConnectionDialog();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.editConnection', (connection: DatabaseConnection) => {
            showEditConnectionDialog(connection);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.deleteConnection', (connection: DatabaseConnection) => {
            deleteConnection(connection);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.testConnection', async (connection: DatabaseConnection) => {
            await testConnection(connection);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.refresh', () => {
            refreshAllProviders();
        })
    );

    // Schema and Table Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.switchSchema', (connection: DatabaseConnection) => {
            showSchemaSelector(connection);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.viewTableStructure', async (tableInfo: any) => {
            await showTableStructure(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.viewTableData', async (tableInfo: any) => {
            await showTableData(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.editTableData', async (tableInfo: any) => {
            await showTableDataEditor(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.showConstraints', async (tableInfo: any) => {
            await showTableConstraints(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.showPrimaryKeys', async (tableInfo: any) => {
            await showPrimaryKeys(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.showForeignKeys', async (tableInfo: any) => {
            await showForeignKeys(tableInfo);
        })
    );

    // Data Editing Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.toggleEditMode', () => {
            toggleEditMode();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.saveDataChanges', () => {
            saveDataChanges();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.discardDataChanges', () => {
            discardDataChanges();
        })
    );

    // Query Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.executeQuery', () => {
            executeCurrentQuery();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.executeSelection', () => {
            executeSelectedQuery();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.newSqlQuery', () => {
            createNewSqlQuery();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.saveQuery', () => {
            saveCurrentQuery();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.loadQuery', () => {
            loadQueryFromFile();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.queryHistory', () => {
            showQueryHistory();
        })
    );

    // Utility Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.copyCreateTable', async (tableInfo: any) => {
            await copyCreateTableStatement(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.exportData', async (tableInfo: any) => {
            await exportTableData(tableInfo);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.importData', async (tableInfo: any) => {
            await importTableData(tableInfo);
        })
    );

    // GUI Launcher
    context.subscriptions.push(
        vscode.commands.registerCommand('enhanceddb.launchEnhancedGUI', () => {
            launchEnhancedGUI();
        })
    );
}

function registerWebviewProviders(context: vscode.ExtensionContext): void {
    // Register webview providers for enhanced UI components
    // This will be implemented to show table structure, data editing, etc.
}

// Command implementations
async function showConnectionManager(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'connectionManager',
        'Enhanced DB Connection Manager',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getConnectionManagerHtml();
}

async function connectToDatabase(connection: DatabaseConnection): Promise<void> {
    try {
        extensionContext.outputChannel.appendLine(`Connecting to ${connection.name}...`);
        
        // Test connection
        const isConnected = await extensionContext.connectionManager.testConnection(connection);
        
        if (isConnected) {
            vscode.window.showInformationMessage(`✅ Connected to ${connection.name}`);
            extensionContext.connectionManager.setActiveConnection(connection);
            refreshAllProviders();
            updateStatusBar(connection);
        } else {
            vscode.window.showErrorMessage(`❌ Failed to connect to ${connection.name}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Connection error: ${error}`);
        extensionContext.outputChannel.appendLine(`Connection error: ${error}`);
    }
}

async function showTableStructure(tableInfo: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'tableStructure',
        `Table Structure: ${tableInfo.schema}.${tableInfo.table}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    try {
        const structure = await extensionContext.queryService.getTableStructure(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema
        );

        const constraints = await extensionContext.queryService.getTableConstraints(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema
        );

        const indexes = await extensionContext.queryService.getTableIndexes(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema
        );

        panel.webview.html = getTableStructureHtml(structure, constraints, indexes, tableInfo);
    } catch (error) {
        panel.webview.html = getErrorHtml(`Failed to load table structure: ${error}`);
    }
}

async function showTableData(tableInfo: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'tableData',
        `Table Data: ${tableInfo.schema}.${tableInfo.table}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    try {
        const data = await extensionContext.queryService.getTableData(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema,
            1000 // limit
        );

        panel.webview.html = getTableDataHtml(data, tableInfo);
    } catch (error) {
        panel.webview.html = getErrorHtml(`Failed to load table data: ${error}`);
    }
}

async function showTableDataEditor(tableInfo: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'tableDataEditor',
        `Edit Data: ${tableInfo.schema}.${tableInfo.table}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    try {
        const data = await extensionContext.queryService.getTableData(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema,
            1000 // limit
        );

        const structure = await extensionContext.queryService.getTableStructure(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema
        );

        panel.webview.html = getTableDataEditorHtml(data, structure, tableInfo);
    } catch (error) {
        panel.webview.html = getErrorHtml(`Failed to load table data editor: ${error}`);
    }
}

async function executeCurrentQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const query = editor.document.getText();
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to execute');
        return;
    }

    await executeQuery(query);
}

async function executeSelectedQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const selection = editor.selection;
    const query = editor.document.getText(selection);
    if (!query.trim()) {
        vscode.window.showWarningMessage('No selection to execute');
        return;
    }

    await executeQuery(query);
}

async function executeQuery(query: string): Promise<void> {
    const activeConnection = extensionContext.connectionManager.getActiveConnection();
    if (!activeConnection) {
        vscode.window.showWarningMessage('No active database connection');
        return;
    }

    try {
        extensionContext.outputChannel.appendLine(`Executing query: ${query.substring(0, 100)}...`);
        
        const result = await extensionContext.queryService.executeQuery(
            activeConnection.id,
            query
        );

        // Show results in a new panel
        const panel = vscode.window.createWebviewPanel(
            'queryResults',
            'Query Results',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = getQueryResultsHtml(result, query);

        // Save to history
        await extensionContext.queryHistoryManager.saveQuery({
            connectionId: activeConnection.id,
            query: query,
            executionTime: result.executionTime,
            success: true,
            rowCount: result.rowCount
        });

        vscode.window.showInformationMessage(`✅ Query executed successfully (${result.executionTime}ms)`);
    } catch (error) {
        vscode.window.showErrorMessage(`Query execution failed: ${error}`);
        extensionContext.outputChannel.appendLine(`Query execution failed: ${error}`);
    }
}

function refreshAllProviders(): void {
    if (connectionProviderRef) {
        connectionProviderRef.refresh();
    }
    if (schemaProviderRef) {
        schemaProviderRef.refresh();
    }
    if (dataProviderRef) {
        dataProviderRef.refresh();
    }
    if (queryProviderRef) {
        queryProviderRef.refresh();
    }
}

function updateStatusBar(connection: DatabaseConnection): void {
    if (statusBarItem) {
        statusBarItem.text = `$(database) ${connection.name}`;
        statusBarItem.tooltip = `Connected to ${connection.name} (${connection.type})`;
    }
}

function showWelcomeMessage(): void {
    vscode.window.showInformationMessage(
        '🚀 Enhanced Database Manager is ready!',
        'Open Connection Manager'
    ).then(selection => {
        if (selection === 'Open Connection Manager') {
            showConnectionManager();
        }
    });
}

function launchEnhancedGUI(): void {
    const guiPath = path.join(extensionContext.extensionPath, '..', 'enhanced_db_manager_with_editing.py');
    
    if (fs.existsSync(guiPath)) {
        const python = spawn('python3', [guiPath], {
            detached: true,
            stdio: 'ignore'
        });
        python.unref();
        vscode.window.showInformationMessage('🚀 Enhanced Database Manager GUI launched!');
    } else {
        vscode.window.showErrorMessage('Enhanced GUI not found. Please ensure the Python files are available.');
    }
}

// HTML generators for webviews
function getConnectionManagerHtml(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enhanced DB Connection Manager</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            .connection-form { background: var(--vscode-editor-background); padding: 20px; border-radius: 8px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; color: var(--vscode-text-foreground); }
            input, select { width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
            button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: var(--vscode-button-hoverBackground); }
        </style>
    </head>
    <body>
        <h1 class="header">🚀 Enhanced Database Connection Manager</h1>
        <div class="connection-form">
            <h3>Add New Connection</h3>
            <div class="form-group">
                <label>Connection Name:</label>
                <input type="text" id="connectionName" placeholder="My Database">
            </div>
            <div class="form-group">
                <label>Database Type:</label>
                <select id="databaseType">
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="MongoDB">MongoDB</option>
                    <option value="Redis">Redis</option>
                    <option value="Oracle">Oracle</option>
                </select>
            </div>
            <div class="form-group">
                <label>Host:</label>
                <input type="text" id="host" placeholder="localhost">
            </div>
            <div class="form-group">
                <label>Port:</label>
                <input type="number" id="port" placeholder="5432">
            </div>
            <div class="form-group">
                <label>Username:</label>
                <input type="text" id="username" placeholder="username">
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="password" placeholder="password">
            </div>
            <div class="form-group">
                <label>Database:</label>
                <input type="text" id="database" placeholder="database name">
            </div>
            <div class="form-group">
                <label>Schema:</label>
                <input type="text" id="schema" placeholder="public" value="public">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="ssl"> Use SSL
                </label>
            </div>
            <button onclick="testConnection()">Test Connection</button>
            <button onclick="saveConnection()">Save Connection</button>
        </div>
        
        <script>
            function testConnection() {
                vscode.postMessage({ command: 'testConnection', data: getConnectionData() });
            }
            
            function saveConnection() {
                vscode.postMessage({ command: 'saveConnection', data: getConnectionData() });
            }
            
            function getConnectionData() {
                return {
                    name: document.getElementById('connectionName').value,
                    type: document.getElementById('databaseType').value,
                    host: document.getElementById('host').value,
                    port: parseInt(document.getElementById('port').value),
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value,
                    database: document.getElementById('database').value,
                    schema: document.getElementById('schema').value,
                    ssl: document.getElementById('ssl').checked
                };
            }
        </script>
    </body>
    </html>`;
}

function getTableStructureHtml(structure: TableStructure[], constraints: TableConstraint[], indexes: TableIndex[], tableInfo: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Table Structure</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            .section { margin-bottom: 30px; }
            .section h3 { color: var(--vscode-text-foreground); border-bottom: 1px solid var(--vscode-border-color); padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-border-color); }
            th { background: var(--vscode-editor-background); color: var(--vscode-text-foreground); font-weight: bold; }
            td { color: var(--vscode-text-foreground); }
            .primary-key { background: var(--vscode-textCodeBlock-background); font-weight: bold; }
            .not-null { color: var(--vscode-errorForeground); }
            .default { color: var(--vscode-textPreformat-foreground); font-family: monospace; }
        </style>
    </head>
    <body>
        <h1 class="header">📋 Table Structure: ${tableInfo.schema}.${tableInfo.table}</h1>
        
        <div class="section">
            <h3>Columns</h3>
            <table>
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Default</th>
                        <th>Position</th>
                    </tr>
                </thead>
                <tbody>
                    ${structure.map(col => `
                        <tr>
                            <td>${col.column_name}</td>
                            <td>${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}${col.numeric_precision ? `(${col.numeric_precision}${col.numeric_scale ? `,${col.numeric_scale}` : ''})` : ''}</td>
                            <td class="${col.is_nullable === 'NO' ? 'not-null' : ''}">${col.is_nullable}</td>
                            <td class="default">${col.column_default || ''}</td>
                            <td>${col.ordinal_position}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h3>Constraints</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Column</th>
                        <th>References</th>
                    </tr>
                </thead>
                <tbody>
                    ${constraints.map(constraint => `
                        <tr>
                            <td>${constraint.constraint_name}</td>
                            <td>${constraint.constraint_type}</td>
                            <td>${constraint.column_name || ''}</td>
                            <td>${constraint.foreign_table_name ? `${constraint.foreign_table_name}.${constraint.foreign_column_name}` : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h3>Indexes</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Definition</th>
                    </tr>
                </thead>
                <tbody>
                    ${indexes.map(index => `
                        <tr>
                            <td>${index.indexname}</td>
                            <td class="default">${index.indexdef}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>`;
}

function getTableDataHtml(data: any, tableInfo: any): string {
    if (!data || !data.columns || !data.rows) {
        return getErrorHtml('No data available');
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Table Data</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-border-color); }
            th { background: var(--vscode-editor-background); color: var(--vscode-text-foreground); font-weight: bold; position: sticky; top: 0; }
            td { color: var(--vscode-text-foreground); }
            .container { max-height: 600px; overflow: auto; }
        </style>
    </head>
    <body>
        <h1 class="header">📊 Table Data: ${tableInfo.schema}.${tableInfo.table}</h1>
        <p>Showing ${data.rows.length} rows</p>
        
        <div class="container">
            <table>
                <thead>
                    <tr>
                        ${data.columns.map((col: string) => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.rows.map((row: any) => `
                        <tr>
                            ${data.columns.map((col: string) => `<td>${row[col] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>`;
}

function getTableDataEditorHtml(data: any, structure: TableStructure[], tableInfo: any): string {
    if (!data || !data.columns || !data.rows) {
        return getErrorHtml('No data available');
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edit Table Data</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            .toolbar { margin-bottom: 20px; }
            button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: var(--vscode-button-hoverBackground); }
            button:disabled { opacity: 0.5; cursor: not-allowed; }
            .edit-mode { background: var(--vscode-inputValidation-warningBackground); padding: 10px; border-radius: 4px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-border-color); }
            th { background: var(--vscode-editor-background); color: var(--vscode-text-foreground); font-weight: bold; position: sticky; top: 0; }
            td { color: var(--vscode-text-foreground); }
            .container { max-height: 600px; overflow: auto; }
            input { width: 100%; padding: 4px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
            .changed { background: var(--vscode-inputValidation-warningBackground); }
            .primary-key { background: var(--vscode-textCodeBlock-background); }
        </style>
    </head>
    <body>
        <h1 class="header">✏️ Edit Data: ${tableInfo.schema}.${tableInfo.table}</h1>
        
        <div class="toolbar">
            <button onclick="toggleEditMode()" id="editModeBtn">Enable Edit Mode</button>
            <button onclick="saveChanges()" id="saveBtn" disabled>Save Changes</button>
            <button onclick="discardChanges()" id="discardBtn" disabled>Discard Changes</button>
            <span id="changesCount">No changes</span>
        </div>
        
        <div class="edit-mode" id="editModeInfo" style="display: none;">
            <strong>Edit Mode Enabled:</strong> Double-click any cell to edit (primary key columns are read-only)
        </div>
        
        <div class="container">
            <table id="dataTable">
                <thead>
                    <tr>
                        ${data.columns.map((col: string) => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.rows.map((row: any, index: number) => `
                        <tr data-row="${index}">
                            ${data.columns.map((col: string) => {
                                const isPrimaryKey = structure.some(s => s.column_name === col);
                                return `<td class="${isPrimaryKey ? 'primary-key' : ''}" data-column="${col}" data-original="${row[col] || ''}">${row[col] || ''}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <script>
            let editMode = false;
            let changes = {};
            
            function toggleEditMode() {
                editMode = !editMode;
                const btn = document.getElementById('editModeBtn');
                const info = document.getElementById('editModeInfo');
                
                if (editMode) {
                    btn.textContent = 'Disable Edit Mode';
                    info.style.display = 'block';
                    document.getElementById('dataTable').addEventListener('dblclick', handleCellEdit);
                } else {
                    btn.textContent = 'Enable Edit Mode';
                    info.style.display = 'none';
                    document.getElementById('dataTable').removeEventListener('dblclick', handleCellEdit);
                }
            }
            
            function handleCellEdit(event) {
                if (!editMode) return;
                
                const cell = event.target;
                if (cell.tagName !== 'TD' || cell.classList.contains('primary-key')) return;
                
                const column = cell.dataset.column;
                const row = cell.parentElement.dataset.row;
                const originalValue = cell.dataset.original;
                const currentValue = cell.textContent;
                
                const newValue = prompt(\`Edit \${column}:\`, currentValue);
                if (newValue !== null && newValue !== currentValue) {
                    cell.textContent = newValue;
                    cell.classList.add('changed');
                    
                    const changeKey = \`\${row}_\${column}\`;
                    changes[changeKey] = {
                        row: row,
                        column: column,
                        oldValue: originalValue,
                        newValue: newValue
                    };
                    
                    updateChangesUI();
                }
            }
            
            function updateChangesUI() {
                const count = Object.keys(changes).length;
                const countSpan = document.getElementById('changesCount');
                const saveBtn = document.getElementById('saveBtn');
                const discardBtn = document.getElementById('discardBtn');
                
                if (count > 0) {
                    countSpan.textContent = \`\${count} change(s) pending\`;
                    countSpan.style.color = 'var(--vscode-warningForeground)';
                    saveBtn.disabled = false;
                    discardBtn.disabled = false;
                } else {
                    countSpan.textContent = 'No changes';
                    countSpan.style.color = 'var(--vscode-text-foreground)';
                    saveBtn.disabled = true;
                    discardBtn.disabled = true;
                }
            }
            
            function saveChanges() {
                if (Object.keys(changes).length === 0) return;
                
                vscode.postMessage({
                    command: 'saveDataChanges',
                    data: {
                        tableInfo: ${JSON.stringify(tableInfo)},
                        changes: changes
                    }
                });
            }
            
            function discardChanges() {
                if (Object.keys(changes).length === 0) return;
                
                if (confirm('Discard all pending changes?')) {
                    // Revert changes
                    Object.values(changes).forEach(change => {
                        const cell = document.querySelector(\`tr[data-row="\${change.row}"] td[data-column="\${change.column}"]\`);
                        if (cell) {
                            cell.textContent = change.oldValue;
                            cell.classList.remove('changed');
                        }
                    });
                    
                    changes = {};
                    updateChangesUI();
                }
            }
        </script>
    </body>
    </html>`;
}

function getQueryResultsHtml(result: any, query: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Query Results</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .header { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            .query-info { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 4px; margin-bottom: 20px; font-family: monospace; }
            .results-info { color: var(--vscode-text-foreground); margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; background: var(--vscode-editor-background); }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-border-color); }
            th { background: var(--vscode-editor-background); color: var(--vscode-text-foreground); font-weight: bold; position: sticky; top: 0; }
            td { color: var(--vscode-text-foreground); }
            .container { max-height: 600px; overflow: auto; }
        </style>
    </head>
    <body>
        <h1 class="header">📊 Query Results</h1>
        
        <div class="query-info">
            <strong>Query:</strong><br>
            <pre>${query}</pre>
        </div>
        
        <div class="results-info">
            <strong>Execution Time:</strong> ${result.executionTime}ms<br>
            <strong>Rows Affected:</strong> ${result.rowCount}<br>
            <strong>Rows Returned:</strong> ${result.rows ? result.rows.length : 0}
        </div>
        
        ${result.rows && result.rows.length > 0 ? `
        <div class="container">
            <table>
                <thead>
                    <tr>
                        ${result.columns.map((col: string) => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${result.rows.map((row: any) => `
                        <tr>
                            ${result.columns.map((col: string) => `<td>${row[col] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : '<p>No rows returned</p>'}
    </body>
    </html>`;
}

function getErrorHtml(message: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .error { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); padding: 20px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="error">
            <h2>❌ Error</h2>
            <p>${message}</p>
        </div>
    </body>
    </html>`;
}

// Placeholder implementations for remaining commands
async function showAddConnectionDialog(): Promise<void> {
    showConnectionManager();
}

async function showEditConnectionDialog(connection: DatabaseConnection): Promise<void> {
    vscode.window.showInformationMessage(`Edit connection: ${connection.name}`);
}

async function deleteConnection(connection: DatabaseConnection): Promise<void> {
    const result = await vscode.window.showWarningMessage(
        `Delete connection "${connection.name}"?`,
        'Yes', 'No'
    );
    
    if (result === 'Yes') {
        extensionContext.connectionManager.removeConnection(connection.id);
        refreshAllProviders();
        vscode.window.showInformationMessage(`Connection "${connection.name}" deleted`);
    }
}

async function testConnection(connection: DatabaseConnection): Promise<void> {
    try {
        const isConnected = await extensionContext.connectionManager.testConnection(connection);
        if (isConnected) {
            vscode.window.showInformationMessage(`✅ Connection to ${connection.name} successful`);
        } else {
            vscode.window.showErrorMessage(`❌ Connection to ${connection.name} failed`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Connection test failed: ${error}`);
    }
}

async function showSchemaSelector(connection: DatabaseConnection): Promise<void> {
    vscode.window.showInformationMessage(`Switch schema for ${connection.name}`);
}

async function showTableConstraints(tableInfo: any): Promise<void> {
    vscode.window.showInformationMessage(`Show constraints for ${tableInfo.table}`);
}

async function showPrimaryKeys(tableInfo: any): Promise<void> {
    vscode.window.showInformationMessage(`Show primary keys for ${tableInfo.table}`);
}

async function showForeignKeys(tableInfo: any): Promise<void> {
    vscode.window.showInformationMessage(`Show foreign keys for ${tableInfo.table}`);
}

function toggleEditMode(): void {
    vscode.window.showInformationMessage('Toggle edit mode');
}

function saveDataChanges(): void {
    vscode.window.showInformationMessage('Save data changes');
}

function discardDataChanges(): void {
    vscode.window.showInformationMessage('Discard data changes');
}

function createNewSqlQuery(): void {
    vscode.workspace.openTextDocument({ content: '', language: 'sql' }).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

function saveCurrentQuery(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('query.sql'),
            filters: { 'SQL files': ['sql'] }
        }).then(uri => {
            if (uri) {
                const content = editor.document.getText();
                fs.writeFileSync(uri.fsPath, content);
                vscode.window.showInformationMessage(`Query saved to ${uri.fsPath}`);
            }
        });
    }
}

function loadQueryFromFile(): void {
    vscode.window.showOpenDialog({
        filters: { 'SQL files': ['sql'] }
    }).then(uris => {
        if (uris && uris.length > 0) {
            const uri = uris[0];
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            vscode.workspace.openTextDocument({ content, language: 'sql' }).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        }
    });
}

function showQueryHistory(): void {
    vscode.window.showInformationMessage('Show query history');
}

async function copyCreateTableStatement(tableInfo: any): Promise<void> {
    try {
        const createStatement = await extensionContext.queryService.getCreateTableStatement(
            tableInfo.connectionId,
            tableInfo.table,
            tableInfo.schema
        );
        
        await vscode.env.clipboard.writeText(createStatement);
        vscode.window.showInformationMessage('CREATE TABLE statement copied to clipboard');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to get CREATE TABLE statement: ${error}`);
    }
}

async function exportTableData(tableInfo: any): Promise<void> {
    vscode.window.showInformationMessage(`Export data from ${tableInfo.table}`);
}

async function importTableData(tableInfo: any): Promise<void> {
    vscode.window.showInformationMessage(`Import data to ${tableInfo.table}`);
}


