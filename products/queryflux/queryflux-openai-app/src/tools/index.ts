/**
 * QueryFlux Tools for OpenAI App
 *
 * Registers all 6 QueryFlux tools with OpenAI Apps SDK.
 */

import { App } from '@openai/app-sdk';
import { QueryFluxClient } from '../client.js';

/**
 * Register all QueryFlux tools with OpenAI App
 */
export function registerTools(app: App, client: QueryFluxClient) {
  // Tool 1: Execute Query
  app.tool({
    name: 'execute_query',
    description: 'Execute SQL query on connected database with safety checks and dry-run mode',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier (e.g., "db-prod", "db-staging")',
        },
        sql: {
          type: 'string',
          description: 'SQL query to execute (SELECT, INSERT, UPDATE, DELETE, etc.)',
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, validate query without executing (default: false)',
          default: false,
        },
      },
      required: ['database_id', 'sql'],
    },
    handler: async (params: any) => {
      try {
        const result = await client.executeQuery(params.database_id, params.sql, params.dry_run);

        if (params.dry_run) {
          return {
            message: `✅ Query validation successful!\n\nSQL:\n\`\`\`sql\n${result.sql}\n\`\`\`\n\n💡 This was a dry-run. Set dry_run=false to execute.`,
          };
        }

        const rowCount = result.rows.length;
        const tableMarkdown = formatResultsAsTable(result.rows);

        return {
          message: `✅ Query executed successfully!\n\n**Results**: ${rowCount} rows in ${result.execution_ms.toFixed(2)}ms\n\n${tableMarkdown}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Query execution failed',
        };
      }
    },
  });

  // Tool 2: Get Schema
  app.tool({
    name: 'get_schema',
    description: 'Get complete database schema with tables, columns, types, and constraints',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier',
        },
      },
      required: ['database_id'],
    },
    handler: async (params: any) => {
      try {
        const schema = await client.getSchema(params.database_id);
        const schemaMarkdown = formatSchemaAsMarkdown(schema);

        return {
          message: `## Database Schema\n\n${schemaMarkdown}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Schema retrieval failed',
        };
      }
    },
  });

  // Tool 3: Natural Language Query
  app.tool({
    name: 'natural_language_query',
    description: 'Convert natural language question to SQL query using AI',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier',
        },
        question: {
          type: 'string',
          description: 'Natural language question (e.g., "Show me users who signed up last week")',
        },
      },
      required: ['database_id', 'question'],
    },
    handler: async (params: any) => {
      try {
        const result = await client.naturalLanguageQuery(params.database_id, params.question);

        return {
          message: `## Generated SQL\n\n\`\`\`sql\n${result.sql}\n\`\`\`\n\n**Confidence**: ${(result.confidence * 100).toFixed(0)}%\n\n${result.explanation ? `**Explanation**: ${result.explanation}` : ''}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'NLP query generation failed',
        };
      }
    },
  });

  // Tool 4: Create Migration
  app.tool({
    name: 'create_migration',
    description: 'Generate SQL migration (up/down) from natural language description',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier',
        },
        description: {
          type: 'string',
          description: 'Natural language description of migration (e.g., "Add index on users.email")',
        },
        validate: {
          type: 'boolean',
          description: 'Validate migration for safety (default: true)',
          default: true,
        },
      },
      required: ['database_id', 'description'],
    },
    handler: async (params: any) => {
      try {
        const result = await client.createMigration(
          params.database_id,
          params.description,
          params.validate ?? true
        );

        const warnings = result.warnings && result.warnings.length > 0
          ? `\n\n⚠️ **Warnings**:\n${result.warnings.map(w => `- ${w}`).join('\n')}`
          : '\n\n✅ No warnings';

        return {
          message: `## Migration: ${params.description}\n\n**Up Migration:**\n\`\`\`sql\n${result.up_migration}\n\`\`\`\n\n**Down Migration:**\n\`\`\`sql\n${result.down_migration}\n\`\`\`${warnings}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Migration generation failed',
        };
      }
    },
  });

  // Tool 5: Seed Test Data
  app.tool({
    name: 'seed_test_data',
    description: 'Generate AI-powered realistic test data for database tables',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier',
        },
        table_name: {
          type: 'string',
          description: 'Table name to seed data into',
        },
        row_count: {
          type: 'number',
          description: 'Number of rows to generate (1-1000)',
          minimum: 1,
          maximum: 1000,
        },
        data_type: {
          type: 'string',
          enum: ['realistic', 'random'],
          description: 'Type of data: "realistic" (human-like names/emails) or "random" (UUIDs/random strings)',
          default: 'realistic',
        },
        execute: {
          type: 'boolean',
          description: 'If false, preview only without inserting (default: false)',
          default: false,
        },
      },
      required: ['database_id', 'table_name', 'row_count'],
    },
    handler: async (params: any) => {
      try {
        const result = await client.seedTestData(
          params.database_id,
          params.table_name,
          params.row_count,
          params.data_type || 'realistic',
          params.execute || false
        );

        const status = params.execute
          ? `✅ Inserted ${result.rows_inserted} rows`
          : `💡 Preview only - Set execute=true to insert data`;

        return {
          message: `## Generated ${params.row_count} ${params.data_type || 'realistic'} records for ${params.table_name}\n\n\`\`\`sql\n${result.sql}\n\`\`\`\n\n${status}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Test data generation failed',
        };
      }
    },
  });

  // Tool 6: Explain Query
  app.tool({
    name: 'explain_query',
    description: 'Analyze query execution plan and get optimization suggestions',
    parameters: {
      type: 'object',
      properties: {
        database_id: {
          type: 'string',
          description: 'Database connection identifier',
        },
        query: {
          type: 'string',
          description: 'SQL query to analyze',
        },
        analyze: {
          type: 'boolean',
          description: 'If true, run EXPLAIN ANALYZE with actual execution (default: true)',
          default: true,
        },
      },
      required: ['database_id', 'query'],
    },
    handler: async (params: any) => {
      try {
        const result = await client.explainQuery(params.database_id, params.query, params.analyze ?? true);

        const slowOps = result.slow_operations.length > 0
          ? `\n\n⚠️ **Slow Operations Detected:**\n${result.slow_operations.map(op => `- **${op.type}** (cost: ${op.cost})\n  ${op.description}`).join('\n')}`
          : '';

        const suggestions = groupSuggestionsByPriority(result.optimization_suggestions);
        const suggestionsMarkdown = formatOptimizationSuggestions(suggestions);

        return {
          message: `## Query Execution Plan\n\n\`\`\`\n${result.execution_plan}\n\`\`\`\n\n**Performance Metrics:**\n- Estimated Cost: ${result.estimated_cost}\n- Estimated Rows: ${result.estimated_rows}\n- Actual Time: ${result.actual_time_ms || 'N/A'}ms${slowOps}\n\n${suggestionsMarkdown}`,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Query explain failed',
        };
      }
    },
  });
}

