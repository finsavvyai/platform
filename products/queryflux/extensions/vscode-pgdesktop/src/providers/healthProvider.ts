import * as vscode from 'vscode';
import { ExtensionContext, DatabaseConnection } from '../ultimateExtension';

interface HealthMetric {
    id: string;
    name: string;
    value: string | number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    description?: string;
    trend?: 'up' | 'down' | 'stable';
}

interface ConnectionHealth {
    connection: DatabaseConnection;
    metrics: HealthMetric[];
    overallStatus: 'excellent' | 'good' | 'warning' | 'critical' | 'disconnected';
    lastCheck: Date;
}

class HealthMetricItem extends vscode.TreeItem {
    constructor(public readonly metric: HealthMetric) {
        super(`${metric.name}: ${metric.value}`, vscode.TreeItemCollapsibleState.None);

        this.description = this.getStatusDescription(metric.status);
        this.contextValue = 'healthMetric';

        // Apple-inspired status icons and colors
        this.iconPath = new vscode.ThemeIcon(
            this.getStatusIcon(metric.status),
            this.getStatusColor(metric.status)
        );

        // Rich tooltip with metric details
        this.tooltip = new vscode.MarkdownString(this.createMetricTooltip(metric));
    }

    private getStatusDescription(status: string): string {
        const statusEmoji = {
            'excellent': '🟢 Excellent',
            'good': '🟡 Good',
            'warning': '🟠 Warning',
            'critical': '🔴 Critical'
        };
        return statusEmoji[status as keyof typeof statusEmoji] || '⚪ Unknown';
    }

    private getStatusIcon(status: string): string {
        const icons = {
            'excellent': 'check-all',
            'good': 'check',
            'warning': 'warning',
            'critical': 'error'
        };
        return icons[status as keyof typeof icons] || 'circle-outline';
    }

    private getStatusColor(status: string): vscode.ThemeColor {
        const colors = {
            'excellent': new vscode.ThemeColor('charts.green'),
            'good': new vscode.ThemeColor('charts.blue'),
            'warning': new vscode.ThemeColor('charts.yellow'),
            'critical': new vscode.ThemeColor('charts.red')
        };
        return colors[status as keyof typeof colors] || new vscode.ThemeColor('icon.foreground');
    }

    private createMetricTooltip(metric: HealthMetric): string {
        const trendIcon = metric.trend === 'up' ? '📈' : metric.trend === 'down' ? '📉' : '➡️';
        return `### ${metric.name}

**Current Value:** ${metric.value}
**Status:** ${this.getStatusDescription(metric.status)}
${metric.trend ? `**Trend:** ${trendIcon} ${metric.trend}` : ''}

${metric.description || 'No additional details available.'}`;
    }
}

class ConnectionHealthItem extends vscode.TreeItem {
    constructor(public readonly healthData: ConnectionHealth) {
        super(healthData.connection.name, vscode.TreeItemCollapsibleState.Expanded);

        this.description = this.getOverallStatusDescription(healthData.overallStatus);
        this.contextValue = 'connectionHealth';

        // Main connection health icon
        this.iconPath = new vscode.ThemeIcon(
            this.getOverallStatusIcon(healthData.overallStatus),
            this.getOverallStatusColor(healthData.overallStatus)
        );

        // Comprehensive health tooltip
        this.tooltip = new vscode.MarkdownString(this.createHealthTooltip(healthData));
    }

    private getOverallStatusDescription(status: string): string {
        const statusMap = {
            'excellent': '🟢 Excellent Performance',
            'good': '🟡 Good Performance',
            'warning': '🟠 Needs Attention',
            'critical': '🔴 Critical Issues',
            'disconnected': '⚪ Disconnected'
        };
        return statusMap[status as keyof typeof statusMap] || '⚪ Unknown';
    }

    private getOverallStatusIcon(status: string): string {
        const icons = {
            'excellent': 'heart-filled',
            'good': 'heart',
            'warning': 'warning',
            'critical': 'error',
            'disconnected': 'circle-outline'
        };
        return icons[status as keyof typeof icons] || 'circle-outline';
    }

    private getOverallStatusColor(status: string): vscode.ThemeColor {
        const colors = {
            'excellent': new vscode.ThemeColor('charts.green'),
            'good': new vscode.ThemeColor('charts.blue'),
            'warning': new vscode.ThemeColor('charts.yellow'),
            'critical': new vscode.ThemeColor('charts.red'),
            'disconnected': new vscode.ThemeColor('icon.foreground')
        };
        return colors[status as keyof typeof colors] || new vscode.ThemeColor('icon.foreground');
    }

    private createHealthTooltip(health: ConnectionHealth): string {
        const metricsCount = health.metrics.length;
        const excellentCount = health.metrics.filter(m => m.status === 'excellent').length;
        const warningCount = health.metrics.filter(m => m.status === 'warning').length;
        const criticalCount = health.metrics.filter(m => m.status === 'critical').length;

        return `### ${health.connection.name} Health Overview

**Overall Status:** ${this.getOverallStatusDescription(health.overallStatus)}
**Last Check:** ${health.lastCheck.toLocaleString()}

**Metrics Summary:**
- 🟢 Excellent: ${excellentCount}
- 🟡 Good: ${metricsCount - excellentCount - warningCount - criticalCount}
- 🟠 Warning: ${warningCount}
- 🔴 Critical: ${criticalCount}

**Database:** ${health.connection.type} @ ${health.connection.host}:${health.connection.port}`;
    }
}

