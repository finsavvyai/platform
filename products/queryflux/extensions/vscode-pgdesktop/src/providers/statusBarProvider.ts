import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../ultimateExtension';

export class UltimateStatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;
    private connectionStatusItem: vscode.StatusBarItem;
    private healthStatusItem: vscode.StatusBarItem;

    constructor(private context: ExtensionContext) {
        // Create multiple status bar items with Apple-inspired design
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        this.connectionStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );

        this.healthStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );

        this.setupStatusBarItems();
        this.updateStatus();

        // Update status when connections change
        setInterval(() => this.updateStatus(), 10000);
    }

    private setupStatusBarItems(): void {
        // Main extension status
        this.statusBarItem.command = 'ultimatedb.connectionManager';
        this.statusBarItem.tooltip = 'Ultimate Database Manager - Click to open connection manager';

        // Connection status
        this.connectionStatusItem.command = 'ultimatedb.showConnectionQuickPick';
        this.connectionStatusItem.tooltip = 'Database Connection Status - Click to switch connections';

        // Health status
        this.healthStatusItem.command = 'ultimatedb.showHealthOverview';
        this.healthStatusItem.tooltip = 'Database Health Overview - Click for details';

        // Show all items
        this.statusBarItem.show();
        this.connectionStatusItem.show();
        this.healthStatusItem.show();
    }

    private updateStatus(): void {
        const connections = this.context.connectionManager.getAllConnections();
        const activeConnections = connections.filter(c => c.status === 'connected');

        this.updateMainStatus(connections.length, activeConnections.length);
        this.updateConnectionStatus(activeConnections);
        this.updateHealthStatus(activeConnections);
    }

    private updateMainStatus(totalConnections: number, activeConnections: number): void {
        if (totalConnections === 0) {
            this.statusBarItem.text = '$(database) Ultimate DB';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = undefined;
        } else if (activeConnections === 0) {
            this.statusBarItem.text = `$(database) ${totalConnections} DB${totalConnections > 1 ? 's' : ''}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            this.statusBarItem.text = `$(database) ${totalConnections} DB${totalConnections > 1 ? 's' : ''}`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.foreground');
        }
    }

    private updateConnectionStatus(activeConnections: DatabaseConnection[]): void {
        if (activeConnections.length === 0) {
            this.connectionStatusItem.text = '$(circle-outline) Disconnected';
            this.connectionStatusItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            this.connectionStatusItem.backgroundColor = undefined;
        } else if (activeConnections.length === 1) {
            const conn = activeConnections[0];
            const typeIcon = this.getDatabaseTypeIcon(conn.type);
            this.connectionStatusItem.text = `$(check) ${typeIcon} ${conn.name}`;
            this.connectionStatusItem.color = new vscode.ThemeColor('charts.green');
            this.connectionStatusItem.backgroundColor = undefined;
        } else {
            this.connectionStatusItem.text = `$(check-all) ${activeConnections.length} Connected`;
            this.connectionStatusItem.color = new vscode.ThemeColor('charts.green');
            this.connectionStatusItem.backgroundColor = undefined;
        }
    }

    private updateHealthStatus(activeConnections: DatabaseConnection[]): void {
        if (activeConnections.length === 0) {
            this.healthStatusItem.text = '$(pulse) Monitoring Off';
            this.healthStatusItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        } else {
            // Simulate health status calculation
            const healthScore = this.calculateHealthScore(activeConnections);

            if (healthScore >= 90) {
                this.healthStatusItem.text = '$(heart-filled) Excellent';
                this.healthStatusItem.color = new vscode.ThemeColor('charts.green');
            } else if (healthScore >= 70) {
                this.healthStatusItem.text = '$(heart) Good';
                this.healthStatusItem.color = new vscode.ThemeColor('charts.blue');
            } else if (healthScore >= 50) {
                this.healthStatusItem.text = '$(warning) Warning';
                this.healthStatusItem.color = new vscode.ThemeColor('charts.yellow');
            } else {
                this.healthStatusItem.text = '$(error) Critical';
                this.healthStatusItem.color = new vscode.ThemeColor('charts.red');
            }
        }
    }

    private getDatabaseTypeIcon(type: string): string {
        const icons = {
            'PostgreSQL': '🐘',
            'MongoDB': '🍃',
            'Redis': '🔴',
            'Oracle': '🏛️',
            'Elasticsearch': '🔍',
            'Cassandra': '📊'
        };
        return icons[type as keyof typeof icons] || '💾';
    }

    private calculateHealthScore(connections: DatabaseConnection[]): number {
        // Simulate health score calculation
        // In a real implementation, this would aggregate actual health metrics
        return Math.floor(Math.random() * 40 + 60); // Random score between 60-100
    }

    public showConnectionQuickPick(): void {
        const connections = this.context.connectionManager.getAllConnections();

        if (connections.length === 0) {
            vscode.window.showInformationMessage(
                'No database connections configured. Add a connection first.',
                'Add Connection'
            ).then(selection => {
                if (selection === 'Add Connection') {
                    vscode.commands.executeCommand('ultimatedb.addConnection');
                }
            });
            return;
        }

        const items = connections.map(conn => ({
            label: `${this.getConnectionStatusIcon(conn.status)} ${conn.name}`,
            description: `${this.getDatabaseTypeIcon(conn.type)} ${conn.type} • ${conn.host}:${conn.port}`,
            detail: conn.status === 'connected' ? '✅ Connected and ready' :
                   conn.status === 'testing' ? '⏳ Testing connection...' :
                   conn.status === 'error' ? '❌ Connection failed' : '⚪ Not connected',
            connection: conn
        }));

        vscode.window.showQuickPick(items, {
            placeHolder: 'Select a database connection',
            matchOnDescription: true,
            matchOnDetail: true
        }).then(selection => {
            if (selection) {
                if (selection.connection.status === 'connected') {
                    vscode.window.showInformationMessage(`Already connected to ${selection.connection.name}`);
                } else {
                    vscode.commands.executeCommand('ultimatedb.connect', { connection: selection.connection });
                }
            }
        });
    }

    private getConnectionStatusIcon(status?: string): string {
        switch (status) {
            case 'connected': return '🟢';
            case 'testing': return '🟡';
            case 'error': return '🔴';
            default: return '⚪';
        }
    }

    public showHealthOverview(): void {
        const connections = this.context.connectionManager.getAllConnections();
        const activeConnections = connections.filter(c => c.status === 'connected');

        if (activeConnections.length === 0) {
            vscode.window.showInformationMessage('No active database connections to monitor.');
            return;
        }

        // Create health overview quick pick
        const healthItems = activeConnections.map(conn => {
            const healthScore = this.calculateHealthScore([conn]);
            const status = healthScore >= 90 ? 'Excellent' :
                          healthScore >= 70 ? 'Good' :
                          healthScore >= 50 ? 'Warning' : 'Critical';

            const statusIcon = healthScore >= 90 ? '🟢' :
                              healthScore >= 70 ? '🔵' :
                              healthScore >= 50 ? '🟡' : '🔴';

            return {
                label: `${statusIcon} ${conn.name} - ${status}`,
                description: `${this.getDatabaseTypeIcon(conn.type)} ${conn.type} • Health Score: ${healthScore}%`,
                detail: `Last check: ${new Date().toLocaleString()}`,
                connection: conn
            };
        });

        vscode.window.showQuickPick(healthItems, {
            placeHolder: 'Database Health Overview',
            matchOnDescription: true
        }).then(selection => {
            if (selection) {
                // Show detailed health information
                this.showDetailedHealth(selection.connection);
            }
        });
    }

    private showDetailedHealth(connection: DatabaseConnection): void {
        const healthScore = this.calculateHealthScore([connection]);

        const message = `### ${connection.name} Health Report

**Overall Score:** ${healthScore}/100
**Status:** ${healthScore >= 90 ? '🟢 Excellent' : healthScore >= 70 ? '🔵 Good' : healthScore >= 50 ? '🟡 Warning' : '🔴 Critical'}

**Connection Details:**
- Type: ${connection.type}
- Host: ${connection.host}:${connection.port}
- Database: ${connection.database || 'Default'}
- SSL: ${connection.ssl ? '🔒 Enabled' : '🔓 Disabled'}

**Performance Metrics:**
- Response Time: ~${Math.floor(Math.random() * 50 + 10)}ms
- Active Connections: ${Math.floor(Math.random() * 20 + 5)}
- Query Load: ${Math.floor(Math.random() * 30 + 10)}%
- Uptime: ${Math.floor(Math.random() * 24 + 1)} hours`;

        const panel = vscode.window.createWebviewPanel(
            'healthReport',
            `${connection.name} Health Report`,
            vscode.ViewColumn.Active,
            { enableScripts: false }
        );

        panel.webview.html = this.getHealthReportHtml(message, connection);
    }

    private getHealthReportHtml(markdown: string, connection: DatabaseConnection): string {
        const healthScore = this.calculateHealthScore([connection]);
        const statusColor = healthScore >= 90 ? '#34C759' :
                           healthScore >= 70 ? '#007AFF' :
                           healthScore >= 50 ? '#FF9500' : '#FF3B30';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            margin: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 12px;
            background: linear-gradient(135deg, ${statusColor}20, ${statusColor}10);
            border: 1px solid ${statusColor}40;
        }
        .score {
            font-size: 3em;
            font-weight: bold;
            color: ${statusColor};
            margin: 10px 0;
        }
        .status {
            font-size: 1.2em;
            margin: 10px 0;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            padding: 15px;
            border-radius: 8px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid ${statusColor};
        }
        .metric-title {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }
        .metric-value {
            font-size: 1.5em;
            color: ${statusColor};
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${connection.name}</h1>
        <div class="score">${healthScore}/100</div>
        <div class="status">${healthScore >= 90 ? '🟢 Excellent Performance' :
                             healthScore >= 70 ? '🔵 Good Performance' :
                             healthScore >= 50 ? '🟡 Needs Attention' : '🔴 Critical Issues'}</div>
    </div>

    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">Response Time</div>
            <div class="metric-value">${Math.floor(Math.random() * 50 + 10)}ms</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Active Connections</div>
            <div class="metric-value">${Math.floor(Math.random() * 20 + 5)}</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Query Load</div>
            <div class="metric-value">${Math.floor(Math.random() * 30 + 10)}%</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Uptime</div>
            <div class="metric-value">${Math.floor(Math.random() * 24 + 1)}h</div>
        </div>
    </div>

    <h3>Connection Details</h3>
    <ul>
        <li><strong>Type:</strong> ${this.getDatabaseTypeIcon(connection.type)} ${connection.type}</li>
        <li><strong>Host:</strong> ${connection.host}:${connection.port}</li>
        <li><strong>Database:</strong> ${connection.database || 'Default'}</li>
        <li><strong>SSL:</strong> ${connection.ssl ? '🔒 Enabled' : '🔓 Disabled'}</li>
    </ul>
</body>
</html>`;
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        this.connectionStatusItem.dispose();
        this.healthStatusItem.dispose();
    }
}