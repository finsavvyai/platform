/**
 * Ultimate DB Manager Webview Provider
 * Provides rich webview interfaces for database management
 */

import * as vscode from 'vscode';

export class UltimateDBWebviewProvider implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private extensionContext: any;

    constructor(context: vscode.ExtensionContext, extensionContext: any) {
        this.context = context;
        this.extensionContext = extensionContext;
    }

    /**
     * Required method for WebviewViewProvider interface
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getConnectionManagerHtml(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'testConnection':
                        this.handleTestConnection(message.data);
                        break;
                    case 'saveConnection':
                        this.handleSaveConnection(message.data);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Create a webview panel for the connection manager
     */
    createConnectionManagerWebview(): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'ultimatedbConnectionManager',
            'Database Connections',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getConnectionManagerHtml(panel.webview);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'testConnection':
                        this.handleTestConnection(message.data);
                        break;
                    case 'saveConnection':
                        this.handleSaveConnection(message.data);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        return panel;
    }

    private getConnectionManagerHtml(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Database Connections</title>
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
                }

                body { 
                    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); 
                    margin: 0;
                    padding: var(--spacing-large);
                    background-color: var(--vscode-editor-background, #ffffff);
                    color: var(--vscode-editor-foreground, var(--text-color));
                    line-height: 1.5;
                }

                .connection-dialog {
                    max-width: 700px;
                    margin: 0 auto;
                    background-color: var(--vscode-editor-background, #ffffff);
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: 8px;
                    padding: var(--spacing-large);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .dialog-header {
                    text-align: center;
                    margin-bottom: var(--spacing-large);
                    padding-bottom: var(--spacing-medium);
                    border-bottom: 1px solid var(--vscode-input-border, var(--border-color));
                }

                .dialog-title {
                    font-size: 24px;
                    font-weight: 600;
                    margin: 0;
                    color: var(--vscode-editor-foreground, var(--text-color));
                }

                /* Database Type Selection */
                .db-type-section {
                    margin-bottom: var(--spacing-large);
                }

                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: var(--spacing-medium);
                    color: var(--vscode-editor-foreground, var(--text-color));
                }

                .db-tabs {
                    display: flex;
                    border-bottom: 2px solid var(--vscode-input-border, var(--border-color));
                    margin-bottom: var(--spacing-medium);
                }

                .db-tab {
                    padding: 12px 20px;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    color: var(--vscode-editor-foreground, var(--text-muted));
                    font-weight: 500;
                    transition: all 0.2s ease;
                    border-bottom: 2px solid transparent;
                }

                .db-tab:hover {
                    background-color: var(--vscode-list-hoverBackground, rgba(0, 123, 255, 0.1));
                    color: var(--primary-color);
                }

                .db-tab.active {
                    color: var(--primary-color);
                    border-bottom-color: var(--primary-color);
                    background-color: var(--vscode-list-activeSelectionBackground, rgba(0, 123, 255, 0.1));
                }

                .db-options {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: var(--spacing-medium);
                    margin-bottom: var(--spacing-large);
                }

                .db-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--spacing-medium);
                    border: 2px solid transparent;
                    border-radius: 8px;
                    background-color: var(--vscode-input-background, var(--light-color));
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-height: 120px;
                    justify-content: center;
                }

                .db-card:hover {
                    border-color: var(--primary-color);
                    background-color: var(--vscode-list-hoverBackground, #ffffff);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                .db-card.selected {
                    border-color: var(--primary-color);
                    background-color: var(--vscode-list-activeSelectionBackground, rgba(0, 123, 255, 0.1));
                }

                .db-icon {
                    width: 48px;
                    height: 48px;
                    margin-bottom: var(--spacing-small);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    font-weight: bold;
                    color: white;
                }

                .db-name {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                    text-align: center;
                }

                .db-description {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground, var(--text-muted));
                    text-align: center;
                    line-height: 1.3;
                }

                /* Connection Details Form */
                .connection-details {
                    background-color: var(--vscode-editor-background, #ffffff);
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: 8px;
                    padding: var(--spacing-large);
                    margin-bottom: var(--spacing-large);
                }

                .quick-connect-section {
                    margin-bottom: var(--spacing-large);
                    padding-bottom: var(--spacing-medium);
                    border-bottom: 1px solid var(--vscode-input-border, var(--border-color));
                }

                .quick-connect-layout {
                    display: flex;
                    gap: var(--spacing-small);
                    align-items: flex-end;
                }

                .form-layout {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--spacing-medium);
                }

                .form-group {
                    margin-bottom: var(--spacing-medium);
                }

                .form-group.full-width {
                    grid-column: 1 / -1;
                }

                label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: var(--vscode-editor-foreground, var(--text-color));
                    font-size: 13px;
                }

                input, select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                    border-radius: 4px;
                    background-color: var(--vscode-input-background, #ffffff);
                    color: var(--vscode-input-foreground, var(--text-color));
                    font-size: 13px;
                    transition: border-color 0.2s ease;
                    box-sizing: border-box;
                }

                input:focus, select:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
                }

                input::placeholder {
                    color: var(--vscode-input-placeholderForeground, var(--text-muted));
                }

                /* Button Styling */
                .button-layout {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: var(--spacing-large);
                    padding-top: var(--spacing-medium);
                    border-top: 1px solid var(--vscode-input-border, var(--border-color));
                }

                .btn {
                    padding: 10px 24px;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-width: 100px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground, var(--light-color));
                    color: var(--vscode-button-secondaryForeground, var(--text-color));
                    border: 1px solid var(--vscode-input-border, var(--border-color));
                }

                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground, #e9ecef);
                    border-color: var(--vscode-input-border, #adb5bd);
                }

                .btn-primary {
                    background-color: var(--vscode-button-background, var(--primary-color));
                    color: var(--vscode-button-foreground, white);
                    min-width: 140px;
                }

                .btn-primary:hover {
                    background-color: var(--vscode-button-hoverBackground, #0056b3);
                }

                .btn-success {
                    background-color: var(--success-color);
                    color: white;
                }

                .btn-success:hover {
                    background-color: #218838;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* Status and feedback */
                .status-message {
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: var(--spacing-medium);
                    font-size: 14px;
                }

                .status-success {
                    background-color: rgba(40, 167, 69, 0.1);
                    color: var(--success-color);
                    border: 1px solid rgba(40, 167, 69, 0.2);
                }

                .status-error {
                    background-color: rgba(220, 53, 69, 0.1);
                    color: var(--danger-color);
                    border: 1px solid rgba(220, 53, 69, 0.2);
                }

                .status-loading {
                    background-color: rgba(23, 162, 184, 0.1);
                    color: var(--info-color);
                    border: 1px solid rgba(23, 162, 184, 0.2);
                }

                /* Responsive design */
                @media (max-width: 768px) {
                    .form-layout {
                        grid-template-columns: 1fr;
                    }
                    
                    .db-options {
                        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    }
                    
                    .button-layout {
                        flex-direction: column;
                    }
                }

                /* Loading spinner */
                .spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid transparent;
                    border-top: 2px solid currentColor;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="connection-dialog">
                <div class="dialog-header">
                    <h1 class="dialog-title">Database Connection Manager</h1>
                </div>

                <!-- Database Type Selection -->
                <div class="db-type-section">
                    <h2 class="section-title">Database Type</h2>
                    
                    <div class="db-tabs">
                        <button class="db-tab active" data-tab="sql">SQL</button>
                        <button class="db-tab" data-tab="nosql">NoSQL</button>
                        <button class="db-tab" data-tab="cloud">Cloud</button>
                        <button class="db-tab" data-tab="timeseries">Time Series</button>
                    </div>

                    <div class="db-options" id="dbOptions">
                        <!-- SQL Databases -->
                        <div class="db-card" data-type="PostgreSQL" data-category="sql">
                            <div class="db-icon" style="background-color: #336791;">PG</div>
                            <div class="db-name">PostgreSQL</div>
                            <div class="db-description">Advanced open source database</div>
                        </div>
                        <div class="db-card" data-type="MySQL" data-category="sql">
                            <div class="db-icon" style="background-color: #4479A1;">MY</div>
                            <div class="db-name">MySQL</div>
                            <div class="db-description">Popular relational database</div>
                        </div>
                        <div class="db-card" data-type="SQLite" data-category="sql">
                            <div class="db-icon" style="background-color: #003B57;">SQ</div>
                            <div class="db-name">SQLite</div>
                            <div class="db-description">Lightweight embedded database</div>
                        </div>
                        <div class="db-card" data-type="Oracle" data-category="sql">
                            <div class="db-icon" style="background-color: #F80000;">OR</div>
                            <div class="db-name">Oracle</div>
                            <div class="db-description">Enterprise database system</div>
                        </div>
                        
                        <!-- NoSQL Databases -->
                        <div class="db-card" data-type="MongoDB" data-category="nosql" style="display: none;">
                            <div class="db-icon" style="background-color: #47A248;">MG</div>
                            <div class="db-name">MongoDB</div>
                            <div class="db-description">Document-oriented database</div>
                        </div>
                        <div class="db-card" data-type="Redis" data-category="nosql" style="display: none;">
                            <div class="db-icon" style="background-color: #DC382D;">RD</div>
                            <div class="db-name">Redis</div>
                            <div class="db-description">In-memory data structure</div>
                        </div>
                        <div class="db-card" data-type="Cassandra" data-category="nosql" style="display: none;">
                            <div class="db-icon" style="background-color: #1287B1;">CS</div>
                            <div class="db-name">Cassandra</div>
                            <div class="db-description">Distributed NoSQL database</div>
                        </div>
                        <div class="db-card" data-type="CouchDB" data-category="nosql" style="display: none;">
                            <div class="db-icon" style="background-color: #E42528;">CD</div>
                            <div class="db-name">CouchDB</div>
                            <div class="db-description">Document database with REST API</div>
                        </div>
                    </div>
                </div>

                <!-- Status Messages -->
                <div id="statusMessage" style="display: none;"></div>

                <!-- Connection Details -->
                <div class="connection-details">
                    <h2 class="section-title">Connection Details</h2>
                    
                    <!-- Quick Connect -->
                    <div class="quick-connect-section">
                        <div class="form-group">
                            <label for="quickConnect">Quick Connect:</label>
                            <div class="quick-connect-layout">
                                <input type="text" id="quickConnect" placeholder="postgresql://user:password@host:port/database">
                                <button class="btn btn-secondary" onclick="parseConnectionString()">Parse</button>
                            </div>
                        </div>
                    </div>

                    <!-- Form Fields -->
                    <div class="form-layout">
                        <div class="form-group full-width">
                            <label for="name">Connection Name:</label>
                            <input type="text" id="name" placeholder="My Database Connection">
                        </div>
                        
                        <div class="form-group">
                            <label for="host">Host:</label>
                            <input type="text" id="host" placeholder="localhost" value="localhost">
                        </div>
                        
                        <div class="form-group">
                            <label for="port">Port:</label>
                            <input type="number" id="port" placeholder="5432" value="5432">
                        </div>
                        
                        <div class="form-group">
                            <label for="database">Database:</label>
                            <input type="text" id="database" placeholder="postgres">
                        </div>
                        
                        <div class="form-group">
                            <label for="username">Username:</label>
                            <input type="text" id="username" placeholder="postgres">
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="password">Password:</label>
                            <input type="password" id="password" placeholder="Enter password">
                        </div>
                    </div>
                </div>

                <!-- Buttons -->
                <div class="button-layout">
                    <button class="btn btn-secondary" onclick="cancelConnection()">Cancel</button>
                    <button class="btn btn-primary" onclick="testConnection()" id="testBtn">Test Connection</button>
                    <button class="btn btn-success" onclick="saveConnection()" id="saveBtn">Connect</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let selectedDbType = 'PostgreSQL';
                let currentTab = 'sql';

                // Initialize the interface
                document.addEventListener('DOMContentLoaded', function() {
                    initializeTabs();
                    initializeDbCards();
                    updatePortForDbType();
                });

                function initializeTabs() {
                    const tabs = document.querySelectorAll('.db-tab');
                    tabs.forEach(tab => {
                        tab.addEventListener('click', function() {
                            const tabName = this.getAttribute('data-tab');
                            switchTab(tabName);
                        });
                    });
                }

                function switchTab(tabName) {
                    // Update tab appearance
                    document.querySelectorAll('.db-tab').forEach(tab => {
                        tab.classList.remove('active');
                    });
                    document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');

                    // Show/hide database cards
                    const cards = document.querySelectorAll('.db-card');
                    cards.forEach(card => {
                        const category = card.getAttribute('data-category');
                        if (category === tabName) {
                            card.style.display = 'flex';
                        } else {
                            card.style.display = 'none';
                        }
                    });

                    currentTab = tabName;
                }

                function initializeDbCards() {
                    const cards = document.querySelectorAll('.db-card');
                    cards.forEach(card => {
                        card.addEventListener('click', function() {
                            // Remove selection from all cards
                            cards.forEach(c => c.classList.remove('selected'));
                            
                            // Select this card
                            this.classList.add('selected');
                            selectedDbType = this.getAttribute('data-type');
                            updatePortForDbType();
                        });
                    });

                    // Select PostgreSQL by default
                    document.querySelector('[data-type="PostgreSQL"]').classList.add('selected');
                }

                function updatePortForDbType() {
                    const portInput = document.getElementById('port');
                    const defaultPorts = {
                        'PostgreSQL': 5432,
                        'MySQL': 3306,
                        'SQLite': 0,
                        'Oracle': 1521,
                        'MongoDB': 27017,
                        'Redis': 6379,
                        'Cassandra': 9042,
                        'CouchDB': 5984
                    };
                    
                    if (defaultPorts[selectedDbType] !== undefined) {
                        portInput.value = defaultPorts[selectedDbType];
                    }
                }

                function parseConnectionString() {
                    const connectionString = document.getElementById('quickConnect').value;
                    if (!connectionString) return;

                    try {
                        const url = new URL(connectionString);
                        
                        // Update form fields
                        if (url.hostname) document.getElementById('host').value = url.hostname;
                        if (url.port) document.getElementById('port').value = url.port;
                        if (url.pathname && url.pathname !== '/') {
                            document.getElementById('database').value = url.pathname.substring(1);
                        }
                        if (url.username) document.getElementById('username').value = url.username;
                        if (url.password) document.getElementById('password').value = url.password;

                        showStatus('Connection string parsed successfully!', 'success');
                    } catch (error) {
                        showStatus('Invalid connection string format', 'error');
                    }
                }

                function showStatus(message, type) {
                    const statusDiv = document.getElementById('statusMessage');
                    statusDiv.className = \`status-message status-\${type}\`;
                    statusDiv.textContent = message;
                    statusDiv.style.display = 'block';
                    
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                    }, 5000);
                }

                function testConnection() {
                    const testBtn = document.getElementById('testBtn');
                    const originalText = testBtn.textContent;
                    
                    testBtn.innerHTML = '<span class="spinner"></span>Testing...';
                    testBtn.disabled = true;
                    
                    const data = getFormData();
                    showStatus('Testing connection...', 'loading');
                    
                    vscode.postMessage({
                        command: 'testConnection',
                        data: data
                    });

                    // Reset button after timeout (will be updated by response)
                    setTimeout(() => {
                        testBtn.textContent = originalText;
                        testBtn.disabled = false;
                    }, 10000);
                }

                function saveConnection() {
                    const data = getFormData();
                    if (!data.name.trim()) {
                        showStatus('Please enter a connection name', 'error');
                        return;
                    }
                    
                    showStatus('Saving connection...', 'loading');
                    vscode.postMessage({
                        command: 'saveConnection',
                        data: data
                    });
                }

                function cancelConnection() {
                    vscode.postMessage({
                        command: 'cancel'
                    });
                }

                function getFormData() {
                    return {
                        type: selectedDbType,
                        name: document.getElementById('name').value,
                        host: document.getElementById('host').value,
                        port: parseInt(document.getElementById('port').value) || 0,
                        database: document.getElementById('database').value,
                        username: document.getElementById('username').value,
                        password: document.getElementById('password').value
                    };
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'testResult':
                            handleTestResult(message.data);
                            break;
                        case 'saveResult':
                            handleSaveResult(message.data);
                            break;
                    }
                });

                function handleTestResult(result) {
                    const testBtn = document.getElementById('testBtn');
                    testBtn.textContent = 'Test Connection';
                    testBtn.disabled = false;
                    
                    if (result.success) {
                        showStatus('Connection test successful!', 'success');
                    } else {
                        showStatus(\`Connection failed: \${result.error}\`, 'error');
                    }
                }

                function handleSaveResult(result) {
                    if (result.success) {
                        showStatus('Connection saved successfully!', 'success');
                    } else {
                        showStatus(\`Failed to save connection: \${result.error}\`, 'error');
                    }
                }
            </script>
        </body>
        </html>`;
    }

    private async handleTestConnection(data: any) {
        try {
            const connectionManager = this.extensionContext.connectionManager;
            if (!connectionManager) {
                throw new Error('Connection manager not available');
            }

            const result = await connectionManager.testConnection(data);
            
            // Send result back to webview
            vscode.window.activeTextEditor?.document.uri;
            // Note: In a real implementation, we'd need to store the webview reference
            // and send the message back to it
            console.log('Test result:', result);
            
            if (result.success) {
                vscode.window.showInformationMessage('Connection test successful!');
            } else {
                vscode.window.showErrorMessage(`Connection test failed: ${result.error}`);
            }
        } catch (error: any) {
            console.error('Error testing connection:', error);
            vscode.window.showErrorMessage(`Connection test failed: ${error.message}`);
        }
    }

    private async handleSaveConnection(data: any) {
        try {
            const connectionManager = this.extensionContext.connectionManager;
            if (!connectionManager) {
                throw new Error('Connection manager not available');
            }

            // Validate required fields
            if (!data.name?.trim()) {
                throw new Error('Connection name is required');
            }
            if (!data.host?.trim()) {
                throw new Error('Host is required');
            }
            if (!data.username?.trim()) {
                throw new Error('Username is required');
            }

            const connection = await connectionManager.addConnection(data);
            
            vscode.window.showInformationMessage(`Connection "${data.name}" saved successfully!`);
            
            // Optionally connect immediately
            const shouldConnect = await vscode.window.showQuickPick(
                ['Yes', 'No'],
                { placeHolder: 'Would you like to connect now?' }
            );
            
            if (shouldConnect === 'Yes') {
                await connectionManager.connect(connection.id);
                vscode.window.showInformationMessage(`Connected to "${data.name}"!`);
            }
        } catch (error: any) {
            console.error('Error saving connection:', error);
            vscode.window.showErrorMessage(`Failed to save connection: ${error.message}`);
        }
    }
}