/**
 * Helper: Format query results as Markdown table
 */
function formatResultsAsTable(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '*No results*';

  const columns = Object.keys(rows[0]);
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row =>
    `| ${columns.map(col => row[col] === null ? 'NULL' : String(row[col])).join(' | ')} |`
  );

  return [header, separator, ...dataRows].join('\n');
}

/**
 * Helper: Format schema as Markdown
 */
function formatSchemaAsMarkdown(schema: any): string {
  return schema.tables.map((table: any) => {
    const columns = table.columns.map((col: any) =>
      `- **${col.name}** (${col.type})${col.primary_key ? ' 🔑 PK' : ''}${col.nullable ? '' : ' NOT NULL'}`
    ).join('\n');

    return `### ${table.name}\n\n${columns}`;
  }).join('\n\n');
}

/**
 * Helper: Group suggestions by priority
 */
function groupSuggestionsByPriority(suggestions: any[]) {
  return {
    high: suggestions.filter(s => s.priority === 'high'),
    medium: suggestions.filter(s => s.priority === 'medium'),
    low: suggestions.filter(s => s.priority === 'low'),
  };
}

/**
 * Helper: Format optimization suggestions
 */
function formatOptimizationSuggestions(grouped: any): string {
  let result = '## 💡 Optimization Suggestions\n\n';

  if (grouped.high.length > 0) {
    result += '🔴 **High Priority:**\n';
    result += grouped.high.map((s: any) =>
      `- **${s.type}**: ${s.suggestion}\n  *Rationale: ${s.rationale}*`
    ).join('\n\n') + '\n\n';
  }

  if (grouped.medium.length > 0) {
    result += '🟡 **Medium Priority:**\n';
    result += grouped.medium.map((s: any) =>
      `- **${s.type}**: ${s.suggestion}\n  *Rationale: ${s.rationale}*`
    ).join('\n\n') + '\n\n';
  }

  if (grouped.low.length > 0) {
    result += '🟢 **Low Priority:**\n';
    result += grouped.low.map((s: any) =>
      `- **${s.type}**: ${s.suggestion}\n  *Rationale: ${s.rationale}*`
    ).join('\n\n');
  }

  return result || '*No optimization suggestions*';
}
