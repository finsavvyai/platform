/**
 * Enhanced Connection Tab Provider
 * Provides modern tabbed interface with breadcrumb navigation and enhanced UX
 */

import * as vscode from 'vscode';
import { DatabaseConnectionManager } from '../services/connectionManager';

export class ConnectionTabProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private connectionManager: DatabaseConnectionManager;
    private webviewView?: vscode.WebviewView;

    constructor(context: vscode.ExtensionContext, connectionManager: DatabaseConnectionManager) {
        this.context = context;
        this.connectionManager = connectionManager;
    }

    /**
     * Required method for WebviewViewProvider interface
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        this.webviewView = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getConnectionTabHtml(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'navigate':
                await this.handleNavigation(message.data);
                break;
            case 'refresh':
                await this.handleRefresh(message.data);
                break;
            case 'openConnection':
                await this.handleOpenConnection(message.data);
                break;
            case 'executeQuery':
                await this.handleExecuteQuery(message.data);
                break;
            case 'closeTab':
                await this.handleCloseTab(message.data);
                break;
        }
    }

    private async handleNavigation(data: any) {
        // Handle breadcrumb navigation
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                command: 'updateContent',
                data: { path: data.path, content: await this.getContentForPath(data.path) }
            });
        }
    }

    private async handleRefresh(data: any) {
        // Refresh current view
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                command: 'refreshComplete',
                data: { success: true }
            });
        }
    }

    private async handleOpenConnection(data: any) {
        try {
            await this.connectionManager.connect(data.connectionId);
            vscode.window.showInformationMessage(`Connected to ${data.connectionName}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
        }
    }

    private async handleExecuteQuery(data: any) {
        try {
            const result = await this.connectionManager.executeQuery(data.query);
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    command: 'queryResult',
                    data: result
                });
            }
        } catch (error: any) {
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    command: 'queryError',
                    data: { error: error.message }
                });
            }
        }
    }

    private async handleCloseTab(data: any) {
        // Handle tab closing
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                command: 'tabClosed',
                data: { tabId: data.tabId }
            });
        }
    }

    private async getContentForPath(path: string[]): Promise<any> {
        // Generate content based on navigation path
        if (path.length === 0) {
            return this.getWelcomeContent();
        } else if (path.length === 1) {
            return this.getDatabaseContent(path[0]);
        } else if (path.length === 2) {
            return this.getSchemaContent(path[0], path[1]);
        } else if (path.length === 3) {
            return this.getTableContent(path[0], path[1], path[2]);
        }
        return null;
    }

    private getWelcomeContent() {
        const connections = this.connectionManager.getAllConnections();
        const activeConnection = this.connectionManager.getActiveConnection();
        
        return {
            type: 'welcome',
            activeConnection,
            connections,
            stats: {
                totalConnections: connections.length,
                activeConnections: this.connectionManager.getActiveConnections().length
            }
        };
    }

    private async getDatabaseContent(serverName: string) {
        try {
            const databases = await this.connectionManager.getDatabases();
            return {
                type: 'databases',
                serverName,
                databases
            };
        } catch (error) {
            return { type: 'error', message: (error as Error).message };
        }
    }

    private async getSchemaContent(serverName: string, databaseName: string) {
        try {
            const tables = await this.connectionManager.getTables(databaseName);
            return {
                type: 'schemas',
                serverName,
                databaseName,
                tables
            };
        } catch (error) {
            return { type: 'error', message: (error as Error).message };
        }
    }

    private async getTableContent(serverName: string, databaseName: string, tableName: string) {
        try {
            const columns = await this.connectionManager.getTableColumns(tableName);
            return {
                type: 'table',
                serverName,
                databaseName,
                tableName,
                columns
            };
        } catch (error) {
            return { type: 'error', message: (error as Error).message };
        }
    }

    private getConnectionTabHtml(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Database Connection Tab</title>
            <style>
                :root {
                    --primary-color: #007bff;
                    --success-color: #28a745;
                    --danger-color: #dc3545;
                    --warning-color: #ffc107;
                    --info-color: #17a2b8;
                    --light-color: #f8f9fa;
                    --dark-color: #343a40;
                    --border-color: #dee2e6;
                    --text-color: #212529;
                    --text-muted: #6c757d;
                    --spacing-small: 8px;
                    --spacing-medium: 16px;
                    --spacing-large: 24px;
                    --border-radius: 6px;
                    --shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    --shadow-hover: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
                    margin: 0;
                    padding: 0;
                    background-color: var(--vscode-editor-background, #ffffff);
                    color: var(--vscode-editor-foreground, var(--text-color));
                    line-height: 1.5;
                    overflow-x: hidden;
                }

                /* Enhanced Breadcrumb Navigation */
                .breadcrumb-container {
                    background: linear-gradient(135deg, 
                        var(--vscode-editor-background, #ffffff) 0%, 
                        var(--vscode-sideBar-background, #f8f9fa) 100%);
                    border-bottom: 1px solid var(--vscode-input-border, var(--border-color));
                    padding: var(--spacing-medium);
                    backdrop-filter: blur(10px);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .breadcrumb {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: var(--spacing-small);
                    font-size: 14px;
                }

                .breadcrumb-item {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 6px 12px;
                    border-radius: var(--border-radius);
                    transition: all 0.2s ease;
                    background-color: transparent;
                    border: 1px solid transparent;
                    color: var(--vscode-editor-foreground, var(--text-color));
                    text-decoration: none;
                }

                .breadcrumb-item:hover {
                    background-color: var(--vscode-list-hoverBackground, rgba(0, 123, 255, 0.1));
                    border-color: var(--primary-color);
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-hover);
                }

                .breadcrumb-item.active {
                    background-color: var(--vscode-list-activeSelectionBackground, var(--primary-color));
                    color: var(--vscode-list-activeSelectionForeground, white);
                    font-weight: 600;
                }

                .breadcrumb-separator {
                    color: var(--vscode-descriptionForeground, var(--text-muted));
                    margin: 0 4px;
                    font-size: 12px;
                }

                /* Enhanced Tab System */
                .tab-container {
                    background-color: var(--vscode-tab-inactiveBackground, var(--light-color));
                    border-bottom: 1px solid var(--vscode-input-border, var(--border-color));
                    overflow-x: auto;
                    scrollbar-width: thin;
                }

                .tab-list {
                    display: flex;
                    min-width: min-content;
                    padding: 0;
                    margin: 0;
                    list-style: none;
                }

                .tab-item {
                    position: relative;
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    background-color: var(--vscode-tab-inactiveBackground, transparent);
                    color: var(--vscode-tab-inactiveForeground, var(--text-muted));
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    min-width: 120px;
                    justify-content: space-between;
                    border-top: 3px solid transparent;
                }

                .tab-item:hover {
                    background-color: var(--vscode-tab-hoverBackground, rgba(0, 123, 255, 0.1));
                    color: var(--vscode-tab-hoverForeground, var(--text-color));
                }

                .tab-item.active {
                    background-color: var(--vscode-tab-activeBackground, var(--vscode-editor-background, #ffffff));
                    color: var(--vscode-tab-activeForeground, var(--text-color));
                    border-top-color: var(--primary-color);
                    box-shadow: 0 -2px 0 var(--primary-color);
                }

                .tab-item.modified::before {
                    content: '●';
                    color: var(--warning-color);
                    margin-right: 6px;
                    font-size: 12px;
                }

                .tab-close {
                    margin-left: 8px;
                    padding: 2px 4px;
                    border-radius: 3px;
                    opacity: 0.6;
                    transition: all 0.2s ease;
                    font-size: 14px;
                    line-height: 1;
                }

                .tab-close:hover {
                    opacity: 1;
                    background-color: var(--danger-color);
                    color: white;
                }

                /* Content Area */
                .content-area {
                    padding: var(--spacing-large);
                    min-height: calc(100vh - 120px);
                }

                .content-panel {
                    background-color: var(--vscode-editor-background, #ffffff);
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: var(--border-radius);
                    padding: var(--spacing-large);
                    box-shadow: var(--shadow);
                }

                /* Welcome Content */
                .welcome-content {
                    text-align: center;
                    padding: var(--spacing-large) 0;
                }

                .welcome-title {
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: var(--spacing-medium);
                    background: linear-gradient(135deg, var(--primary-color), var(--info-color));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .connection-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: var(--spacing-medium);
                    margin-top: var(--spacing-large);
                }

                .info-card {
                    background: linear-gradient(135deg, 
                        var(--vscode-editor-background, #ffffff) 0%, 
                        var(--vscode-sideBar-background, #f8f9fa) 100%);
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: var(--border-radius);
                    padding: var(--spacing-large);
                    text-align: left;
                    transition: all 0.2s ease;
                }

                .info-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                    border-color: var(--primary-color);
                }

                .info-card-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: var(--spacing-small);
                    color: var(--primary-color);
                }

                .info-card-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--vscode-editor-foreground, var(--text-color));
                }

                .info-card-description {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground, var(--text-muted));
                    margin-top: 4px;
                }

                /* Database List */
                .database-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: var(--spacing-medium);
                    margin-top: var(--spacing-medium);
                }

                .database-card {
                    background-color: var(--vscode-input-background, var(--light-color));
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: var(--border-radius);
                    padding: var(--spacing-medium);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .database-card:hover {
                    border-color: var(--primary-color);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover);
                }

                .database-name {
                    font-weight: 600;
                    margin-bottom: var(--spacing-small);
                }

                .database-info {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground, var(--text-muted));
                }

                /* Loading States */
                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-large);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--vscode-input-border, var(--border-color));
                    border-top: 3px solid var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Error States */
                .error-content {
                    text-align: center;
                    padding: var(--spacing-large);
                    color: var(--danger-color);
                }

                .error-icon {
                    font-size: 48px;
                    margin-bottom: var(--spacing-medium);
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .breadcrumb {
                        font-size: 12px;
                    }
                    
                    .tab-item {
                        min-width: 100px;
                        padding: 10px 12px;
                    }
                    
                    .connection-info {
                        grid-template-columns: 1fr;
                    }
                    
                    .database-list {
                        grid-template-columns: 1fr;
                    }
                }

                /* Smooth transitions */
                .fade-in {
                    animation: fadeIn 0.3s ease-in;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        </head>
        <body>
            <!-- Enhanced Breadcrumb Navigation -->
            <div class="breadcrumb-container">
                <nav class="breadcrumb" id="breadcrumb">
                    <a href="#" class="breadcrumb-item active" data-path="">
                        🏠 Home
                    </a>
                </nav>
            </div>

            <!-- Enhanced Tab System -->
            <div class="tab-container">
                <ul class="tab-list" id="tabList">
                    <li class="tab-item active" data-tab="welcome">
                        <span>Welcome</span>
                    </li>
                </ul>
            </div>

            <!-- Content Area -->
            <div class="content-area">
                <div class="content-panel fade-in" id="contentPanel">
                    <div class="welcome-content">
                        <h1 class="welcome-title">Ultimate Database Manager</h1>
                        <p>Connect to your databases and start exploring your data with our modern, intuitive interface.</p>
                        
                        <div class="connection-info">
                            <div class="info-card">
                                <div class="info-card-title">Active Connections</div>
                                <div class="info-card-value" id="activeConnections">0</div>
                                <div class="info-card-description">Currently connected databases</div>
                            </div>
                            <div class="info-card">
                                <div class="info-card-title">Total Connections</div>
                                <div class="info-card-value" id="totalConnections">0</div>
                                <div class="info-card-description">Configured database connections</div>
                            </div>
                            <div class="info-card">
                                <div class="info-card-title">Database Types</div>
                                <div class="info-card-value" id="databaseTypes">12+</div>
                                <div class="info-card-description">Supported database systems</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentPath = [];
                let tabs = [{ id: 'welcome', title: 'Welcome', active: true, modified: false }];

                // Initialize the interface
                document.addEventListener('DOMContentLoaded', function() {
                    updateWelcomeContent();
                    setupEventListeners();
                });

                function setupEventListeners() {
                    // Breadcrumb navigation
                    document.getElementById('breadcrumb').addEventListener('click', function(e) {
                        if (e.target.classList.contains('breadcrumb-item')) {
                            e.preventDefault();
                            const path = e.target.getAttribute('data-path');
                            navigateToPath(path ? path.split('/') : []);
                        }
                    });

                    // Tab management
                    document.getElementById('tabList').addEventListener('click', function(e) {
                        if (e.target.classList.contains('tab-close')) {
                            e.stopPropagation();
                            const tabId = e.target.closest('.tab-item').getAttribute('data-tab');
                            closeTab(tabId);
                        } else if (e.target.closest('.tab-item')) {
                            const tabId = e.target.closest('.tab-item').getAttribute('data-tab');
                            switchToTab(tabId);
                        }
                    });
                }

                function updateBreadcrumb(path) {
                    const breadcrumb = document.getElementById('breadcrumb');
                    breadcrumb.innerHTML = '';

                    // Home breadcrumb
                    const homeItem = document.createElement('a');
                    homeItem.href = '#';
                    homeItem.className = 'breadcrumb-item' + (path.length === 0 ? ' active' : '');
                    homeItem.setAttribute('data-path', '');
                    homeItem.innerHTML = '🏠 Home';
                    breadcrumb.appendChild(homeItem);

                    // Path breadcrumbs
                    for (let i = 0; i < path.length; i++) {
                        const separator = document.createElement('span');
                        separator.className = 'breadcrumb-separator';
                        separator.textContent = '>';
                        breadcrumb.appendChild(separator);

                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = 'breadcrumb-item' + (i === path.length - 1 ? ' active' : '');
                        item.setAttribute('data-path', path.slice(0, i + 1).join('/'));
                        item.textContent = path[i];
                        breadcrumb.appendChild(item);
                    }
                }

                function navigateToPath(path) {
                    currentPath = path;
                    updateBreadcrumb(path);
                    
                    vscode.postMessage({
                        command: 'navigate',
                        data: { path: path }
                    });
                }

                function addTab(id, title, closeable = true) {
                    if (tabs.find(tab => tab.id === id)) {
                        switchToTab(id);
                        return;
                    }

                    tabs.forEach(tab => tab.active = false);
                    tabs.push({ id, title, active: true, modified: false, closeable });
                    updateTabs();
                }

                function closeTab(tabId) {
                    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
                    if (tabIndex === -1 || !tabs[tabIndex].closeable) return;

                    tabs.splice(tabIndex, 1);
                    
                    if (tabs.length === 0) {
                        addTab('welcome', 'Welcome', false);
                    } else if (tabs[tabIndex] && tabs[tabIndex].active) {
                        tabs[Math.max(0, tabIndex - 1)].active = true;
                    }
                    
                    updateTabs();
                    
                    vscode.postMessage({
                        command: 'closeTab',
                        data: { tabId }
                    });
                }

                function switchToTab(tabId) {
                    tabs.forEach(tab => tab.active = tab.id === tabId);
                    updateTabs();
                }

                function updateTabs() {
                    const tabList = document.getElementById('tabList');
                    tabList.innerHTML = '';

                    tabs.forEach(tab => {
                        const li = document.createElement('li');
                        li.className = 'tab-item' + (tab.active ? ' active' : '') + (tab.modified ? ' modified' : '');
                        li.setAttribute('data-tab', tab.id);
                        
                        const span = document.createElement('span');
                        span.textContent = tab.title;
                        li.appendChild(span);

                        if (tab.closeable !== false) {
                            const closeBtn = document.createElement('span');
                            closeBtn.className = 'tab-close';
                            closeBtn.innerHTML = '×';
                            li.appendChild(closeBtn);
                        }

                        tabList.appendChild(li);
                    });
                }

                function updateWelcomeContent() {
                    // This would be populated with real data from the extension
                    document.getElementById('activeConnections').textContent = '0';
                    document.getElementById('totalConnections').textContent = '0';
                    document.getElementById('databaseTypes').textContent = '12+';
                }

                function showLoading() {
                    const contentPanel = document.getElementById('contentPanel');
                    contentPanel.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                }

                function showError(message) {
                    const contentPanel = document.getElementById('contentPanel');
                    contentPanel.innerHTML = \`
                        <div class="error-content">
                            <div class="error-icon">⚠️</div>
                            <h3>Error</h3>
                            <p>\${message}</p>
                        </div>
                    \`;
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateContent':
                            updateContent(message.data);
                            break;
                        case 'refreshComplete':
                            // Handle refresh completion
                            break;
                        case 'queryResult':
                            displayQueryResult(message.data);
                            break;
                        case 'queryError':
                            showError(message.data.error);
                            break;
                    }
                });

                function updateContent(data) {
                    const contentPanel = document.getElementById('contentPanel');
                    contentPanel.classList.add('fade-in');
                    
                    switch (data.content?.type) {
                        case 'welcome':
                            updateWelcomeContent();
                            break;
                        case 'databases':
                            displayDatabases(data.content.databases);
                            break;
                        case 'schemas':
                            displaySchemas(data.content.tables);
                            break;
                        case 'table':
                            displayTable(data.content);
                            break;
                        case 'error':
                            showError(data.content.message);
                            break;
                    }
                }

                function displayDatabases(databases) {
                    const contentPanel = document.getElementById('contentPanel');
                    let html = '<h2>Databases</h2><div class="database-list">';
                    
                    databases.forEach(db => {
                        html += \`
                            <div class="database-card" onclick="navigateToDatabase('\${db}')">
                                <div class="database-name">\${db}</div>
                                <div class="database-info">Click to explore</div>
                            </div>
                        \`;
                    });
                    
                    html += '</div>';
                    contentPanel.innerHTML = html;
                }

                function displaySchemas(tables) {
                    const contentPanel = document.getElementById('contentPanel');
                    let html = '<h2>Tables & Views</h2><div class="database-list">';
                    
                    tables.forEach(table => {
                        html += \`
                            <div class="database-card" onclick="navigateToTable('\${table}')">
                                <div class="database-name">\${table}</div>
                                <div class="database-info">Table</div>
                            </div>
                        \`;
                    });
                    
                    html += '</div>';
                    contentPanel.innerHTML = html;
                }

                function displayTable(tableData) {
                    const contentPanel = document.getElementById('contentPanel');
                    let html = \`<h2>Table: \${tableData.tableName}</h2>\`;
                    
                    if (tableData.columns && tableData.columns.length > 0) {
                        html += '<table class="table"><thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Default</th></tr></thead><tbody>';
                        
                        tableData.columns.forEach(col => {
                            html += \`
                                <tr>
                                    <td>\${col.column_name}</td>
                                    <td>\${col.data_type}</td>
                                    <td>\${col.is_nullable}</td>
                                    <td>\${col.column_default || 'NULL'}</td>
                                </tr>
                            \`;
                        });
                        
                        html += '</tbody></table>';
                    }
                    
                    contentPanel.innerHTML = html;
                }

                function navigateToDatabase(dbName) {
                    const newPath = [dbName];
                    navigateToPath(newPath);
                    addTab(\`db-\${dbName}\`, dbName);
                }

                function navigateToTable(tableName) {
                    const newPath = [...currentPath, tableName];
                    navigateToPath(newPath);
                    addTab(\`table-\${tableName}\`, tableName);
                }

                function displayQueryResult(result) {
                    // Display query results in a new tab
                    addTab('query-result', 'Query Result');
                    // Implementation for displaying query results
                }
            </script>
        </body>
        </html>`;
    }
}
