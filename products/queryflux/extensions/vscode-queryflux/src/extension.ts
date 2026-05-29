import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './database/connectionManager';
import { QueryExecutor } from './database/queryExecutor';
import { SchemaExplorer } from './database/schemaExplorer';
import { QueryOptimizationProvider } from './ai/queryOptimization';
import { ConnectionTreeProvider } from './ui/connectionTreeProvider';
import { SchemaTreeProvider } from './ui/schemaTreeProvider';
import { QueryResultPanel } from './ui/queryResultPanel';
import { SQLLanguageFeatures } from './language/sqlFeatures';

let connectionManager: DatabaseConnectionManager;
let queryExecutor: QueryExecutor;
let schemaExplorer: SchemaExplorer;
let queryOptimization: QueryOptimizationProvider;
let connectionTreeProvider: ConnectionTreeProvider;
let schemaTreeProvider: SchemaTreeProvider;
let queryResultPanel: QueryResultPanel;
let sqlFeatures: SQLLanguageFeatures;

export function activate(context: vscode.ExtensionContext) {
    console.log('QueryFlux extension is now active!');

    // Initialize core services
    connectionManager = new DatabaseConnectionManager(context);
    queryExecutor = new QueryExecutor(connectionManager);
    schemaExplorer = new SchemaExplorer(connectionManager);
    queryOptimization = new QueryOptimizationProvider();
    sqlFeatures = new SQLLanguageFeatures();

    // Initialize UI components
    connectionTreeProvider = new ConnectionTreeProvider(connectionManager);
    schemaTreeProvider = new SchemaTreeProvider(schemaExplorer);
    queryResultPanel = new QueryResultPanel(context);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('queryfluxConnections', connectionTreeProvider);
    vscode.window.registerTreeDataProvider('queryfluxSchema', schemaTreeProvider);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('queryflux.connectDatabase', () => connectDatabase()),
        vscode.commands.registerCommand('queryflux.executeQuery', () => executeQuery()),
        vscode.commands.registerCommand('queryflux.showConnections', () => showConnections()),
        vscode.commands.registerCommand('queryflux.openQueryEditor', () => openQueryEditor()),
        vscode.commands.registerCommand('queryflux.showSchema', () => showSchema()),
        vscode.commands.registerCommand('queryflux.explainQuery', () => explainQuery()),
        vscode.commands.registerCommand('queryflux.optimizeQuery', () => optimizeQuery()),
        vscode.commands.registerCommand('queryflux.exportResults', () => exportResults()),
        vscode.commands.registerCommand('queryflux.refreshSchema', () => refreshSchema())
    ];

    // Register language features
    sqlFeatures.activate(context);

    // Add all disposables
    commands.forEach(command => context.subscriptions.push(command));
    context.subscriptions.push(queryResultPanel);

    // Set context for UI visibility
    vscode.commands.executeCommand('setContext', 'queryflux:connected', false);

    // Show welcome message
    vscode.window.showInformationMessage(
        'QueryFlux activated! Use the command palette (Ctrl+Shift+P) to connect to a database.',
        'Connect Now'
    ).then(selection => {
        if (selection === 'Connect Now') {
            vscode.commands.executeCommand('queryflux.connectDatabase');
        }
    });
}

