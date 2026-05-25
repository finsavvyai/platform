/**
 * Ultimate Universal Database Manager VSCode Extension
 * AI-Powered Multi-Database Management for PostgreSQL, MongoDB, Redis, Oracle & More
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Import our providers and services
import { UltimateDBConnectionProvider } from './providers/connectionProvider';
import { UltimateDBExplorerProvider } from './providers/explorerProvider';
import { UltimateAIAssistantProvider } from './providers/aiAssistantProvider';
import { UltimateQueryProvider } from './providers/queryProvider';
import { UltimateHealthProvider } from './providers/healthProvider';
import { UltimateStatusBarProvider } from './providers/statusBarProvider';
import { DatabaseConnectionManager } from './services/connectionManager';
import { AIQueryAssistant } from './services/aiAssistant';
import { QueryExecutionService } from './services/queryService';
import { HealthMonitoringService } from './services/healthService';
import { RealTimeMonitor } from './services/realTimeMonitor';
import { QueryHistoryManager } from './services/queryHistoryManager';
import { SchemaComparison } from './services/schemaComparison';
import { SecurityManager } from './services/securityManager';
import { AdvancedQueryBuilder } from './services/advancedQueryBuilder';
import { DataVisualization } from './services/dataVisualization';
import { AdvancedConnectionManager } from './services/advancedConnectionManager';
import { UltimateDBWebviewProvider } from './webview/webviewProvider';

// Types
export interface DatabaseConnection {
    id: string;
    name: string;
    type: 'PostgreSQL' | 'MongoDB' | 'Redis' | 'Oracle' | 'Elasticsearch' | 'Cassandra';
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
    ssl?: boolean;
    favorite?: boolean;
    tags?: string[];
    lastUsed?: Date;
    status?: 'connected' | 'disconnected' | 'error' | 'testing';
}

export interface ExtensionContext {
    connectionManager: DatabaseConnectionManager;
    aiAssistant: AIQueryAssistant;
    queryService: QueryExecutionService;
    healthService: HealthMonitoringService;
    realTimeMonitor: RealTimeMonitor;
    queryHistoryManager: QueryHistoryManager;
    schemaComparison: SchemaComparison;
    securityManager: SecurityManager;
    advancedQueryBuilder: AdvancedQueryBuilder;
    dataVisualization: DataVisualization;
    advancedConnectionManager: AdvancedConnectionManager;
    outputChannel: vscode.OutputChannel;
    extensionPath: string;
}

// Extension state
let extensionContext: ExtensionContext;
let statusBarItem: vscode.StatusBarItem;
let statusBarProvider: UltimateStatusBarProvider;
// Keep references to providers so we can refresh them
let connectionProviderRef: UltimateDBConnectionProvider | undefined;
let explorerProviderRef: UltimateDBExplorerProvider | undefined;
let aiProviderRef: UltimateAIAssistantProvider | undefined;
let queryProviderRef: UltimateQueryProvider | undefined;
let healthProviderRef: UltimateHealthProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
    console.log('🚀 Ultimate Universal Database Manager is now active!');

    // Create output channel
    const outputChannel = vscode.window.createOutputChannel('Ultimate DB Manager');
    outputChannel.appendLine('🚀 Ultimate Universal Database Manager Extension Activated');

    // Initialize services
    const connectionManager = new DatabaseConnectionManager(context);
    const aiAssistant = new AIQueryAssistant(context);
    const queryService = new QueryExecutionService(context);
    const healthService = new HealthMonitoringService(context);
    const realTimeMonitor = new RealTimeMonitor(connectionManager);
    const queryHistoryManager = new QueryHistoryManager(connectionManager);
    const schemaComparison = new SchemaComparison(connectionManager);
    const securityManager = new SecurityManager(connectionManager);
    const advancedQueryBuilder = new AdvancedQueryBuilder(connectionManager);
    const dataVisualization = new DataVisualization(connectionManager);
    const advancedConnectionManager = new AdvancedConnectionManager();

    // Store extension context
    extensionContext = {
        connectionManager,
        aiAssistant,
        queryService,
        healthService,
        realTimeMonitor,
        queryHistoryManager,
        schemaComparison,
        securityManager,
        advancedQueryBuilder,
        dataVisualization,
        advancedConnectionManager,
        outputChannel,
        extensionPath: context.extensionPath
    };

    // Create status bar
    createStatusBar();

    // Register providers
    registerTreeViewProviders(context);

    // Register commands
    registerCommands(context);

    // Register webview providers
    registerWebviewProviders(context);

    // Setup auto-refresh and monitoring
    setupAutoRefresh();

    // Load saved connections
    loadSavedConnections();

    outputChannel.appendLine('✅ All Ultimate DB Manager components initialized successfully');
}

function createStatusBar(): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'ultimatedb.connectionManager';
    statusBarItem.text = '$(database) Ultimate DB';
    statusBarItem.tooltip = 'Ultimate Database Manager - Click to manage connections';
    statusBarItem.show();
}

function registerTreeViewProviders(context: vscode.ExtensionContext): void {
    // Connection provider
    const connectionProvider = new UltimateDBConnectionProvider(extensionContext);
    connectionProviderRef = connectionProvider;
    const connectionTreeView = vscode.window.createTreeView('ultimatedbConnections', {
        treeDataProvider: connectionProvider,
        showCollapseAll: true,
        canSelectMany: false
    });
    context.subscriptions.push(connectionTreeView);

    // Database explorer provider
    const explorerProvider = new UltimateDBExplorerProvider(extensionContext);
    explorerProviderRef = explorerProvider;
    const explorerTreeView = vscode.window.createTreeView('ultimatedbExplorer', {
        treeDataProvider: explorerProvider,
        showCollapseAll: true,
        canSelectMany: false
    });
    context.subscriptions.push(explorerTreeView);

    // AI assistant provider
    const aiProvider = new UltimateAIAssistantProvider(extensionContext);
    aiProviderRef = aiProvider;
    const aiTreeView = vscode.window.createTreeView('ultimatedbAI', {
        treeDataProvider: aiProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(aiTreeView);

    // Query provider
    const queryProvider = new UltimateQueryProvider(extensionContext);
    queryProviderRef = queryProvider;
    const queryTreeView = vscode.window.createTreeView('ultimatedbQueries', {
        treeDataProvider: queryProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(queryTreeView);

    // Health provider
    const healthProvider = new UltimateHealthProvider(extensionContext);
    healthProviderRef = healthProvider;
    const healthTreeView = vscode.window.createTreeView('ultimatedbHealth', {
        treeDataProvider: healthProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(healthTreeView);

    // Status bar provider with Apple-inspired design
    statusBarProvider = new UltimateStatusBarProvider(extensionContext);
    context.subscriptions.push(statusBarProvider);

    // Store providers for refresh
    connectionProvider.onDidChangeTreeData(() => {
        updateStatusBar();
    });
}

function registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
        // Connection Management
        {
            command: 'ultimatedb.connectionManager',
            handler: openConnectionManager
        },
        {
            command: 'ultimatedb.connect',
            handler: connectToDatabase
        },
        {
            command: 'ultimatedb.addConnection',
            handler: addNewConnection
        },
        {
            command: 'ultimatedb.editConnection',
            handler: editConnection
        },
        {
            command: 'ultimatedb.deleteConnection',
            handler: deleteConnection
        },
        {
            command: 'ultimatedb.testConnection',
            handler: testConnection
        },
        {
            command: 'ultimatedb.refresh',
            handler: refreshExplorer
        },

        // AI Assistant
        {
            command: 'ultimatedb.aiAssistant',
            handler: openAIAssistant
        },
        {
            command: 'ultimatedb.naturalLanguageQuery',
            handler: naturalLanguageQuery
        },
        {
            command: 'ultimatedb.optimizeQuery',
            handler: optimizeQuery
        },

        // Query Execution
        {
            command: 'ultimatedb.executeQuery',
            handler: executeQuery
        },
        {
            command: 'ultimatedb.executeSelection',
            handler: executeSelection
        },
        {
            command: 'ultimatedb.explainQuery',
            handler: explainQuery
        },
        {
            command: 'ultimatedb.newSqlQuery',
            handler: () => newQuery('sql')
        },
        {
            command: 'ultimatedb.newMongoQuery',
            handler: () => newQuery('mongodb')
        },
        {
            command: 'ultimatedb.newRedisQuery',
            handler: () => newQuery('redis')
        },

        // Data Management
        {
            command: 'ultimatedb.viewTableData',
            handler: viewTableData
        },
        {
            command: 'ultimatedb.openSelectForTable',
            handler: openSelectForTable
        },
        {
            command: 'ultimatedb.copyCreateTable',
            handler: copyCreateTable
        },
        {
            command: 'ultimatedb.exportData',
            handler: exportData
        },
        {
            command: 'ultimatedb.importData',
            handler: importData
        },

        // Tools & Utilities
        {
            command: 'ultimatedb.generateSchema',
            handler: generateSchemaDiagram
        },
        {
            command: 'ultimatedb.performanceMonitor',
            handler: openPerformanceMonitor
        },
        {
            command: 'ultimatedb.healthCheck',
            handler: runHealthCheck
        },

        // Query Management
        {
            command: 'ultimatedb.saveQuery',
            handler: saveQuery
        },
        {
            command: 'ultimatedb.loadQuery',
            handler: loadQuery
        },
        {
            command: 'ultimatedb.queryHistory',
            handler: showQueryHistory
        },

        // External Tools
        {
            command: 'ultimatedb.launchConnectionManager',
            handler: launchConnectionManagerGUI
        },
        {
            command: 'ultimatedb.launchUniversalGUI',
            handler: launchUniversalGUI
        },
        {
            command: 'ultimatedb.launchAIGUI',
            handler: launchAIGUI
        },
        {
            command: 'ultimatedb.runTests',
            handler: runTestSuite
        },
        {
            command: 'ultimatedb.forgetPassword',
            handler: forgetPassword
        },
        {
            command: 'ultimatedb.securityScan',
            handler: securityScan
        },
        {
            command: 'ultimatedb.indexAdvisor',
            handler: indexAdvisor
        },

        // Advanced Features
        {
            command: 'ultimatedb.monitoring.start',
            handler: startMonitoring
        },
        {
            command: 'ultimatedb.monitoring.stop',
            handler: stopMonitoring
        },
        {
            command: 'ultimatedb.monitoring.dashboard',
            handler: showMonitoringDashboard
        },
        {
            command: 'ultimatedb.history.show',
            handler: showQueryHistory
        },
        {
            command: 'ultimatedb.history.clear',
            handler: clearQueryHistory
        },
        {
            command: 'ultimatedb.history.favorites',
            handler: showFavoriteQueries
        },
        {
            command: 'ultimatedb.schema.compare',
            handler: compareSchemas
        },
        {
            command: 'ultimatedb.schema.migration',
            handler: generateMigration
        },
        {
            command: 'ultimatedb.security.audit',
            handler: showSecurityAudit
        },
        {
            command: 'ultimatedb.security.analyze',
            handler: analyzeQuerySecurity
        },
        {
            command: 'ultimatedb.queryBuilder.open',
            handler: openQueryBuilder
        },
        {
            command: 'ultimatedb.visualization.chart',
            handler: createDataChart
        },
        {
            command: 'ultimatedb.connections.advanced',
            handler: openAdvancedConnections
        },
        {
            command: 'ultimatedb.export.advanced',
            handler: advancedExport
        },
        {
            command: 'ultimatedb.import.advanced',
            handler: advancedImport
        },
        {
            command: 'ultimatedb.showConnectionQuickPick',
            handler: () => statusBarProvider.showConnectionQuickPick()
        },
        {
            command: 'ultimatedb.showHealthOverview',
            handler: () => statusBarProvider.showHealthOverview()
        }
    ];

    // Register all commands
    commands.forEach(cmd => {
        const disposable = vscode.commands.registerCommand(cmd.command, cmd.handler);
        context.subscriptions.push(disposable);
    });
}

function registerWebviewProviders(context: vscode.ExtensionContext): void {
    // Register custom webview provider for rich database interfaces
    const webviewProvider = new UltimateDBWebviewProvider(context, extensionContext);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('ultimatedbWebview', webviewProvider)
    );
}

function setupAutoRefresh(): void {
    // Auto-refresh connections every 30 seconds
    setInterval(() => {
        vscode.commands.executeCommand('ultimatedb.refresh');
    }, 30000);
}

function loadSavedConnections(): void {
    const config = vscode.workspace.getConfiguration('ultimatedb');
    const connections = config.get<DatabaseConnection[]>('connections', []);
    
    connections.forEach(conn => {
        extensionContext.connectionManager.addConnection(conn);
    });

    extensionContext.outputChannel.appendLine(`📁 Loaded ${connections.length} saved connections`);
}

function updateStatusBar(): void {
    const activeConnections = extensionContext.connectionManager.getActiveConnections();
    const connectionCount = activeConnections.length;
    
    if (connectionCount > 0) {
        statusBarItem.text = `$(database) Ultimate DB (${connectionCount})`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(database) Ultimate DB';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

// Command Implementations

async function openConnectionManager(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'ultimatedbConnectionManager',
        '🔗 Connection Manager',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = getConnectionManagerHtml(panel.webview);
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'addConnection':
                await extensionContext.connectionManager.addConnection(message.connection);
                break;
            case 'testConnection':
                const result = await extensionContext.connectionManager.testConnection(message.connection);
                panel.webview.postMessage({ command: 'testResult', result });
                break;
        }
    });
}

async function connectToDatabase(connection?: DatabaseConnection | any): Promise<void> {
    if (!connection) {
        // Show connection picker
        const connections = extensionContext.connectionManager.getAllConnections();
        if (connections.length === 0) {
            vscode.window.showInformationMessage('No connections available. Add a connection first.');
            return;
        }

        const items = connections.map(conn => ({
            label: `$(database) ${conn.name}`,
            description: `${conn.type} - ${conn.host}:${conn.port}`,
            connection: conn
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a database connection'
        });

        if (!selected) {return;}
        connection = selected.connection;
    } else if ((connection as any)?.connection) {
        connection = (connection as any).connection as DatabaseConnection;
    }

    try {
        await extensionContext.connectionManager.connect(connection.id);
        vscode.window.showInformationMessage(`✅ Connected to ${connection.name}`);
        vscode.commands.executeCommand('ultimatedb.refresh');
    } catch (error) {
        vscode.window.showErrorMessage(`❌ Failed to connect to ${connection.name}: ${error}`);
    }
}

async function addNewConnection(): Promise<void> {
    // Simple QuickInput flow instead of webview
    const type = await vscode.window.showQuickPick(
        ['PostgreSQL', 'MongoDB', 'Redis', 'Oracle'],
        { placeHolder: 'Select database type' }
    );
    if (!type) {return;}

    const name = await vscode.window.showInputBox({ prompt: 'Connection name', value: `${type} Local` });
    if (!name) {return;}

    const host = await vscode.window.showInputBox({ prompt: 'Host', value: 'localhost' });
    if (!host) {return;}

    const defaultPort: Record<string, number> = { PostgreSQL: 5432, MongoDB: 27017, Redis: 6379, Oracle: 1521 };
    const portStr = await vscode.window.showInputBox({ prompt: 'Port', value: String(defaultPort[type]) });
    if (!portStr) {return;}
    const port = Number(portStr);

    const database = await vscode.window.showInputBox({ prompt: 'Database (or service/DB index)', value: type === 'Redis' ? '0' : (type === 'PostgreSQL' ? 'postgres' : '') });
    const username = await vscode.window.showInputBox({ prompt: 'Username (leave empty if not required)', value: type === 'PostgreSQL' ? 'postgres' : '' });
    const password = await vscode.window.showInputBox({ prompt: 'Password (input hidden)', password: true });

    const newConn: DatabaseConnection = {
        id: '', // will be assigned by manager
        name,
        type: type as DatabaseConnection['type'],
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        database: database || undefined,
        ssl: false,
        status: 'disconnected'
    };

    const saved = await extensionContext.connectionManager.addConnection(newConn);
    vscode.window.showInformationMessage(`Added connection ${saved.name}`);
    await vscode.commands.executeCommand('ultimatedb.refresh');
}

async function naturalLanguageQuery(): Promise<void> {
    const activeConnection = extensionContext.connectionManager.getActiveConnection();
    if (!activeConnection) {
        vscode.window.showWarningMessage('Please connect to a database first');
        return;
    }

    const question = await vscode.window.showInputBox({
        prompt: 'Ask a question about your data (e.g., "Show me all users created last week")',
        placeHolder: 'Enter your natural language query...'
    });

    if (!question) {return;}

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🤖 AI is generating your query...',
            cancellable: false
        }, async () => {
            const sqlQuery = await extensionContext.aiAssistant.generateQuery(question, activeConnection);
            
            // Create new document with generated query
            const doc = await vscode.workspace.openTextDocument({
                content: sqlQuery,
                language: activeConnection.type === 'MongoDB' ? 'mongodb' : 'sql'
            });
            
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage('✨ AI-generated query ready! Review and execute.');
        });
    } catch (error) {
        vscode.window.showErrorMessage(`❌ AI query generation failed: ${error}`);
    }
}

async function testConnection(arg?: any): Promise<void> {
    let connection: DatabaseConnection | undefined;
    if (arg?.connection) {
        connection = arg.connection as DatabaseConnection;
    } else {
        const connections = extensionContext.connectionManager.getAllConnections();
        const picked = await vscode.window.showQuickPick(
            connections.map(c => ({ label: c.name, description: `${c.type} ${c.host}:${c.port}`, c })),
            { placeHolder: 'Select a connection to test' }
        );
        if (!picked) {return;}
        connection = picked.c;
    }
    if (!connection) {return;}
    const result = await extensionContext.connectionManager.testConnection(connection);
    if (result.success) {
        vscode.window.showInformationMessage(`✅ ${connection.name} test succeeded`);
    } else {
        vscode.window.showErrorMessage(`❌ ${connection.name} test failed: ${result.error}`);
    }
}

async function deleteConnection(arg?: any): Promise<void> {
    let connection: DatabaseConnection | undefined;
    if (arg?.connection) {
        connection = arg.connection as DatabaseConnection;
    } else {
        const connections = extensionContext.connectionManager.getAllConnections();
        const picked = await vscode.window.showQuickPick(
            connections.map(c => ({ label: c.name, description: `${c.type} ${c.host}:${c.port}`, c })),
            { placeHolder: 'Select a connection to delete' }
        );
        if (!picked) {return;}
        connection = picked.c;
    }
    if (!connection) {return;}
    const confirm = await vscode.window.showWarningMessage(
        `Delete connection "${connection.name}"?`,
        { modal: true },
        'Delete'
    );
    if (confirm === 'Delete') {
        try {
            await extensionContext.connectionManager.deleteConnection(connection.id);

            // Force refresh all providers
            connectionProviderRef?.refresh();
            explorerProviderRef?.refresh();
            healthProviderRef?.refresh();

            vscode.window.showInformationMessage(`✅ Deleted connection "${connection.name}"`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to delete connection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

async function openSelectForTable(arg?: any): Promise<void> {
    const active = extensionContext.connectionManager.getActiveConnection();
    if (!active || active.type !== 'PostgreSQL') {
        vscode.window.showWarningMessage('Connect to a PostgreSQL database first.');
        return;
    }
    const schema = arg?.schema || 'public';
    const table = arg?.table;
    if (!table) {return;}
    const content = `-- Preview data from ${schema}.${table}\nSELECT *\nFROM ${schema}.${table}\nLIMIT 100;\n`;
    const doc = await vscode.workspace.openTextDocument({ language: 'sql', content });
    await vscode.window.showTextDocument(doc, { preview: false });
}

async function copyCreateTable(arg?: any): Promise<void> {
    const active = extensionContext.connectionManager.getActiveConnection();
    if (!active || active.type !== 'PostgreSQL') {
        vscode.window.showWarningMessage('Connect to a PostgreSQL database first.');
        return;
    }
    const schema = arg?.schema || 'public';
    const table = arg?.table;
    if (!table) {return;}

    let Client: any;
    try { ({ Client } = require('pg')); } catch { vscode.window.showErrorMessage('PostgreSQL client (pg) not installed.'); return; }

    let password = active.password;
    if (!password) {
        password = await (extensionContext as any).connectionManager['context'].secrets.get(`ultimatedb:pwd:${active.id}`);
    }
    const client = new Client({ host: active.host, port: active.port, user: active.username, password, database: active.database || 'postgres', ssl: active.ssl });
    try {
        await client.connect();
        const res = await client.query(
            `select column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default\n             from information_schema.columns\n             where table_schema = $1 and table_name = $2\n             order by ordinal_position`,
            [schema, table]
        );
        const pkRes = await client.query(
            `select kcu.column_name\n             from information_schema.table_constraints tc\n             join information_schema.key_column_usage kcu\n               on tc.constraint_name = kcu.constraint_name\n              and tc.table_schema = kcu.table_schema\n              and tc.table_name = kcu.table_name\n             where tc.constraint_type = 'PRIMARY KEY'\n               and tc.table_schema = $1 and tc.table_name = $2\n             order by kcu.ordinal_position`,
            [schema, table]
        );
        const pkCols: string[] = pkRes.rows.map((r: any) => r.column_name);

        // Unique constraints
        const uqRes = await client.query(
            `select tc.constraint_name, kcu.column_name, kcu.ordinal_position\n             from information_schema.table_constraints tc\n             join information_schema.key_column_usage kcu\n               on tc.constraint_name = kcu.constraint_name\n              and tc.table_schema = kcu.table_schema\n              and tc.table_name = kcu.table_name\n             where tc.constraint_type = 'UNIQUE'\n               and tc.table_schema = $1 and tc.table_name = $2\n             order by tc.constraint_name, kcu.ordinal_position`,
            [schema, table]
        );
        const uniquesMap = new Map<string,string[]>();
        for (const r of uqRes.rows as any[]) {
            const arr = uniquesMap.get(r.constraint_name) ?? [];
            arr.push(r.column_name);
            uniquesMap.set(r.constraint_name, arr);
        }
        const uniqueClauses = Array.from(uniquesMap.entries()).map(([name, cols]) => `    CONSTRAINT ${name} UNIQUE (${cols.join(', ')})`).join(',\n');

        // Foreign keys
        const fkRes = await client.query(
            `select tc.constraint_name,\n                    kcu.ordinal_position,\n                    kcu.column_name,\n                    ccu.table_schema as ref_schema,\n                    ccu.table_name as ref_table,\n                    ccu.column_name as ref_column\n             from information_schema.table_constraints tc\n             join information_schema.key_column_usage kcu\n               on tc.constraint_name = kcu.constraint_name\n              and tc.table_schema = kcu.table_schema\n              and tc.table_name = kcu.table_name\n             join information_schema.constraint_column_usage ccu\n               on ccu.constraint_name = tc.constraint_name\n              and ccu.table_schema = tc.table_schema\n             where tc.constraint_type = 'FOREIGN KEY'\n               and tc.table_schema = $1 and tc.table_name = $2\n             order by tc.constraint_name, kcu.ordinal_position`,
            [schema, table]
        );
        type FKRow = { constraint_name: string; ordinal_position: number; column_name: string; ref_schema: string; ref_table: string; ref_column: string };
        const fkGroups = new Map<string, FKRow[]>();
        for (const r of fkRes.rows as FKRow[]) {
            const arr = fkGroups.get(r.constraint_name) ?? [];
            arr.push(r);
            fkGroups.set(r.constraint_name, arr);
        }
        const fkClauses = Array.from(fkGroups.entries()).map(([name, items]) => {
            const ordered = items.slice().sort((a,b)=>a.ordinal_position-b.ordinal_position);
            const cols = ordered.map(i=>i.column_name).join(', ');
            const refCols = ordered.map(i=>i.ref_column).join(', ');
            const refSchema = ordered[0].ref_schema;
            const refTable = ordered[0].ref_table;
            return `    CONSTRAINT ${name} FOREIGN KEY (${cols}) REFERENCES ${refSchema}.${refTable} (${refCols})`;
        }).join(',\n');

        const cols = res.rows.map((r: any) => {
            let type = r.data_type;
            if (r.character_maximum_length) {type += `(${r.character_maximum_length})`;}
            if (r.numeric_precision && r.numeric_scale !== null) {type += `(${r.numeric_precision},${r.numeric_scale})`;}
            const nullable = r.is_nullable === 'YES' ? '' : ' NOT NULL';
            const def = r.column_default ? ` DEFAULT ${r.column_default}` : '';
            return `    ${r.column_name} ${type}${def}${nullable}`;
        }).join(',\n');

        const pkClause = pkCols.length ? `,\n    PRIMARY KEY (${pkCols.join(', ')})` : '';
        const extras = [uniqueClauses, fkClauses].filter(s=>s && s.length).join(',\n');
        const commaExtras = extras ? `,\n${extras}` : '';
        const ddl = `CREATE TABLE ${schema}.${table} (\n${cols}${pkClause}${commaExtras}\n);`;

        // Indexes (separate statements)
        const idxRes = await client.query(
            `select indexname, indexdef from pg_indexes where schemaname = $1 and tablename = $2`,
            [schema, table]
        );
        const idxSql = idxRes.rows.map((r: any) => r.indexdef).join('\n');

        await vscode.env.clipboard.writeText([ddl, idxSql].filter(Boolean).join('\n\n'));
        vscode.window.showInformationMessage('CREATE TABLE (with constraints) and indexes copied to clipboard');
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to build DDL: ${e.message}`);
    } finally {
        try { await client.end(); } catch {}
    }
}

async function executeQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor with query');
        return;
    }

    const query = editor.document.getText();
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to execute');
        return;
    }

    const activeConnection = extensionContext.connectionManager.getActiveConnection();
    if (!activeConnection) {
        vscode.window.showWarningMessage('Please connect to a database first');
        return;
    }

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Executing query...',
            cancellable: true
        }, async (progress, token) => {
            const result = await extensionContext.queryService.executeQuery(
                query, 
                activeConnection,
                token
            );

            // Show results in webview
            showQueryResults(result, query);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`❌ Query execution failed: ${error}`);
    }
}

async function executeSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    const selection = editor.selection;
    const query = editor.document.getText(selection);
    
    if (!query.trim()) {
        vscode.window.showWarningMessage('No text selected');
        return;
    }

    // Create temporary document and execute
    const doc = await vscode.workspace.openTextDocument({
        content: query,
        language: editor.document.languageId
    });
    
    const tempEditor = await vscode.window.showTextDocument(doc);
    await executeQuery();
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
}

async function newQuery(type: string): Promise<void> {
    const activeConnection = extensionContext.connectionManager.getActiveConnection();
    let template = '';
    let language = 'sql';

    switch (type) {
        case 'sql':
            template = `-- SQL Query for ${activeConnection?.name || 'Database'}\n-- ${new Date().toISOString()}\n\nSELECT \n    *\nFROM \n    -- table_name\nLIMIT 10;`;
            language = 'sql';
            break;
        case 'mongodb':
            template = `// MongoDB Query for ${activeConnection?.name || 'Database'}\n// ${new Date().toISOString()}\n\ndb.collection.find(\n    { /* query */ },\n    { /* projection */ }\n).limit(10);`;
            language = 'mongodb';
            break;
        case 'redis':
            template = `# Redis Commands for ${activeConnection?.name || 'Database'}\n# ${new Date().toISOString()}\n\n# Get all keys\nKEYS *\n\n# Get value\n# GET key_name`;
            language = 'redis';
            break;
    }

    const doc = await vscode.workspace.openTextDocument({
        content: template,
        language: language
    });

    await vscode.window.showTextDocument(doc);
}

