import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './connectionManager';

export interface QueryBuilderField {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    foreignKey?: {
        table: string;
        column: string;
    };
}

export interface QueryBuilderTable {
    name: string;
    schema: string;
    fields: QueryBuilderField[];
    indexes: string[];
    constraints: string[];
}

export interface QueryBuilderJoin {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    table: string;
    condition: string;
}

export interface QueryBuilderCondition {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';
    value: any;
    logicalOperator?: 'AND' | 'OR';
}

export interface QueryBuilderOrder {
    field: string;
    direction: 'ASC' | 'DESC';
}

export class AdvancedQueryBuilder {
    private connectionManager: DatabaseConnectionManager;
    private tables: Map<string, QueryBuilderTable> = new Map();
    private currentQuery: {
        select: string[];
        from: string;
        joins: QueryBuilderJoin[];
        where: QueryBuilderCondition[];
        groupBy: string[];
        having: QueryBuilderCondition[];
        orderBy: QueryBuilderOrder[];
        limit?: number;
        offset?: number;
    } = {
        select: [],
        from: '',
        joins: [],
        where: [],
        groupBy: [],
        having: [],
        orderBy: []
    };

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
    }

    /**
     * Load database schema for query building
     */
    async loadSchema(database: string): Promise<void> {
        try {
            const connection = this.connectionManager.getActiveConnection();
            if (!connection) {
                throw new Error('No active database connection');
            }

            // Load tables and their schemas
            const tables = await this.getTables(database);
            
            for (const table of tables) {
                const fields = await this.getTableFields(database, table.name);
                const indexes = await this.getTableIndexes(database, table.name);
                const constraints = await this.getTableConstraints(database, table.name);
                
                this.tables.set(table.name, {
                    name: table.name,
                    schema: table.schema,
                    fields,
                    indexes,
                    constraints
                });
            }

            vscode.window.showInformationMessage(`✅ Loaded schema for ${tables.length} tables`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to load schema: ${error}`);
        }
    }

    /**
     * Visual Query Builder Webview
     */
    async openVisualQueryBuilder(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'visualQueryBuilder',
            '🎨 Visual Query Builder',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getVisualQueryBuilderHTML();
        
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'loadTables':
                        const tables = Array.from(this.tables.values());
                        panel.webview.postMessage({
                            command: 'tablesLoaded',
                            tables: tables
                        });
                        break;
                    case 'generateQuery':
                        const query = this.generateSQLQuery(message.queryData);
                        panel.webview.postMessage({
                            command: 'queryGenerated',
                            query: query
                        });
                        break;
                    case 'executeQuery':
                        await this.executeGeneratedQuery(message.query);
                        break;
                }
            },
            undefined,
            []
        );
    }

    /**
     * Generate SQL from query builder data
     */
    generateSQLQuery(queryData: any): string {
        let sql = 'SELECT ';
        
        // SELECT clause
        if (queryData.select && queryData.select.length > 0) {
            sql += queryData.select.join(', ');
        } else {
            sql += '*';
        }
        
        // FROM clause
        sql += `\nFROM ${queryData.from}`;
        
        // JOIN clauses
        if (queryData.joins && queryData.joins.length > 0) {
            for (const join of queryData.joins) {
                sql += `\n${join.type} JOIN ${join.table} ON ${join.condition}`;
            }
        }
        
        // WHERE clause
        if (queryData.where && queryData.where.length > 0) {
            sql += '\nWHERE ';
            const conditions = queryData.where.map((condition: QueryBuilderCondition, index: number) => {
                let conditionStr = `${condition.field} ${condition.operator}`;
                
                if (condition.operator !== 'IS NULL' && condition.operator !== 'IS NOT NULL') {
                    if (typeof condition.value === 'string') {
                        conditionStr += ` '${condition.value}'`;
                    } else {
                        conditionStr += ` ${condition.value}`;
                    }
                }
                
                if (index > 0 && condition.logicalOperator) {
                    conditionStr = `${condition.logicalOperator} ${conditionStr}`;
                }
                
                return conditionStr;
            });
            sql += conditions.join(' ');
        }
        
        // GROUP BY clause
        if (queryData.groupBy && queryData.groupBy.length > 0) {
            sql += `\nGROUP BY ${queryData.groupBy.join(', ')}`;
        }
        
        // HAVING clause
        if (queryData.having && queryData.having.length > 0) {
            sql += '\nHAVING ';
            const havingConditions = queryData.having.map((condition: QueryBuilderCondition, index: number) => {
                let conditionStr = `${condition.field} ${condition.operator}`;
                
                if (condition.operator !== 'IS NULL' && condition.operator !== 'IS NOT NULL') {
                    if (typeof condition.value === 'string') {
                        conditionStr += ` '${condition.value}'`;
                    } else {
                        conditionStr += ` ${condition.value}`;
                    }
                }
                
                if (index > 0 && condition.logicalOperator) {
                    conditionStr = `${condition.logicalOperator} ${conditionStr}`;
                }
                
                return conditionStr;
            });
            sql += havingConditions.join(' ');
        }
        
        // ORDER BY clause
        if (queryData.orderBy && queryData.orderBy.length > 0) {
            sql += '\nORDER BY ';
            const orders = queryData.orderBy.map((order: QueryBuilderOrder) => 
                `${order.field} ${order.direction}`
            );
            sql += orders.join(', ');
        }
        
        // LIMIT clause
        if (queryData.limit) {
            sql += `\nLIMIT ${queryData.limit}`;
        }
        
        // OFFSET clause
        if (queryData.offset) {
            sql += `\nOFFSET ${queryData.offset}`;
        }
        
        return sql + ';';
    }

    /**
     * AI-Powered Query Suggestions
     */
    async getAIQuerySuggestions(naturalLanguageQuery: string): Promise<string[]> {
        try {
            // This would integrate with your AI service
            const suggestions = [
                `-- AI Suggestion 1: ${naturalLanguageQuery}`,
                `-- AI Suggestion 2: Optimized version`,
                `-- AI Suggestion 3: Alternative approach`
            ];
            
            return suggestions;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ AI suggestions failed: ${error}`);
            return [];
        }
    }

    /**
     * Query Performance Analysis
     */
    async analyzeQueryPerformance(query: string): Promise<any> {
        try {
            const connection = this.connectionManager.getActiveConnection();
            if (!connection) {
                throw new Error('No active database connection');
            }

            // Execute EXPLAIN ANALYZE
            const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
            const result = await this.connectionManager.executeQuery(explainQuery);
            
            return {
                executionTime: result.rows[0]?.['Execution Time'] || 0,
                planningTime: result.rows[0]?.['Planning Time'] || 0,
                totalCost: result.rows[0]?.['Total Cost'] || 0,
                suggestions: this.generatePerformanceSuggestions(result.rows[0])
            };
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Performance analysis failed: ${error}`);
            return null;
        }
    }

    /**
     * Generate performance optimization suggestions
     */
    private generatePerformanceSuggestions(explainResult: any): string[] {
        const suggestions: string[] = [];
        
        // Analyze the explain result and provide suggestions
        if (explainResult['Total Cost'] > 1000) {
            suggestions.push('💡 Consider adding indexes on frequently queried columns');
        }
        
        if (explainResult['Execution Time'] > 100) {
            suggestions.push('⚡ Query execution time is high - consider optimization');
        }
        
        // Add more sophisticated analysis based on the explain result
        suggestions.push('🔍 Review query plan for potential optimizations');
        
        return suggestions;
    }

    private async getTables(database: string): Promise<Array<{name: string, schema: string}>> {
        // Implementation to get tables from database
        return [];
    }

    private async getTableFields(database: string, table: string): Promise<QueryBuilderField[]> {
        // Implementation to get table fields
        return [];
    }

    private async getTableIndexes(database: string, table: string): Promise<string[]> {
        // Implementation to get table indexes
        return [];
    }

    private async getTableConstraints(database: string, table: string): Promise<string[]> {
        // Implementation to get table constraints
        return [];
    }

    private async executeGeneratedQuery(query: string): Promise<void> {
        try {
            const result = await this.connectionManager.executeQuery(query);
            vscode.window.showInformationMessage(`✅ Query executed successfully. ${result.rows.length} rows returned.`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Query execution failed: ${error}`);
        }
    }

    private getVisualQueryBuilderHTML(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Query Builder</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        .query-builder {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            height: 100vh;
        }
        .builder-panel {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
        }
        .table-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 10px;
        }
        .table-item {
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 4px;
        }
        .table-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .field-item {
            padding: 4px 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .query-preview {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 15px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .condition-builder {
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        select, input {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 4px 8px;
            margin: 2px;
        }
    </style>
</head>
<body>
    <div class="query-builder">
        <div class="builder-panel">
            <h3>🎨 Visual Query Builder</h3>
            
            <div>
                <h4>📋 Tables</h4>
                <div id="tableList" class="table-list">
                    Loading tables...
                </div>
            </div>
            
            <div>
                <h4>🔍 Conditions</h4>
                <div class="condition-builder">
                    <select id="fieldSelect">
                        <option>Select Field</option>
                    </select>
                    <select id="operatorSelect">
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">></option>
                        <option value="<"><</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IN">IN</option>
                    </select>
                    <input type="text" id="valueInput" placeholder="Value">
                    <button onclick="addCondition()">Add Condition</button>
                </div>
            </div>
            
            <div>
                <button onclick="generateQuery()">🎯 Generate Query</button>
                <button onclick="executeQuery()">▶️ Execute</button>
            </div>
        </div>
        
        <div class="builder-panel">
            <h3>📝 Generated SQL</h3>
            <div id="queryPreview" class="query-preview">
                -- Your generated query will appear here
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentQuery = {
            select: [],
            from: '',
            joins: [],
            where: [],
            groupBy: [],
            having: [],
            orderBy: []
        };

        // Load tables when page loads
        vscode.postMessage({ command: 'loadTables' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'tablesLoaded':
                    displayTables(message.tables);
                    break;
                case 'queryGenerated':
                    document.getElementById('queryPreview').textContent = message.query;
                    break;
            }
        });

        function displayTables(tables) {
            const tableList = document.getElementById('tableList');
            tableList.innerHTML = '';
            
            tables.forEach(table => {
                const tableDiv = document.createElement('div');
                tableDiv.className = 'table-item';
                tableDiv.innerHTML = \`
                    <strong>\${table.name}</strong>
                    \${table.fields.map(field => \`
                        <div class="field-item">• \${field.name} (\${field.type})</div>
                    \`).join('')}
                \`;
                tableDiv.onclick = () => selectTable(table);
                tableList.appendChild(tableDiv);
            });
        }

        function selectTable(table) {
            currentQuery.from = table.name;
            updateFieldSelect(table.fields);
        }

        function updateFieldSelect(fields) {
            const fieldSelect = document.getElementById('fieldSelect');
            fieldSelect.innerHTML = '<option>Select Field</option>';
            
            fields.forEach(field => {
                const option = document.createElement('option');
                option.value = field.name;
                option.textContent = \`\${field.name} (\${field.type})\`;
                fieldSelect.appendChild(option);
            });
        }

        function addCondition() {
            const field = document.getElementById('fieldSelect').value;
            const operator = document.getElementById('operatorSelect').value;
            const value = document.getElementById('valueInput').value;
            
            if (field && operator && value) {
                currentQuery.where.push({
                    field: field,
                    operator: operator,
                    value: value,
                    logicalOperator: 'AND'
                });
                
                document.getElementById('valueInput').value = '';
            }
        }

        function generateQuery() {
            vscode.postMessage({
                command: 'generateQuery',
                queryData: currentQuery
            });
        }

        function executeQuery() {
            const query = document.getElementById('queryPreview').textContent;
            vscode.postMessage({
                command: 'executeQuery',
                query: query
            });
        }
    </script>
</body>
</html>`;
    }
}
