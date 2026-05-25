import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './connectionManager';

export interface DatabaseMetrics {
    connectionId: string;
    timestamp: Date;
    activeConnections: number;
    totalConnections: number;
    queryCount: number;
    slowQueries: number;
    databaseSize: number;
    cacheHitRatio: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
    locks: number;
    deadlocks: number;
    replicationLag?: number;
    backupStatus?: string;
    lastBackup?: Date;
}

export interface AlertRule {
    id: string;
    name: string;
    metric: keyof DatabaseMetrics;
    operator: '>' | '<' | '=' | '>=' | '<=' | '!=' | 'contains';
    threshold: number | string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    enabled: boolean;
    cooldown: number; // minutes
    lastTriggered?: Date;
}

export interface Alert {
    id: string;
    ruleId: string;
    connectionId: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: Date;
    acknowledged: boolean;
    resolved: boolean;
}

export class RealTimeMonitor {
    private connectionManager: DatabaseConnectionManager;
    private metrics: Map<string, DatabaseMetrics[]> = new Map();
    private alerts: Alert[] = [];
    private alertRules: AlertRule[] = [];
    private monitoringInterval: NodeJS.Timeout | null = null;
    private statusBarItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private isMonitoring: boolean = false;

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.outputChannel = vscode.window.createOutputChannel('Database Monitor');
        this.loadAlertRules();
        this.setupStatusBar();
    }

    /**
     * Start real-time monitoring
     */
    startMonitoring(intervalMs: number = 30000): void {
        if (this.isMonitoring) {
            vscode.window.showWarningMessage('Monitoring is already running');
            return;
        }

        this.isMonitoring = true;
        this.statusBarItem.text = '$(pulse) Monitoring';
        this.statusBarItem.show();

        this.monitoringInterval = setInterval(async () => {
            await this.collectMetrics();
            this.checkAlerts();
            this.updateStatusBar();
        }, intervalMs);

        vscode.window.showInformationMessage('🔍 Real-time monitoring started');
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Monitoring started`);
    }

    /**
     * Stop real-time monitoring
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        this.statusBarItem.text = '$(circle-slash) Monitor';
        this.statusBarItem.hide();

        vscode.window.showInformationMessage('⏹️ Real-time monitoring stopped');
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Monitoring stopped`);
    }

    /**
     * Collect metrics from all active connections
     */
    private async collectMetrics(): Promise<void> {
        const activeConnections = this.connectionManager.getActiveConnections();
        
        for (const connection of activeConnections) {
            try {
                const metrics = await this.getConnectionMetrics(connection.id);
                this.storeMetrics(connection.id, metrics);
            } catch (error) {
                this.outputChannel.appendLine(`[${new Date().toISOString()}] Failed to collect metrics for ${connection.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * Get metrics for a specific connection
     */
    private async getConnectionMetrics(connectionId: string): Promise<DatabaseMetrics> {
        const connection = this.connectionManager.getConnection(connectionId);
        if (!connection) {
            throw new Error('Connection not found');
        }

        const timestamp = new Date();
        let metrics: Partial<DatabaseMetrics> = {
            connectionId,
            timestamp
        };

        try {
            switch (connection.type) {
                case 'PostgreSQL':
                    metrics = await this.getPostgreSQLMetrics(connectionId);
                    break;
                // MySQL not currently supported in configuration
                // case 'MySQL':
                //     metrics = await this.getMySQLMetrics(connectionId);
                //     break;
                case 'MongoDB':
                    metrics = await this.getMongoDBMetrics(connectionId);
                    break;
                case 'Redis':
                    metrics = await this.getRedisMetrics(connectionId);
                    break;
                default:
                    metrics = await this.getGenericMetrics(connectionId);
            }
        } catch (error) {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] Error collecting metrics: ${error instanceof Error ? error.message : String(error)}`);
        }

        return metrics as DatabaseMetrics;
    }

    /**
     * Get PostgreSQL specific metrics
     */
    private async getPostgreSQLMetrics(connectionId: string): Promise<Partial<DatabaseMetrics>> {
        const queries = [
            'SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'',
            'SELECT count(*) as total_connections FROM pg_stat_activity',
            'SELECT count(*) as query_count FROM pg_stat_statements',
            'SELECT count(*) as slow_queries FROM pg_stat_statements WHERE mean_time > 1000',
            'SELECT pg_database_size(current_database()) as database_size',
            'SELECT round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as cache_hit_ratio FROM pg_stat_database',
            'SELECT count(*) as locks FROM pg_locks WHERE NOT granted',
            'SELECT count(*) as deadlocks FROM pg_stat_database WHERE deadlocks > 0'
        ];

        const results: any = {};
        
        for (const query of queries) {
            try {
                // Set connection and execute query
                await this.connectionManager.connect(connectionId);
                const result = await this.connectionManager.executeQuery(query);
                if (result.rows && result.rows.length > 0) {
                    const key = Object.keys(result.rows[0])[0];
                    results[key] = result.rows[0][key];
                }
            } catch (error) {
                // Continue with other queries if one fails
            }
        }

        return {
            activeConnections: results.active_connections || 0,
            totalConnections: results.total_connections || 0,
            queryCount: results.query_count || 0,
            slowQueries: results.slow_queries || 0,
            databaseSize: results.database_size || 0,
            cacheHitRatio: results.cache_hit_ratio || 0,
            locks: results.locks || 0,
            deadlocks: results.deadlocks || 0,
            cpuUsage: 0, // Would need system-level monitoring
            memoryUsage: 0, // Would need system-level monitoring
            diskUsage: 0, // Would need system-level monitoring
            uptime: 0 // Would need to track from start
        };
    }

    /**
     * Get MySQL specific metrics
     */
    private async getMySQLMetrics(connectionId: string): Promise<Partial<DatabaseMetrics>> {
        const queries = [
            'SHOW STATUS LIKE \'Threads_connected\'',
            'SHOW STATUS LIKE \'Threads_running\'',
            'SHOW STATUS LIKE \'Questions\'',
            'SHOW STATUS LIKE \'Slow_queries\'',
            'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS database_size FROM information_schema.tables WHERE table_schema = DATABASE()',
            'SHOW STATUS LIKE \'Qcache_hits\'',
            'SHOW STATUS LIKE \'Table_locks_waited\'',
            'SHOW STATUS LIKE \'Innodb_deadlocks\''
        ];

        const results: any = {};
        
        for (const query of queries) {
            try {
                // Set connection and execute query
                await this.connectionManager.connect(connectionId);
                const result = await this.connectionManager.executeQuery(query);
                if (result.rows && result.rows.length > 0) {
                    const row = result.rows[0];
                    if (row.Variable_name && row.Value) {
                        results[row.Variable_name] = parseInt(row.Value) || 0;
                    }
                }
            } catch (error) {
                // Continue with other queries if one fails
            }
        }

        return {
            activeConnections: results.Threads_running || 0,
            totalConnections: results.Threads_connected || 0,
            queryCount: results.Questions || 0,
            slowQueries: results.Slow_queries || 0,
            databaseSize: (results.database_size || 0) * 1024 * 1024, // Convert to bytes
            cacheHitRatio: 0, // Would need more complex calculation
            locks: results.Table_locks_waited || 0,
            deadlocks: results.Innodb_deadlocks || 0,
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            uptime: 0
        };
    }

    /**
     * Get MongoDB specific metrics
     */
    private async getMongoDBMetrics(connectionId: string): Promise<Partial<DatabaseMetrics>> {
        try {
            await this.connectionManager.connect(connectionId);
            const result = await this.connectionManager.executeQuery('db.serverStatus()');
            const status = result.rows[0];

            return {
                activeConnections: status.connections?.current || 0,
                totalConnections: status.connections?.totalCreated || 0,
                queryCount: status.opcounters?.query || 0,
                slowQueries: 0, // Would need to query slow query log
                databaseSize: 0, // Would need to calculate from collections
                cacheHitRatio: 0, // MongoDB doesn't have traditional cache hit ratio
                locks: status.globalLock?.activeClients?.total || 0,
                deadlocks: 0, // MongoDB doesn't have traditional deadlocks
                cpuUsage: 0,
                memoryUsage: status.mem?.resident || 0,
                diskUsage: 0,
                uptime: status.uptime || 0
            };
        } catch (error) {
            return this.getGenericMetrics(connectionId);
        }
    }

    /**
     * Get Redis specific metrics
     */
    private async getRedisMetrics(connectionId: string): Promise<Partial<DatabaseMetrics>> {
        try {
            await this.connectionManager.connect(connectionId);
            const result = await this.connectionManager.executeQuery('INFO server');
            const info = result.rows[0]?.value || '';

            const metrics: any = {};
            info.split('\n').forEach((line: string) => {
                const [key, value] = line.split(':');
                if (key && value) {
                    metrics[key.trim()] = value.trim();
                }
            });

            return {
                activeConnections: parseInt(metrics.connected_clients) || 0,
                totalConnections: parseInt(metrics.total_connections_received) || 0,
                queryCount: parseInt(metrics.total_commands_processed) || 0,
                slowQueries: 0, // Would need to check slow log
                databaseSize: parseInt(metrics.used_memory) || 0,
                cacheHitRatio: 0, // Would need to calculate from keyspace hits/misses
                locks: 0, // Redis is single-threaded
                deadlocks: 0, // Redis doesn't have deadlocks
                cpuUsage: 0,
                memoryUsage: parseInt(metrics.used_memory) || 0,
                diskUsage: 0,
                uptime: parseInt(metrics.uptime_in_seconds) || 0
            };
        } catch (error) {
            return this.getGenericMetrics(connectionId);
        }
    }

    /**
     * Get generic metrics for unsupported databases
     */
    private async getGenericMetrics(connectionId: string): Promise<Partial<DatabaseMetrics>> {
        return {
            activeConnections: 0,
            totalConnections: 0,
            queryCount: 0,
            slowQueries: 0,
            databaseSize: 0,
            cacheHitRatio: 0,
            locks: 0,
            deadlocks: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            uptime: 0
        };
    }

    /**
     * Store metrics with retention policy
     */
    private storeMetrics(connectionId: string, metrics: DatabaseMetrics): void {
        if (!this.metrics.has(connectionId)) {
            this.metrics.set(connectionId, []);
        }

        const connectionMetrics = this.metrics.get(connectionId)!;
        connectionMetrics.push(metrics);

        // Keep only last 1000 metrics per connection (about 8 hours at 30s intervals)
        if (connectionMetrics.length > 1000) {
            connectionMetrics.splice(0, connectionMetrics.length - 1000);
        }
    }

    /**
     * Check alert rules and trigger alerts
     */
    private checkAlerts(): void {
        const activeConnections = this.connectionManager.getActiveConnections();
        
        for (const connection of activeConnections) {
            const latestMetrics = this.getLatestMetrics(connection.id);
            if (!latestMetrics) {continue;}

            for (const rule of this.alertRules) {
                if (!rule.enabled) {continue;}

                // Check cooldown
                if (rule.lastTriggered) {
                    const cooldownMs = rule.cooldown * 60 * 1000;
                    if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
                        continue;
                    }
                }

                const value = latestMetrics[rule.metric];
                if (this.evaluateAlertRule(rule, value)) {
                    this.triggerAlert(rule, connection.id, value);
                    rule.lastTriggered = new Date();
                }
            }
        }
    }

    /**
     * Evaluate alert rule
     */
    private evaluateAlertRule(rule: AlertRule, value: any): boolean {
        if (value === undefined || value === null) {return false;}

        switch (rule.operator) {
            case '>':
                return Number(value) > Number(rule.threshold);
            case '<':
                return Number(value) < Number(rule.threshold);
            case '=':
                return value === rule.threshold;
            case '>=':
                return Number(value) >= Number(rule.threshold);
            case '<=':
                return Number(value) <= Number(rule.threshold);
            case '!=':
                return value !== rule.threshold;
            case 'contains':
                return String(value).includes(String(rule.threshold));
            default:
                return false;
        }
    }

    /**
     * Trigger an alert
     */
    private triggerAlert(rule: AlertRule, connectionId: string, value: any): void {
        const alert: Alert = {
            id: Date.now().toString(),
            ruleId: rule.id,
            connectionId,
            message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
            severity: rule.severity,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false
        };

        this.alerts.push(alert);
        this.showAlert(alert);
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ALERT: ${alert.message}`);
    }

    /**
     * Show alert to user
     */
    private showAlert(alert: Alert): void {
        const severityMap = {
            info: vscode.window.showInformationMessage,
            warning: vscode.window.showWarningMessage,
            error: vscode.window.showErrorMessage,
            critical: vscode.window.showErrorMessage
        };

        const showMessage = severityMap[alert.severity];
        showMessage(alert.message, 'Acknowledge', 'View Details').then(selection => {
            if (selection === 'Acknowledge') {
                this.acknowledgeAlert(alert.id);
            } else if (selection === 'View Details') {
                this.showAlertDetails(alert);
            }
        });
    }

    /**
     * Get latest metrics for a connection
     */
    private getLatestMetrics(connectionId: string): DatabaseMetrics | null {
        const connectionMetrics = this.metrics.get(connectionId);
        if (!connectionMetrics || connectionMetrics.length === 0) {
            return null;
        }
        return connectionMetrics[connectionMetrics.length - 1];
    }

    /**
     * Update status bar with current status
     */
    private updateStatusBar(): void {
        const activeConnections = this.connectionManager.getActiveConnections();
        const criticalAlerts = this.alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
        const errorAlerts = this.alerts.filter(a => a.severity === 'error' && !a.acknowledged);

        if (criticalAlerts.length > 0) {
            this.statusBarItem.text = `$(alert) ${criticalAlerts.length} Critical`;
            this.statusBarItem.color = 'red';
        } else if (errorAlerts.length > 0) {
            this.statusBarItem.text = `$(warning) ${errorAlerts.length} Errors`;
            this.statusBarItem.color = 'orange';
        } else {
            this.statusBarItem.text = `$(pulse) ${activeConnections.length} Active`;
            this.statusBarItem.color = 'green';
        }
    }

    /**
     * Setup status bar item
     */
    private setupStatusBar(): void {
        this.statusBarItem.command = 'ultimatedb.showMonitoringDashboard';
        this.statusBarItem.tooltip = 'Database Monitoring Status';
    }

    /**
     * Load alert rules from configuration
     */
    private loadAlertRules(): void {
        const config = vscode.workspace.getConfiguration('ultimatedb.monitoring');
        this.alertRules = config.get<AlertRule[]>('alertRules', [
            {
                id: 'high_connections',
                name: 'High Connection Count',
                metric: 'activeConnections',
                operator: '>',
                threshold: 50,
                severity: 'warning',
                enabled: true,
                cooldown: 5
            },
            {
                id: 'slow_queries',
                name: 'Slow Queries Detected',
                metric: 'slowQueries',
                operator: '>',
                threshold: 10,
                severity: 'warning',
                enabled: true,
                cooldown: 10
            },
            {
                id: 'low_cache_hit',
                name: 'Low Cache Hit Ratio',
                metric: 'cacheHitRatio',
                operator: '<',
                threshold: 80,
                severity: 'warning',
                enabled: true,
                cooldown: 15
            },
            {
                id: 'deadlocks',
                name: 'Database Deadlocks',
                metric: 'deadlocks',
                operator: '>',
                threshold: 0,
                severity: 'error',
                enabled: true,
                cooldown: 5
            }
        ]);
    }

    /**
     * Save alert rules to configuration
     */
    private saveAlertRules(): void {
        const config = vscode.workspace.getConfiguration('ultimatedb.monitoring');
        config.update('alertRules', this.alertRules, vscode.ConfigurationTarget.Global);
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            vscode.window.showInformationMessage('Alert acknowledged');
        }
    }

    /**
     * Show alert details
     */
    private showAlertDetails(alert: Alert): void {
        const panel = vscode.window.createWebviewPanel(
            'alertDetails',
            'Alert Details',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; }
                    .alert { border: 1px solid #ccc; padding: 15px; margin: 10px 0; border-radius: 5px; }
                    .critical { border-color: red; background-color: #ffe6e6; }
                    .error { border-color: orange; background-color: #fff3cd; }
                    .warning { border-color: yellow; background-color: #fffbf0; }
                    .info { border-color: blue; background-color: #e6f3ff; }
                </style>
            </head>
            <body>
                <h2>Alert Details</h2>
                <div class="alert ${alert.severity}">
                    <h3>${alert.message}</h3>
                    <p><strong>Severity:</strong> ${alert.severity}</p>
                    <p><strong>Time:</strong> ${alert.timestamp.toLocaleString()}</p>
                    <p><strong>Connection:</strong> ${alert.connectionId}</p>
                    <p><strong>Status:</strong> ${alert.acknowledged ? 'Acknowledged' : 'Active'}</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get monitoring dashboard data
     */
    getDashboardData(): {
        metrics: Map<string, DatabaseMetrics[]>;
        alerts: Alert[];
        alertRules: AlertRule[];
        isMonitoring: boolean;
    } {
        return {
            metrics: this.metrics,
            alerts: this.alerts,
            alertRules: this.alertRules,
            isMonitoring: this.isMonitoring
        };
    }

    /**
     * Clear old alerts
     */
    clearOldAlerts(olderThanHours: number = 24): void {
        const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoffTime);
    }

    /**
     * Export monitoring data
     */
    exportMonitoringData(format: 'json' | 'csv'): string {
        const data = {
            metrics: Array.from(this.metrics.entries()).map(([connectionId, metrics]) => ({
                connectionId,
                metrics: metrics.map(m => ({
                    ...m,
                    timestamp: m.timestamp.toISOString()
                }))
            })),
            alerts: this.alerts.map(alert => ({
                ...alert,
                timestamp: alert.timestamp.toISOString()
            })),
            alertRules: this.alertRules
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else {
            // Convert to CSV format
            const csvRows = ['Connection ID,Timestamp,Metric,Value'];
            for (const [connectionId, metrics] of this.metrics.entries()) {
                for (const metric of metrics) {
                    Object.entries(metric).forEach(([key, value]) => {
                        if (key !== 'connectionId' && key !== 'timestamp') {
                            csvRows.push(`${connectionId},${metric.timestamp.toISOString()},${key},${value}`);
                        }
                    });
                }
            }
            return csvRows.join('\n');
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stopMonitoring();
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
    }
}