export class UltimateHealthProvider implements vscode.TreeDataProvider<ConnectionHealthItem | HealthMetricItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionHealthItem | HealthMetricItem | undefined | null | void> =
        new vscode.EventEmitter<ConnectionHealthItem | HealthMetricItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionHealthItem | HealthMetricItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private healthData: Map<string, ConnectionHealth> = new Map();

    constructor(private context: ExtensionContext) {
        // Start health monitoring
        this.startHealthMonitoring();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(element: ConnectionHealthItem | HealthMetricItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConnectionHealthItem | HealthMetricItem): Promise<(ConnectionHealthItem | HealthMetricItem)[]> {
        if (!element) {
            // Root level - show all connection health summaries
            const connections = this.context.connectionManager.getAllConnections();
            const healthItems: ConnectionHealthItem[] = [];

            for (const connection of connections) {
                const health = this.healthData.get(connection.id) || this.createDefaultHealth(connection);
                healthItems.push(new ConnectionHealthItem(health));
            }

            return healthItems.sort((a, b) => {
                // Sort by status priority (critical first, then warning, etc.)
                const statusPriority = { 'critical': 0, 'warning': 1, 'good': 2, 'excellent': 3, 'disconnected': 4 };
                const aPriority = statusPriority[a.healthData.overallStatus as keyof typeof statusPriority] ?? 5;
                const bPriority = statusPriority[b.healthData.overallStatus as keyof typeof statusPriority] ?? 5;
                return aPriority - bPriority;
            });
        } else if (element instanceof ConnectionHealthItem) {
            // Show health metrics for this connection
            return element.healthData.metrics.map(metric => new HealthMetricItem(metric));
        }

        return [];
    }

    private createDefaultHealth(connection: DatabaseConnection): ConnectionHealth {
        const defaultMetrics: HealthMetric[] = [
            {
                id: 'connection',
                name: 'Connection',
                value: connection.status === 'connected' ? 'Active' : 'Inactive',
                status: connection.status === 'connected' ? 'excellent' : 'critical',
                description: 'Database connection status'
            },
            {
                id: 'responseTime',
                name: 'Response Time',
                value: 'Unknown',
                status: 'warning',
                description: 'Average query response time'
            },
            {
                id: 'uptime',
                name: 'Uptime',
                value: 'Unknown',
                status: 'good',
                description: 'Database server uptime'
            }
        ];

        const overallStatus = connection.status === 'connected' ? 'good' : 'disconnected';

        return {
            connection,
            metrics: defaultMetrics,
            overallStatus,
            lastCheck: new Date()
        };
    }

    private startHealthMonitoring(): void {
        // Simulate health monitoring with mock data
        setInterval(() => {
            this.updateHealthData();
        }, 30000); // Update every 30 seconds

        // Initial update
        this.updateHealthData();
    }

    private updateHealthData(): void {
        const connections = this.context.connectionManager.getAllConnections();

        for (const connection of connections) {
            if (connection.status === 'connected') {
                // Simulate real health metrics
                const metrics: HealthMetric[] = [
                    {
                        id: 'connection',
                        name: 'Connection',
                        value: 'Active',
                        status: 'excellent',
                        description: 'Database connection is healthy and responsive',
                        trend: 'stable'
                    },
                    {
                        id: 'responseTime',
                        name: 'Avg Response Time',
                        value: `${Math.floor(Math.random() * 50 + 10)}ms`,
                        status: Math.random() > 0.7 ? 'excellent' : 'good',
                        description: 'Average query response time over the last 5 minutes',
                        trend: Math.random() > 0.5 ? 'stable' : 'up'
                    },
                    {
                        id: 'activeConnections',
                        name: 'Active Connections',
                        value: Math.floor(Math.random() * 20 + 5),
                        status: 'good',
                        description: 'Number of active database connections'
                    },
                    {
                        id: 'queryLoad',
                        name: 'Query Load',
                        value: `${Math.floor(Math.random() * 30 + 10)}%`,
                        status: Math.random() > 0.8 ? 'warning' : 'good',
                        description: 'Current query processing load'
                    }
                ];

                const overallStatus = this.calculateOverallStatus(metrics);

                this.healthData.set(connection.id, {
                    connection,
                    metrics,
                    overallStatus,
                    lastCheck: new Date()
                });
            } else {
                this.healthData.set(connection.id, this.createDefaultHealth(connection));
            }
        }

        this.refresh();
    }

    private calculateOverallStatus(metrics: HealthMetric[]): 'excellent' | 'good' | 'warning' | 'critical' {
        const criticalCount = metrics.filter(m => m.status === 'critical').length;
        const warningCount = metrics.filter(m => m.status === 'warning').length;
        const excellentCount = metrics.filter(m => m.status === 'excellent').length;

        if (criticalCount > 0) {return 'critical';}
        if (warningCount > 1) {return 'warning';}
        if (warningCount === 1) {return 'good';}
        if (excellentCount === metrics.length) {return 'excellent';}
        return 'good';
    }
}