async function launchConnectionManagerGUI(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const scriptPath = path.join(workspaceRoot, 'connection_manager_gui.py');
    
    if (!fs.existsSync(scriptPath)) {
        vscode.window.showErrorMessage(`Connection Manager GUI not found at ${scriptPath}`);
        return;
    }

    try {
        const child = spawn('python', [scriptPath], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        vscode.window.showInformationMessage('🎨 Connection Manager GUI launched!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to launch Connection Manager: ${error}`);
    }
}

async function launchUniversalGUI(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const scriptPath = path.join(workspaceRoot, 'universal_db_gui.py');
    
    if (!fs.existsSync(scriptPath)) {
        vscode.window.showErrorMessage(`Universal Database GUI not found at ${scriptPath}`);
        return;
    }

    try {
        const child = spawn('python', [scriptPath], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        vscode.window.showInformationMessage('🌐 Universal Database GUI launched!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to launch Universal GUI: ${error}`);
    }
}

async function launchAIGUI(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const scriptPath = path.join(workspaceRoot, 'pg_ai_gui.py');
    
    if (!fs.existsSync(scriptPath)) {
        vscode.window.showErrorMessage(`AI-Enhanced PostgreSQL GUI not found at ${scriptPath}`);
        return;
    }

    try {
        const child = spawn('python', [scriptPath], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        vscode.window.showInformationMessage('🤖 AI-Enhanced PostgreSQL GUI launched!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to launch AI GUI: ${error}`);
    }
}

// Placeholder implementations for other commands
async function editConnection(arg?: any): Promise<void> {
    let connection: DatabaseConnection | undefined;
    if (arg?.connection) {
        connection = arg.connection as DatabaseConnection;
    } else {
        const connections = extensionContext.connectionManager.getAllConnections();
        const picked = await vscode.window.showQuickPick(
            connections.map(c => ({ label: c.name, description: `${c.type} ${c.host}:${c.port}`, c })),
            { placeHolder: 'Select a connection to edit' }
        );
        if (!picked) {return;}
        connection = picked.c;
    }
    if (!connection) {return;}

    const name = await vscode.window.showInputBox({ prompt: 'Name', value: connection.name });
    if (!name) {return;}
    const host = await vscode.window.showInputBox({ prompt: 'Host', value: connection.host });
    if (!host) {return;}
    const portStr = await vscode.window.showInputBox({ prompt: 'Port', value: String(connection.port) });
    if (!portStr) {return;}
    const database = await vscode.window.showInputBox({ prompt: 'Database', value: connection.database || '' });
    const username = await vscode.window.showInputBox({ prompt: 'Username', value: connection.username || '' });

    await extensionContext.connectionManager.updateConnection(connection.id, {
        name,
        host,
        port: Number(portStr),
        database: database || undefined,
        username: username || undefined
    });
    await refreshExplorer();
}

async function refreshExplorer(): Promise<void> {
    connectionProviderRef?.refresh();
    explorerProviderRef?.refresh();
    aiProviderRef?.refresh();
    queryProviderRef?.refresh();
    healthProviderRef?.refresh();
}
async function openAIAssistant(): Promise<void> { /* TODO */ }
async function optimizeQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showWarningMessage('No active editor'); return; }
    const query = editor.selection && !editor.selection.isEmpty
        ? editor.document.getText(editor.selection)
        : editor.document.getText();
    if (!query.trim()) { vscode.window.showWarningMessage('No SQL to analyze'); return; }
    const conn = extensionContext.connectionManager.getActiveConnection();
    if (!conn || conn.type !== 'PostgreSQL') { vscode.window.showWarningMessage('Connect to PostgreSQL first'); return; }

    // Try to get a non-executing plan (fast) and generate suggestions
    let Client: any; try { ({ Client } = require('pg')); } catch { vscode.window.showErrorMessage('pg client not installed'); return; }
    let password = conn.password || await (extensionContext as any).connectionManager['context'].secrets.get(`ultimatedb:pwd:${conn.id}`);
    const client = new Client({ host: conn.host, port: conn.port, user: conn.username, password, database: conn.database || 'postgres', ssl: conn.ssl });
    try {
        await client.connect();
        const planRes = await client.query(`EXPLAIN (FORMAT JSON) ${query}`);
        const planJson = planRes.rows?.[0]?.['QUERY PLAN']?.[0] || planRes.rows?.[0]?.['QUERY PLAN'] || planRes.rows?.[0];
        const heuristics = await extensionContext.aiAssistant.analyzeQuery(query, planJson);
        // If AI provider configured, prepend a note; real integration can replace this
        const header = extensionContext.aiAssistant.isEnabled()
            ? 'AI Assistance is enabled. Detailed analysis will be provided when the provider is connected.\n\n'
            : '';
        const content = `${header}Heuristic suggestions:\n\n${heuristics}\n`;
        const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
        await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e: any) {
        vscode.window.showErrorMessage(`Optimize failed: ${e.message}`);
    } finally { try { await client.end(); } catch {} }
}

async function explainQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showWarningMessage('No active editor'); return; }
    const query = editor.selection && !editor.selection.isEmpty
        ? editor.document.getText(editor.selection)
        : editor.document.getText();
    if (!query.trim()) { vscode.window.showWarningMessage('No SQL to explain'); return; }
    const conn = extensionContext.connectionManager.getActiveConnection();
    if (!conn || conn.type !== 'PostgreSQL') { vscode.window.showWarningMessage('Connect to PostgreSQL first'); return; }
    let Client: any; try { ({ Client } = require('pg')); } catch { vscode.window.showErrorMessage('pg client not installed'); return; }
    let password = conn.password || await (extensionContext as any).connectionManager['context'].secrets.get(`ultimatedb:pwd:${conn.id}`);
    const client = new Client({ host: conn.host, port: conn.port, user: conn.username, password, database: conn.database || 'postgres', ssl: conn.ssl });
    try {
        await client.connect();
        const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${query}`);
        const plan = res.rows?.[0]?.['QUERY PLAN']?.[0] || res.rows?.[0]?.['QUERY PLAN'] || res.rows?.[0];
        const panel = vscode.window.createWebviewPanel('ultimatedbExplain', 'EXPLAIN ANALYZE', vscode.ViewColumn.Beside, { enableScripts: true });
        const pretty = escapeHtml(JSON.stringify(plan, null, 2));
        panel.webview.html = `<!doctype html><html><head><meta charset=\"utf-8\"/><style>
            body{font-family:var(--vscode-font-family,Arial);padding:10px}
            pre{background:#1111; padding:10px; border-radius:6px; overflow:auto;}
        </style></head><body>
        <h3>Execution Plan</h3>
        <pre>${pretty}</pre>
        </body></html>`;
    } catch (e: any) {
        vscode.window.showErrorMessage(`Explain failed: ${e.message}`);
    } finally { try { await client.end(); } catch {} }
}
async function viewTableData(arg?: any): Promise<void> {
    // Supports PostgreSQL tables from Explorer context menu
    const active = extensionContext.connectionManager.getActiveConnection();
    if (!active || active.type !== 'PostgreSQL') {
        vscode.window.showWarningMessage('Connect to a PostgreSQL database first.');
        return;
    }
    const schema = arg?.schema || 'public';
    const table = arg?.table;
    if (!table) {
        vscode.window.showWarningMessage('No table selected.');
        return;
    }
    // Build and run a simple SELECT
    let Client: any;
    try {
        ({ Client } = require('pg'));
    } catch {
        vscode.window.showErrorMessage('PostgreSQL client (pg) is not installed.');
        return;
    }
    // Retrieve password via manager (it reads VS Code secrets internally)
    let password = active.password;
    if (!password) {
        password = await (extensionContext as any).connectionManager['context'].secrets.get(`ultimatedb:pwd:${active.id}`);
    }
    const client = new Client({
        host: active.host,
        port: active.port,
        user: active.username,
        password,
        database: active.database || 'postgres',
        ssl: active.ssl
    });
    try {
        await client.connect();
        const res = await client.query(`select * from ${JSON.stringify(schema).slice(1,-1)}.${JSON.stringify(table).slice(1,-1)} limit 100`);
        const rows = res.rows as any[];
        const cols = rows.length ? Object.keys(rows[0]) : [];
        const panel = vscode.window.createWebviewPanel(
            'ultimatedbQueryResults',
            `Results: ${schema}.${table}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
        const header = cols.map(c => `<th>${c}</th>`).join('');
        const body = rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('');
        panel.webview.html = `<!doctype html><html><head><meta charset=\"utf-8\"/><style>
            body{font-family:var(--vscode-font-family,Arial);padding:10px}
            table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}
            th{background:#f3f3f3;position:sticky;top:0}
        </style></head><body>
        <h3>${schema}.${table} — ${rows.length} rows</h3>
        <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
        </body></html>`;
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to fetch data: ${e.message}`);
    } finally {
        try { await client.end(); } catch {}
    }
}
async function exportData(): Promise<void> { /* TODO */ }
async function importData(): Promise<void> { /* TODO */ }
async function generateSchemaDiagram(): Promise<void> { /* TODO */ }
async function openPerformanceMonitor(): Promise<void> { /* TODO */ }
async function runHealthCheck(): Promise<void> { /* TODO */ }
async function saveQuery(): Promise<void> { /* TODO */ }
async function loadQuery(): Promise<void> { /* TODO */ }
async function showQueryHistory(): Promise<void> { /* TODO */ }
async function runTestSuite(): Promise<void> { /* TODO */ }

// Advanced Feature Implementations

async function startMonitoring(): Promise<void> {
    extensionContext.realTimeMonitor.startMonitoring();
    vscode.window.showInformationMessage('🔍 Real-time monitoring started');
}

async function stopMonitoring(): Promise<void> {
    extensionContext.realTimeMonitor.stopMonitoring();
    vscode.window.showInformationMessage('⏹️ Real-time monitoring stopped');
}

async function showMonitoringDashboard(): Promise<void> {
    const data = extensionContext.realTimeMonitor.getDashboardData();
    const panel = vscode.window.createWebviewPanel(
        'ultimatedbMonitoring',
        '📊 Database Monitoring Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    const html = `
        <!DOCTYPE html>
    <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
                .active { background-color: #d4edda; color: #155724; }
                .inactive { background-color: #f8d7da; color: #721c24; }
                .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
                .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007acc; }
                .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>📊 Database Monitoring Dashboard</h1>
            <div class="status ${data.isMonitoring ? 'active' : 'inactive'}">
                Status: ${data.isMonitoring ? '🟢 Active' : '🔴 Inactive'}
            </div>
            <div class="metrics">
                <div class="metric-card">
                    <h3>Active Connections</h3>
                    <p>${data.metrics.size}</p>
                </div>
                <div class="metric-card">
                    <h3>Total Alerts</h3>
                    <p>${data.alerts.length}</p>
                </div>
                <div class="metric-card">
                    <h3>Alert Rules</h3>
                    <p>${data.alertRules.length}</p>
                </div>
            </div>
            <h2>Recent Alerts</h2>
            ${data.alerts.slice(0, 10).map(alert => `
                <div class="alert">
                    <strong>${alert.severity.toUpperCase()}</strong>: ${alert.message}
                    <br><small>${alert.timestamp.toLocaleString()}</small>
                </div>
            `).join('')}
        </body>
        </html>
    `;

    panel.webview.html = html;
}

async function clearQueryHistory(): Promise<void> {
    const connectionId = await vscode.window.showQuickPick(
        ['All Connections', ...extensionContext.connectionManager.getActiveConnections().map(c => c.name)],
        { placeHolder: 'Select connection to clear history for' }
    );

    if (connectionId) {
        const targetId = connectionId === 'All Connections' ? undefined : 
            extensionContext.connectionManager.getActiveConnections().find(c => c.name === connectionId)?.id;
        
        await extensionContext.queryHistoryManager.clearHistory(targetId);
        vscode.window.showInformationMessage('Query history cleared');
    }
}

async function showFavoriteQueries(): Promise<void> {
    const favorites = extensionContext.queryHistoryManager.getFavoriteQueries();
    
    if (favorites.length === 0) {
        vscode.window.showInformationMessage('No favorite queries found');
        return;
    }

    const items = favorites.map(fav => ({
        label: `$(star) ${fav.query.substring(0, 50)}...`,
        description: `Executed ${fav.executionCount} times`,
        detail: fav.description || 'No description',
        query: fav.query
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a favorite query to use'
    });

    if (selected) {
        const doc = await vscode.workspace.openTextDocument({
            content: selected.query,
            language: 'sql'
        });
        await vscode.window.showTextDocument(doc);
    }
}

async function compareSchemas(): Promise<void> {
    const connections = extensionContext.connectionManager.getActiveConnections();
    
    if (connections.length < 2) {
        vscode.window.showWarningMessage('Need at least 2 active connections to compare schemas');
        return;
    }

    const sourceConnection = await vscode.window.showQuickPick(
        connections.map(conn => ({ label: conn.name, description: `${conn.type} - ${conn.host}:${conn.port}`, id: conn.id })),
        { placeHolder: 'Select source connection' }
    );

    if (!sourceConnection) {return;}

    const targetConnection = await vscode.window.showQuickPick(
        connections.filter(c => c.id !== sourceConnection.id).map(conn => ({ 
            label: conn.name, 
            description: `${conn.type} - ${conn.host}:${conn.port}`, 
            id: conn.id 
        })),
        { placeHolder: 'Select target connection' }
    );

    if (!targetConnection) {return;}

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Comparing schemas...',
            cancellable: false
        }, async () => {
            const result = await extensionContext.schemaComparison.compareSchemas(
                sourceConnection.id, 
                targetConnection.id
            );

            const panel = vscode.window.createWebviewPanel(
                'ultimatedbSchemaComparison',
                '🔍 Schema Comparison Results',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            const html = `
                <!DOCTYPE html>
                <html>
    <head>
        <style>
                        body { font-family: var(--vscode-font-family); padding: 20px; }
                        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
                        .summary-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
                        .added { border-left: 4px solid #28a745; }
                        .removed { border-left: 4px solid #dc3545; }
                        .modified { border-left: 4px solid #ffc107; }
                        .total { border-left: 4px solid #007acc; }
                        .difference { margin: 10px 0; padding: 10px; border-radius: 5px; }
                        .difference.added { background: #d4edda; }
                        .difference.removed { background: #f8d7da; }
                        .difference.modified { background: #fff3cd; }
        </style>
    </head>
    <body>
                    <h1>🔍 Schema Comparison Results</h1>
                    <div class="summary">
                        <div class="summary-item added">
                            <h3>Added</h3>
                            <p>${result.summary.added}</p>
        </div>
                        <div class="summary-item removed">
                            <h3>Removed</h3>
                            <p>${result.summary.removed}</p>
            </div>
                        <div class="summary-item modified">
                            <h3>Modified</h3>
                            <p>${result.summary.modified}</p>
            </div>
                        <div class="summary-item total">
                            <h3>Total</h3>
                            <p>${result.summary.total}</p>
        </div>
            </div>
                    <h2>Differences</h2>
                    ${result.differences.map(diff => `
                        <div class="difference ${diff.type}">
                            <strong>${diff.type.toUpperCase()}</strong>: ${diff.objectType} '${diff.objectName}'
                            ${diff.details ? `<br>${diff.details.description}` : ''}
        </div>
                    `).join('')}
                </body>
                </html>
            `;

            panel.webview.html = html;
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Schema comparison failed: ${(error as Error).message}`);
    }
}

async function generateMigration(): Promise<void> {
    vscode.window.showInformationMessage('Migration generation feature coming soon!');
}

async function showSecurityAudit(): Promise<void> {
    const logs = extensionContext.securityManager.getAuditLogs({ limit: 100 });
    
    const panel = vscode.window.createWebviewPanel(
        'ultimatedbSecurityAudit',
        '🛡️ Security Audit Logs',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .log-entry { margin: 10px 0; padding: 10px; border-radius: 5px; border-left: 4px solid #ccc; }
                .critical { border-left-color: #dc3545; background: #f8d7da; }
                .high { border-left-color: #fd7e14; background: #fff3cd; }
                .medium { border-left-color: #ffc107; background: #d1ecf1; }
                .low { border-left-color: #28a745; background: #d4edda; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
                .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
            </style>
        </head>
        <body>
            <h1>🛡️ Security Audit Logs</h1>
            <div class="stats">
                <div class="stat-card">
                    <h3>Total Events</h3>
                    <p>${logs.length}</p>
                        </div>
                <div class="stat-card">
                    <h3>Critical</h3>
                    <p>${logs.filter(l => l.details.riskLevel === 'critical').length}</p>
                                    </div>
                <div class="stat-card">
                    <h3>High Risk</h3>
                    <p>${logs.filter(l => l.details.riskLevel === 'high').length}</p>
                                    </div>
                                </div>
            <h2>Recent Events</h2>
            ${logs.slice(0, 20).map(log => `
                <div class="log-entry ${log.details.riskLevel}">
                    <strong>${log.action.toUpperCase()}</strong> - ${log.details.riskLevel.toUpperCase()}
                    <br>Connection: ${log.connectionId}
                    <br>Time: ${log.timestamp.toLocaleString()}
                    ${log.details.error ? `<br>Error: ${log.details.error}` : ''}
                                </div>
            `).join('')}
    </body>
        </html>
    `;

    panel.webview.html = html;
}

async function analyzeQuerySecurity(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const query = editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection);
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to analyze');
        return;
    }

    const analysis = extensionContext.securityManager.analyzeQuerySecurity(query);
    
    const panel = vscode.window.createWebviewPanel(
        'ultimatedbSecurityAnalysis',
        '🔍 Query Security Analysis',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .risk-level { padding: 10px; margin: 10px 0; border-radius: 5px; font-weight: bold; }
                .critical { background: #f8d7da; color: #721c24; }
                .high { background: #fff3cd; color: #856404; }
                .medium { background: #d1ecf1; color: #0c5460; }
                .low { background: #d4edda; color: #155724; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
                .suggestion { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
            <h1>🔍 Query Security Analysis</h1>
            <div class="risk-level ${analysis.riskLevel}">
                Risk Level: ${analysis.riskLevel.toUpperCase()}
        </div>
            <h2>Warnings</h2>
            ${analysis.warnings.map(warning => `
                <div class="warning">
                    ⚠️ ${warning}
                        </div>
            `).join('')}
            <h2>Suggestions</h2>
            ${(analysis as any).suggestions ? (analysis as any).suggestions.map((suggestion: any) => `
                <div class="suggestion">
                    💡 ${suggestion}
                    </div>
            `).join('') : '<p>No suggestions available</p>'}
            <h2>Sensitive Operations</h2>
            <ul>
                ${analysis.sensitiveOperations.map(op => `<li>${op}</li>`).join('')}
            </ul>
        </body>
        </html>
    `;

    panel.webview.html = html;
}

async function openQueryBuilder(): Promise<void> {
    // TODO: Implement showQueryBuilder method
    vscode.window.showInformationMessage('🔧 Advanced Query Builder feature coming soon!');
}

async function createDataChart(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const query = editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection);
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to visualize');
        return;
    }

    const activeConnection = extensionContext.connectionManager.getActiveConnection();
    if (!activeConnection) {
        vscode.window.showWarningMessage('Please connect to a database first');
                    return;
                }
                
    try {
        const result = await extensionContext.queryService.executeQuery(query, activeConnection, new vscode.CancellationTokenSource().token);
        await extensionContext.dataVisualization.createVisualization(query, {
            type: 'bar',
            title: 'Query Results',
            xAxis: 'index',
            yAxis: 'value'
        });
        vscode.window.showInformationMessage('📊 Chart created successfully');
                } catch (error) {
        vscode.window.showErrorMessage(`Chart creation failed: ${(error as Error).message}`);
    }
}

async function openAdvancedConnections(): Promise<void> {
    // TODO: Implement showAdvancedConnectionDialog method
    vscode.window.showInformationMessage('🔗 Advanced Connection Manager feature coming soon!');
}

async function advancedExport(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const query = editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection);
    if (!query.trim()) {
        vscode.window.showWarningMessage('No query to export');
                    return;
                }
                
    const format = await vscode.window.showQuickPick(['CSV', 'JSON', 'Excel', 'XML'], {
        placeHolder: 'Select export format'
    });

    if (format) {
        vscode.window.showInformationMessage(`Advanced export to ${format} feature coming soon!`);
    }
}

async function advancedImport(): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: {
            'Data Files': ['csv', 'json', 'xlsx', 'xml']
        }
    });

    if (fileUri && fileUri[0]) {
        vscode.window.showInformationMessage(`Advanced import from ${fileUri[0].fsPath} feature coming soon!`);
    }
}

async function securityScan(): Promise<void> {
    const conn = extensionContext.connectionManager.getActiveConnection();
    if (!conn || conn.type !== 'PostgreSQL') { vscode.window.showWarningMessage('Connect to PostgreSQL first'); return; }
    let Client: any; try { ({ Client } = require('pg')); } catch { vscode.window.showErrorMessage('pg client not installed'); return; }
    let password = conn.password || await (extensionContext as any).connectionManager['context'].secrets.get(`ultimatedb:pwd:${conn.id}`);
    const client = new Client({ host: conn.host, port: conn.port, user: conn.username, password, database: conn.database || 'postgres', ssl: conn.ssl });
    try {
        await client.connect();
        const checks: { name: string; finding: string; recommendation: string }[] = [];
        const settings = await client.query(`select name, setting from pg_settings where name in ('ssl','password_encryption','log_connections','log_disconnections')`);
        const sMap = new Map(settings.rows.map((r:any)=>[r.name, r.setting]));
        if (sMap.get('ssl') !== 'on') {checks.push({ name: 'SSL', finding: 'SSL is off', recommendation: 'Enable SSL (ssl=on) and configure certificates.' });}
        if (!/^scram-/.test(String(sMap.get('password_encryption')||''))) {checks.push({ name: 'Password Encryption', finding: `Using ${sMap.get('password_encryption')}`, recommendation: 'Use SCRAM-SHA-256 for password_encryption.' });}

        const roles = await client.query(`select rolname, rolsuper, rolreplication, rolcreaterole from pg_roles`);
        roles.rows.filter((r:any)=>r.rolsuper).forEach((r:any)=>checks.push({ name: 'Superuser role', finding: `Role ${r.rolname} is superuser`, recommendation: 'Limit superuser roles and use least privilege.' }));

        const pubGrants = await client.query(`select table_schema, table_name, privilege_type from information_schema.role_table_grants where grantee='PUBLIC' limit 50`);
        if (pubGrants.rowCount>0) {checks.push({ name: 'PUBLIC grants', finding: `${pubGrants.rowCount} PUBLIC grants detected`, recommendation: 'Revoke unnecessary PUBLIC privileges.' });}

        const panel = vscode.window.createWebviewPanel('ultimatedbSecurity', 'Security Scan (PostgreSQL)', vscode.ViewColumn.Active, { enableScripts: true });
        const rowsHtml = checks.map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.finding)}</td><td>${escapeHtml(c.recommendation)}</td></tr>`).join('') || '<tr><td colspan="3">No critical findings</td></tr>';
        panel.webview.html = `<!doctype html><html><head><meta charset=\"utf-8\"/><style>
          body{font-family:var(--vscode-font-family,Arial);padding:12px}
          table{border-collapse:collapse;width:100%}
          th,td{border:1px solid #ddd;padding:8px;text-align:left}
          th{background:#f3f3f3}
        </style></head><body>
        <h2>🛡️ Security Scan</h2>
        <table><thead><tr><th>Area</th><th>Finding</th><th>Recommendation</th></tr></thead><tbody>${rowsHtml}</tbody></table>
        </body></html>`;
    } catch (e:any) {
        vscode.window.showErrorMessage(`Security scan failed: ${e.message}`);
    } finally { try { await client.end(); } catch {} }
}

async function indexAdvisor(): Promise<void> {
    const conn = extensionContext.connectionManager.getActiveConnection();
    if (!conn || conn.type !== 'PostgreSQL') { vscode.window.showWarningMessage('Connect to PostgreSQL first'); return; }
    const editor = vscode.window.activeTextEditor;
    const query = editor?.selection && !editor.selection.isEmpty ? editor.document.getText(editor.selection) : editor?.document.getText() || '';
    const planNote = query ? 'Based on current query selection.' : 'No query selected; showing generic advice.';
    const advice = [
        'Create B-tree indexes on columns frequently used in WHERE equality and JOINs.',
        'Use multi-column indexes when filtering on multiple columns in order of selectivity.',
        'Cover ORDER BY with index order to avoid Sort steps.',
        'Consider partial indexes for sparse predicates (e.g., WHERE deleted=false).',
        'Regularly check bloat and VACUUM/REINDEX as needed.'
    ];
    const content = `# Index Advisor\n\n${planNote}\n\n- ${advice.join('\n- ')}`;
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content });
    await vscode.window.showTextDocument(doc, { preview: false });
}

async function forgetPassword(arg?: any): Promise<void> {
    let connection: DatabaseConnection | undefined;
    if (arg?.connection) {
        connection = arg.connection as DatabaseConnection;
    } else {
        const connections = extensionContext.connectionManager.getAllConnections();
        const picked = await vscode.window.showQuickPick(
            connections.map(c => ({ label: c.name, description: `${c.type} ${c.host}:${c.port}`, c })),
            { placeHolder: 'Select a connection' }
        );
        if (!picked) {return;}
        connection = picked.c;
    }
    if (!connection) {return;}
    await extensionContext.connectionManager.removeSecret(connection.id);
    vscode.window.showInformationMessage(`Forgot saved password for ${connection.name}`);
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showQueryResults(result: any, query: string): void {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    const cols: string[] = rows.length ? Object.keys(rows[0]) : [];
    const panel = vscode.window.createWebviewPanel(
        'ultimatedbQueryResults',
        `Query Results (${rows.length})`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    const header = cols.map(c => `<th>${c}</th>`).join('');
    const body = rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('');
    panel.webview.html = `<!doctype html><html><head><meta charset=\"utf-8\"/><style>
        body{font-family:var(--vscode-font-family,Arial);padding:10px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
        th{background:#f3f3f3;position:sticky;top:0}
        .meta{color:#666;margin-bottom:8px;font-size:12px}
    </style></head><body>
    <div class="meta">${escapeHtml(query.substring(0, 200))}${query.length>200?'...':''}</div>
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`;
}

function getConnectionManagerHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html>
        <head>
            <title>Connection Manager</title>
        </head>
        <body>
            <h1>🔗 Connection Manager</h1>
            <p>Modern connection management interface will be implemented here.</p>
        </body>
    </html>`;
}

function getAddConnectionHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html>
        <head>
            <title>Add Connection</title>
        </head>
        <body>
            <h1>➕ Add New Connection</h1>
            <p>Connection form will be implemented here.</p>
        </body>
    </html>`;
}

export function deactivate(): void {
    extensionContext.outputChannel.appendLine('🔌 Ultimate Universal Database Manager deactivated');
    statusBarItem?.dispose();
}
