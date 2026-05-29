import * as vscode from 'vscode';
import { SimpleConnectionManager } from './services/simpleConnectionManager';

/**
 * Activates the extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('PostgreSQL Desktop Manager extension is now active.');

    // Initialize the connection manager
    const connectionManager = new SimpleConnectionManager();

    // Register basic commands
    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.connect', async () => {
            await connectionManager.connect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.connectUrl', async () => {
            await connectionManager.connectWithUrl();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.disconnect', async () => {
            await connectionManager.disconnect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.executeQuery', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active SQL editor');
                return;
            }

            if (!connectionManager.isConnected()) {
                const connect = await vscode.window.showInformationMessage(
                    'Not connected to a database. Connect now?',
                    'Yes', 'No'
                );
                if (connect !== 'Yes') {return;}
                
                const connected = await connectionManager.connect();
                if (!connected) {return;}
            }

            try {
                const query = editor.document.getText();
                const results = await connectionManager.executeQuery(query);
                
                const panel = vscode.window.createWebviewPanel(
                    'queryResults',
                    'Query Results',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );

                panel.webview.html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Query Results</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            table { border-collapse: collapse; width: 100%; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                        </style>
                    </head>
                    <body>
                        <h2>Query Results</h2>
                        <p>${results.length} rows returned</p>
                        ${results.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>${Object.keys(results[0]).map(key => `<th>${key}</th>`).join('')}</tr>
                                </thead>
                                <tbody>
                                    ${results.map(row => `
                                        <tr>${Object.values(row).map(val => `<td>${val}</td>`).join('')}</tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No results</p>'}
                    </body>
                    </html>
                `;
            } catch (error: any) {
                vscode.window.showErrorMessage(`Query error: ${error.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pgdesktop.newQuery', async () => {
            const document = await vscode.workspace.openTextDocument({
                language: 'sql',
                content: '-- PostgreSQL Query\n-- Use @psql: Execute Query to run\n\nSELECT version();\n'
            });
            await vscode.window.showTextDocument(document);
        })
    );

    // Register listeners for SQL document events
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'sql') {
                // Optionally validate SQL when saved
            }
        })
    );
    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = "$(database) PostgreSQL";
    statusBarItem.tooltip = "PostgreSQL Desktop Manager";
    statusBarItem.command = "pgdesktop.connect";
    statusBarItem.show();
    
    context.subscriptions.push(statusBarItem);
}

/**
 * Deactivates the extension
 */
export function deactivate() {
    console.log('PostgreSQL Desktop Manager extension is now deactivated.');
}
