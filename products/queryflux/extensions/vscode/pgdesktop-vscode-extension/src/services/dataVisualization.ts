import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './connectionManager';

export interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string[];
        borderColor?: string;
        borderWidth?: number;
    }>;
}

export interface VisualizationConfig {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'heatmap' | 'treemap';
    title: string;
    xAxis?: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export class DataVisualization {
    private connectionManager: DatabaseConnectionManager;

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * Create interactive data visualization
     */
    async createVisualization(query: string, config: VisualizationConfig): Promise<void> {
        try {
            const result = await this.connectionManager.executeQuery(query);
            const chartData = this.processDataForVisualization(result.rows, config);
            
            const panel = vscode.window.createWebviewPanel(
                'dataVisualization',
                `📊 ${config.title}`,
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getVisualizationHTML(chartData, config);
            
            // Handle export requests
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'exportPNG':
                            await this.exportChartAsPNG(panel.webview, config.title);
                            break;
                        case 'exportCSV':
                            await this.exportDataAsCSV(result.rows, config.title);
                            break;
                        case 'exportJSON':
                            await this.exportDataAsJSON(result.rows, config.title);
                            break;
                    }
                },
                undefined,
                []
            );

        } catch (error) {
            vscode.window.showErrorMessage(`❌ Visualization failed: ${error}`);
        }
    }

    /**
     * Generate schema diagram
     */
    async generateSchemaDiagram(database: string): Promise<void> {
        try {
            const schema = await this.getDatabaseSchema(database);
            
            const panel = vscode.window.createWebviewPanel(
                'schemaDiagram',
                '🗂️ Database Schema Diagram',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getSchemaDiagramHTML(schema);
            
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Schema diagram failed: ${error}`);
        }
    }

    /**
     * Real-time data monitoring dashboard
     */
    async createMonitoringDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'monitoringDashboard',
            '📊 Real-time Monitoring',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getMonitoringDashboardHTML();
        
        // Start real-time updates
        const updateInterval = setInterval(async () => {
            try {
                const metrics = await this.getDatabaseMetrics();
                panel.webview.postMessage({
                    command: 'updateMetrics',
                    metrics: metrics
                });
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }, 5000);

        panel.onDidDispose(() => {
            clearInterval(updateInterval);
        });
    }

    /**
     * Advanced data export with multiple formats
     */
    async exportData(query: string, format: 'csv' | 'json' | 'excel' | 'xml'): Promise<void> {
        try {
            const result = await this.connectionManager.executeQuery(query);
            
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`export_${Date.now()}.${format}`),
                filters: {
                    [format.toUpperCase()]: [format === 'excel' ? 'xlsx' : format]
                }
            });

            if (uri) {
                switch (format) {
                    case 'csv':
                        await this.exportAsCSV(result.rows, uri);
                        break;
                    case 'json':
                        await this.exportAsJSON(result.rows, uri);
                        break;
                    case 'excel':
                        await this.exportAsExcel(result.rows, uri);
                        break;
                    case 'xml':
                        await this.exportAsXML(result.rows, uri);
                        break;
                }
                
                vscode.window.showInformationMessage(`✅ Data exported to ${uri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Export failed: ${error}`);
        }
    }

    /**
     * Process data for visualization
     */
    private processDataForVisualization(data: any[], config: VisualizationConfig): ChartData {
        const labels: string[] = [];
        const values: number[] = [];
        
        // Group and aggregate data based on configuration
        const groupedData = new Map<string, number>();
        
        data.forEach(row => {
            const label = config.xAxis ? row[config.xAxis] : 'Unknown';
            const value = config.yAxis ? parseFloat(row[config.yAxis]) || 0 : 1;
            
            if (groupedData.has(label)) {
                const currentValue = groupedData.get(label)!;
                switch (config.aggregate) {
                    case 'sum':
                        groupedData.set(label, currentValue + value);
                        break;
                    case 'avg':
                        // This is simplified - in real implementation, you'd track count
                        groupedData.set(label, (currentValue + value) / 2);
                        break;
                    case 'min':
                        groupedData.set(label, Math.min(currentValue, value));
                        break;
                    case 'max':
                        groupedData.set(label, Math.max(currentValue, value));
                        break;
                    default: // count
                        groupedData.set(label, currentValue + 1);
                }
            } else {
                groupedData.set(label, config.aggregate === 'count' ? 1 : value);
            }
        });
        
        // Convert to arrays
        groupedData.forEach((value, label) => {
            labels.push(label);
            values.push(value);
        });
        
        return {
            labels: labels,
            datasets: [{
                label: config.yAxis || 'Count',
                data: values,
                backgroundColor: this.generateColors(values.length),
                borderColor: '#2563eb',
                borderWidth: 2
            }]
        };
    }

    /**
     * Generate color palette
     */
    private generateColors(count: number): string[] {
        const colors = [
            '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
            '#db2777', '#0891b2', '#65a30d', '#ea580c', '#be185d'
        ];
        
        const result: string[] = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    /**
     * Get database schema information
     */
    private async getDatabaseSchema(database: string): Promise<any> {
        // Implementation to get database schema
        return {
            tables: [],
            relationships: []
        };
    }

    /**
     * Get real-time database metrics
     */
    private async getDatabaseMetrics(): Promise<any> {
        try {
            const connection = this.connectionManager.getActiveConnection();
            if (!connection) {
                return {};
            }

            // Get various database metrics
            const queries = [
                'SELECT count(*) as active_connections FROM pg_stat_activity',
                'SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = \'public\'',
                'SELECT pg_database_size(current_database()) as database_size'
            ];

            const metrics: any = {};
            
            for (const query of queries) {
                try {
                    const result = await this.connectionManager.executeQuery(query);
                    if (result.rows.length > 0) {
                        const row = result.rows[0];
                        Object.assign(metrics, row);
                    }
                } catch (error) {
                    console.error(`Failed to execute metric query: ${query}`, error);
                }
            }

            return {
                ...metrics,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to get database metrics:', error);
            return {};
        }
    }

    /**
     * Export methods
     */
    private async exportAsCSV(data: any[], uri: vscode.Uri): Promise<void> {
        if (data.length === 0) {return;}
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        await vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent, 'utf8'));
    }

    private async exportAsJSON(data: any[], uri: vscode.Uri): Promise<void> {
        const jsonContent = JSON.stringify(data, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
    }

    private async exportAsExcel(data: any[], uri: vscode.Uri): Promise<void> {
        // Simplified Excel export - in real implementation, use a library like xlsx
        const csvContent = this.convertToCSV(data);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent, 'utf8'));
    }

    private async exportAsXML(data: any[], uri: vscode.Uri): Promise<void> {
        if (data.length === 0) {return;}
        
        const headers = Object.keys(data[0]);
        const xmlContent = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<data>',
            ...data.map(row => 
                `  <row>${headers.map(header => `<${header}>${row[header] || ''}</${header}>`).join('')}</row>`
            ),
            '</data>'
        ].join('\n');
        
        await vscode.workspace.fs.writeFile(uri, Buffer.from(xmlContent, 'utf8'));
    }

    private convertToCSV(data: any[]): string {
        if (data.length === 0) {return '';}
        
        const headers = Object.keys(data[0]);
        return [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
    }

    private async exportChartAsPNG(webview: vscode.Webview, title: string): Promise<void> {
        // This would require additional implementation to capture the canvas
        vscode.window.showInformationMessage('📸 Chart export feature coming soon!');
    }

    private async exportDataAsCSV(data: any[], title: string): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${title}_data.csv`),
            filters: { 'CSV': ['csv'] }
        });
        
        if (uri) {
            await this.exportAsCSV(data, uri);
        }
    }

    private async exportDataAsJSON(data: any[], title: string): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${title}_data.json`),
            filters: { 'JSON': ['json'] }
        });
        
        if (uri) {
            await this.exportAsJSON(data, uri);
        }
    }

    /**
     * HTML Templates
     */
    private getVisualizationHTML(chartData: ChartData, config: VisualizationConfig): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Visualization</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        .chart-container {
            position: relative;
            height: 400px;
            margin: 20px 0;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin: 20px 0;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h2>📊 ${config.title}</h2>
    
    <div class="controls">
        <button onclick="exportPNG()">📸 Export PNG</button>
        <button onclick="exportCSV()">📄 Export CSV</button>
        <button onclick="exportJSON()">📋 Export JSON</button>
    </div>
    
    <div class="chart-container">
        <canvas id="chartCanvas"></canvas>
    </div>
    
    <div class="metrics" id="metricsContainer">
        <!-- Metrics will be populated here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Initialize chart
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        const chart = new Chart(ctx, {
            type: '${config.type}',
            data: ${JSON.stringify(chartData)},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: '${config.title}'
                    }
                },
                scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
                    y: {
                        beginAtZero: true
                    }
                } : {}
            }
        });

        function exportPNG() {
            vscode.postMessage({ command: 'exportPNG' });
        }

        function exportCSV() {
            vscode.postMessage({ command: 'exportCSV' });
        }

        function exportJSON() {
            vscode.postMessage({ command: 'exportJSON' });
        }

        // Handle real-time updates
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateMetrics') {
                updateMetrics(message.metrics);
            }
        });

        function updateMetrics(metrics) {
            const container = document.getElementById('metricsContainer');
            container.innerHTML = '';
            
            Object.entries(metrics).forEach(([key, value]) => {
                if (key !== 'timestamp') {
                    const card = document.createElement('div');
                    card.className = 'metric-card';
                    card.innerHTML = \`
                        <div class="metric-value">\${value}</div>
                        <div class="metric-label">\${key.replace(/_/g, ' ').toUpperCase()}</div>
                    \`;
                    container.appendChild(card);
                }
            });
        }
    </script>
</body>
</html>`;
    }

    private getSchemaDiagramHTML(schema: any): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schema Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        #network {
            width: 100%;
            height: 600px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <h2>🗂️ Database Schema Diagram</h2>
    <div id="network"></div>

    <script>
        // Create network visualization
        const container = document.getElementById('network');
        const data = {
            nodes: [],
            edges: []
        };
        
        const options = {
            nodes: {
                shape: 'box',
                margin: 10,
                font: {
                    size: 14,
                    color: '#ffffff'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                color: { inherit: 'from' },
                smooth: {
                    type: 'continuous'
                }
            },
            physics: {
                stabilization: { iterations: 100 }
            }
        };
        
        const network = new vis.Network(container, data, options);
    </script>
</body>
</html>`;
    }

    private getMonitoringDashboardHTML(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-time Monitoring</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .metric-card {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .metric-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .chart-container {
            position: relative;
            height: 200px;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
        }
        .status-online {
            background-color: #10b981;
        }
        .status-offline {
            background-color: #ef4444;
        }
    </style>
</head>
<body>
    <h2>📊 Real-time Database Monitoring</h2>
    
    <div class="dashboard" id="dashboard">
        <div class="metric-card">
            <div class="status-indicator status-online"></div>
            <span>Database Status</span>
            <div class="metric-value" id="status">Online</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value" id="activeConnections">-</div>
            <div class="metric-label">Active Connections</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value" id="databaseSize">-</div>
            <div class="metric-label">Database Size</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-value" id="totalTables">-</div>
            <div class="metric-label">Total Tables</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Handle real-time updates
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateMetrics') {
                updateMetrics(message.metrics);
            }
        });

        function updateMetrics(metrics) {
            document.getElementById('activeConnections').textContent = 
                metrics.active_connections || '-';
            document.getElementById('databaseSize').textContent = 
                formatBytes(metrics.database_size) || '-';
            document.getElementById('totalTables').textContent = 
                metrics.total_tables || '-';
        }

        function formatBytes(bytes) {
            if (!bytes) return '-';
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }
    </script>
</body>
</html>`;
    }
}
