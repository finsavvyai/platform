import * as vscode from 'vscode';
import * as fs from 'fs';
import { DatabaseConnectionManager } from '../services/connectionManager';
import { PostgreSQLTreeProvider, PostgreSQLNode, NodeType } from '../explorer/postgresProvider';

/**
 * Register all extension commands
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    connectionManager: DatabaseConnectionManager,
    treeProvider: PostgreSQLTreeProvider
): void {
    // Register connect command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.connect', async () => {
            await connectionManager.connect();
            treeProvider.refresh();
        })
    );
    
    // Register disconnect command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.disconnect', async () => {
            await connectionManager.disconnect();
            treeProvider.refresh();
        })
    );
    
    // Register refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.refreshConnection', () => {
            treeProvider.refresh();
        })
    );
    
    // Register open query command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.openQuery', async (node?: PostgreSQLNode) => {
            let databaseName = '';
            
            // If command was invoked from tree view with a node
            if (node && node.type === NodeType.DATABASE) {
                databaseName = node.label;
            }
            
            // Create a new untitled SQL file
            const document = await vscode.workspace.openTextDocument({
                language: 'sql',
                content: `-- PostgreSQL Query for ${databaseName || 'database'}\n-- Press the execute button (▶️) in the editor toolbar to run\n\nSELECT * FROM information_schema.tables\nWHERE table_schema = 'public'\nLIMIT 10;\n`
            });
            
            await vscode.window.showTextDocument(document);
        })
    );
    
    // Register execute query command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.executeQuery', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active SQL editor');
                return;
            }
            
            if (editor.document.languageId !== 'sql') {
                vscode.window.showErrorMessage('Not an SQL file');
                return;
            }
            
            // Check if connected to database
            if (!connectionManager.isConnected()) {
                const connect = await vscode.window.showInformationMessage(
                    'Not connected to a database. Connect now?',
                    'Yes',
                    'No'
                );
                
                if (connect !== 'Yes') {
                    return;
                }
                
                const connected = await connectionManager.connect();
                if (!connected) {
                    return;
                }
            }
            
            // Get the query text from editor
            let query = '';
            
            if (editor.selection.isEmpty) {
                // If no selection, use entire document
                query = editor.document.getText();
            } else {
                // Otherwise use selection
                query = editor.document.getText(editor.selection);
            }
            
            try {
                // Create and show results panel
                const panel = vscode.window.createWebviewPanel(
                    'queryResults',
                    'Query Results',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true
                    }
                );
                
                // Show loading message
                panel.webview.html = getLoadingHtml();
                
                // Execute query
                const startTime = Date.now();
                const results = await connectionManager.executeQuery(query);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Update panel with results
                panel.webview.html = getResultsHtml(query, results, duration);
            }
            catch (err: any) {
                vscode.window.showErrorMessage(`Query error: ${err.message}`);
            }
        })
    );
    
    // Register create database command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.createDatabase', async () => {
            if (!connectionManager.isConnected()) {
                vscode.window.showErrorMessage('Not connected to PostgreSQL');
                return;
            }
            
            // Prompt for database name
            const dbName = await vscode.window.showInputBox({
                prompt: 'Enter new database name',
                validateInput: value => {
                    if (!value) {return 'Database name is required';}
                    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                        return 'Database name can only contain letters, numbers and underscores';
                    }
                    return null;
                }
            });
            
            if (!dbName) {
                return;
            }
            
            // Create the database
            await connectionManager.createDatabase(dbName);
            treeProvider.refresh();
        })
    );
    
    // Register drop database command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.dropDatabase', async (node?: PostgreSQLNode) => {
            if (!connectionManager.isConnected()) {
                vscode.window.showErrorMessage('Not connected to PostgreSQL');
                return;
            }
            
            // If node is provided, use it; otherwise prompt for database name
            let dbName = '';
            
            if (node && node.type === NodeType.DATABASE) {
                dbName = node.label;
            } else {
                // Get list of databases
                const databases = await connectionManager.getDatabases();
                
                // Show dropdown
                const selectedDb = await vscode.window.showQuickPick(databases, {
                    placeHolder: 'Select database to drop'
                });
                
                if (!selectedDb) {
                    return;
                }
                
                dbName = selectedDb;
            }
            
            // Confirm deletion
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to drop database '${dbName}'? This cannot be undone.`,
                'Yes, drop database',
                'Cancel'
            );
            
            if (confirm !== 'Yes, drop database') {
                return;
            }
            
            // Drop the database
            await connectionManager.dropDatabase(dbName);
            treeProvider.refresh();
        })
    );
    
    // Register show table command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.showTable', async (node?: PostgreSQLNode) => {
            if (!connectionManager.isConnected() || !node) {
                vscode.window.showErrorMessage('Not connected or no table selected');
                return;
            }
            
            try {
                // Get table name and schema from node
                let tableName = '';
                let schemaName = 'public';
                
                if (node.type === NodeType.TABLE) {
                    tableName = node.label;
                    if (node.parent) {
                        schemaName = node.parent.label;
                    }
                } else {
                    return;
                }
                
                // Execute query to get table data
                const query = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT 100`;
                
                // Create and show results panel
                const panel = vscode.window.createWebviewPanel(
                    'tableData',
                    `${schemaName}.${tableName}`,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true
                    }
                );
                
                // Show loading message
                panel.webview.html = getLoadingHtml();
                
                // Execute query
                const results = await connectionManager.executeQuery(query);
                
                // Update panel with results
                panel.webview.html = getResultsHtml(query, results, 0);
            }
            catch (err: any) {
                vscode.window.showErrorMessage(`Error showing table: ${err.message}`);
            }
        })
    );
    
    // Register export data command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.exportData', async (node?: PostgreSQLNode) => {
            if (!connectionManager.isConnected() || !node) {
                vscode.window.showErrorMessage('Not connected or no item selected');
                return;
            }
            
            try {
                // Determine if exporting a table or whole database
                let query = '';
                let fileName = '';
                
                if (node.type === NodeType.TABLE) {
                    const tableName = node.label;
                    let schemaName = 'public';
                    
                    if (node.parent) {
                        schemaName = node.parent.label;
                    }
                    
                    query = `SELECT * FROM "${schemaName}"."${tableName}"`;
                    fileName = `${tableName}_export.csv`;
                } 
                else if (node.type === NodeType.DATABASE) {
                    vscode.window.showInformationMessage(
                        'Exporting entire databases is not supported through the extension. Please use the desktop app for this feature.'
                    );
                    return;
                }
                else {
                    return;
                }
                
                // Show file save dialog
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(fileName),
                    filters: {
                        'CSV Files': ['csv'],
                        'All Files': ['*']
                    }
                });
                
                if (!uri) {
                    return;
                }
                
                // Execute query
                const results = await connectionManager.executeQuery(query);
                
                // Write results to CSV
                let csv = '';
                
                // Add headers
                if (results.length > 0) {
                    csv = Object.keys(results[0]).join(',') + '\n';
                }
                
                // Add data rows
                for (const row of results) {
                    const values = Object.values(row).map(value => {
                        if (value === null) {
                            return '';
                        }
                        if (typeof value === 'string') {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    });
                    
                    csv += values.join(',') + '\n';
                }
                
                // Write to file
                fs.writeFileSync(uri.fsPath, csv);
                
                vscode.window.showInformationMessage(`Data exported to ${uri.fsPath}`);
            }
            catch (err: any) {
                vscode.window.showErrorMessage(`Error exporting data: ${err.message}`);
            }
        })
    );
    
    // Register import data command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.importData', async () => {
            vscode.window.showInformationMessage(
                'Data import is currently only available in the desktop app. Use the "Open Desktop App" command to access this feature.'
            );
        })
    );
    
    // Register open desktop app command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.openDesktopApp', async () => {
            await connectionManager.openDesktopApp();
        })
    );
    
    // Register show performance dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.showPerformance', async () => {
            vscode.window.showInformationMessage(
                'The performance dashboard is available in the desktop app. Use the "Open Desktop App" command to access this feature.'
            );
            
            await connectionManager.openDesktopApp();
        })
    );
}

/**
 * Get HTML for loading message
 */
function getLoadingHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Query Results</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                .loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100px;
                }
                .spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border-left-color: #09f;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <div style="margin-left: 10px;">Executing query...</div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Get HTML for query results
 */
function getResultsHtml(query: string, results: any[], duration: number): string {
    // Create table HTML
    let tableHtml = '';
    
    if (results.length === 0) {
        tableHtml = '<p>No results returned</p>';
    } else {
        // Table headers
        tableHtml = '<table><thead><tr>';
        const headers = Object.keys(results[0]);
        
        headers.forEach(header => {
            tableHtml += `<th>${header}</th>`;
        });
        
        tableHtml += '</tr></thead><tbody>';
        
        // Table rows
        results.forEach(row => {
            tableHtml += '<tr>';
            
            headers.forEach(header => {
                let value = row[header];
                
                // Format values
                if (value === null) {
                    value = '<em>NULL</em>';
                } else if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                
                tableHtml += `<td>${value}</td>`;
            });
            
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
    }
    
    // Return complete HTML
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Query Results</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                }
                .query {
                    background-color: #f5f5f5;
                    padding: 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    white-space: pre-wrap;
                    margin-bottom: 20px;
                }
                .summary {
                    margin-bottom: 20px;
                    color: #666;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                    position: sticky;
                    top: 0;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #f1f1f1;
                }
                .container {
                    max-height: 80vh;
                    overflow: auto;
                }
            </style>
        </head>
        <body>
            <h2>Query Results</h2>
            <div class="query">${query}</div>
            <div class="summary">
                ${results.length} row${results.length !== 1 ? 's' : ''} returned
                ${duration ? `in ${duration}ms` : ''}
            </div>
            <div class="container">
                ${tableHtml}
            </div>
        </body>
        </html>
    `;
}