async function connectDatabase() {
    try {
        const connectionType = await vscode.window.showQuickPick([
            { label: '$(database) PostgreSQL', value: 'postgresql' },
            { label: '$(database) MySQL', value: 'mysql' },
            { label: '$(database) MongoDB', value: 'mongodb' },
            { label: '$(database) Redis', value: 'redis' },
            { label: '$(database) SQLite', value: 'sqlite' },
            { label: '$(database) Cassandra', value: 'cassandra' },
            { label: '$(database) Oracle', value: 'oracle' },
            { label: '$(database) SQL Server', value: 'sqlserver' }
        ], { placeHolder: 'Select database type' });

        if (!connectionType) {
            return;
        }

        const config = await getConnectionConfiguration(connectionType.value);
        if (!config) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting to database...',
            cancellable: true
        }, async (progress, token) => {
            const connectionId = await connectionManager.connect(connectionType.value, config);

            if (connectionId) {
                vscode.window.showInformationMessage(
                    `Successfully connected to ${connectionType.label} database!`
                );
                connectionTreeProvider.refresh();
                schemaTreeProvider.refresh();
                vscode.commands.executeCommand('setContext', 'queryflux:connected', true);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
    }
}

async function getConnectionConfiguration(type: string): Promise<any> {
    const config: any = {};

    // Get host
    const host = await vscode.window.showInputBox({
        prompt: 'Database host',
        value: type === 'sqlite' ? '' : 'localhost',
        ignoreFocusOut: true
    });
    if (host === undefined) return null;
    if (host) config.host = host;

    // Get port for non-SQLite databases
    if (type !== 'sqlite') {
        const defaultPorts: { [key: string]: number } = {
            postgresql: 5432,
            mysql: 3306,
            mongodb: 27017,
            redis: 6379,
            cassandra: 9042,
            oracle: 1521,
            sqlserver: 1433
        };

        const port = await vscode.window.showInputBox({
            prompt: 'Database port',
            value: defaultPorts[type]?.toString() || '',
            ignoreFocusOut: true
        });
        if (port === undefined) return null;
        if (port) config.port = parseInt(port);
    }

    // Get database name
    if (type !== 'redis') {
        const database = await vscode.window.showInputBox({
            prompt: 'Database name',
            ignoreFocusOut: true
        });
        if (database === undefined) return null;
        if (database) config.database = database;
    }

    // Get username and password for most databases
    if (type !== 'sqlite' && type !== 'redis') {
        const username = await vscode.window.showInputBox({
            prompt: 'Username',
            ignoreFocusOut: true
        });
        if (username === undefined) return null;
        if (username) config.username = username;

        const password = await vscode.window.showInputBox({
            prompt: 'Password',
            password: true,
            ignoreFocusOut: true
        });
        if (password === undefined) return null;
        if (password) config.password = password;
    }

    // SSL configuration
    const ssl = await vscode.window.showQuickPick([
        { label: 'No SSL', value: false },
        { label: 'SSL Required', value: true }
    ], { placeHolder: 'SSL Configuration' });
    if (ssl) {
        config.ssl = ssl.value;
    }

    return config;
}

async function executeQuery() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const selection = editor.selection;
    const query = selection.isEmpty
        ? editor.document.getText(editor.document.uri)
        : editor.document.getText(selection);

    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to execute');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Executing query...',
            cancellable: false
        }, async (progress) => {
            const result = await queryExecutor.execute(query);
            queryResultPanel.showResults(result);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Query execution failed: ${error.message}`);
    }
}

async function showConnections() {
    connectionTreeProvider.refresh();
    vscode.commands.executeCommand('queryfluxConnections.focus');
}

async function openQueryEditor() {
    const document = await vscode.workspace.openTextDocument({
        content: '-- QueryFlux SQL Editor\n-- Use Ctrl+Enter to execute\n\nSELECT * FROM your_table LIMIT 10;',
        language: 'sql'
    });
    await vscode.window.showTextDocument(document);
}

async function showSchema() {
    if (!connectionManager.hasActiveConnection()) {
        vscode.window.showWarningMessage('No active database connection');
        return;
    }

    schemaTreeProvider.refresh();
    vscode.commands.executeCommand('queryfluxSchema.focus');
}

async function explainQuery() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const query = editor.document.getText(editor.selection);
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query selected');
        return;
    }

    try {
        const explanation = await queryExecutor.explainQuery(query);
        const doc = await vscode.workspace.openTextDocument({
            content: `Query Explanation:\n\n${explanation}`,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Query explanation failed: ${error.message}`);
    }
}

async function optimizeQuery() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const query = editor.document.getText(editor.selection) || editor.document.getText();
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to optimize');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Optimizing query with AI...',
            cancellable: false
        }, async (progress) => {
            const optimized = await queryOptimization.optimizeQuery(query);

            const action = await vscode.window.showInformationMessage(
                'Query optimization complete! Would you like to replace your query?',
                'Replace', 'Compare', 'Cancel'
            );

            if (action === 'Replace') {
                editor.edit(editBuilder => {
                    const range = editor.selection.isEmpty
                        ? new vscode.Range(
                            editor.document.positionAt(0),
                            editor.document.positionAt(editor.document.getText().length)
                          )
                        : editor.selection;
                    editBuilder.replace(range, optimized);
                });
            } else if (action === 'Compare') {
                const doc = await vscode.workspace.openTextDocument({
                    content: `Original Query:\n${query}\n\nOptimized Query:\n${optimized}`,
                    language: 'sql'
                });
                await vscode.window.showTextDocument(doc);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Query optimization failed: ${error.message}`);
    }
}

async function exportResults() {
    if (!queryResultPanel.hasResults()) {
        vscode.window.showWarningMessage('No query results to export');
        return;
    }

    const format = await vscode.window.showQuickPick([
        { label: 'CSV', value: 'csv' },
        { label: 'JSON', value: 'json' },
        { label: 'Excel (XLSX)', value: 'xlsx' }
    ], { placeHolder: 'Select export format' });

    if (!format) return;

    const uri = await vscode.window.showSaveDialog({
        filters: {
            [format.label.toUpperCase()]: [format.value]
        },
        defaultUri: vscode.Uri.file(`query-results.${format.value}`)
    });

    if (!uri) return;

    try {
        await queryResultPanel.exportResults(uri.fsPath, format.value);
        vscode.window.showInformationMessage(`Results exported to ${uri.fsPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error.message}`);
    }
}

async function refreshSchema() {
    if (!connectionManager.hasActiveConnection()) {
        vscode.window.showWarningMessage('No active database connection');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing schema...',
            cancellable: false
        }, async (progress) => {
            await schemaExplorer.refreshSchema();
            schemaTreeProvider.refresh();
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Schema refresh failed: ${error.message}`);
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
    if (connectionManager) {
        connectionManager.disconnectAll();
    }
}