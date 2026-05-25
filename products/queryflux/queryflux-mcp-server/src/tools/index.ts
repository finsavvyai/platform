import { QueryFluxClient } from '../client.js';

export function getQueryFluxTools() {
  return [
    {
      name: 'execute_query',
      description: 'Execute SQL query on a connected database',
      inputSchema: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Database connection ID' },
          sql: { type: 'string', description: 'SQL query to execute' },
          dryRun: { type: 'boolean', default: false, description: 'Validate without executing' },
        },
        required: ['connectionId', 'sql'],
      },
    },
    {
      name: 'get_schema',
      description: 'Get database schema with tables, columns, and indexes',
      inputSchema: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Database connection ID' },
        },
        required: ['connectionId'],
      },
    },
    {
      name: 'list_connections',
      description: 'List all saved database connections',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'test_connection',
      description: 'Test if a saved database connection is reachable',
      inputSchema: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Database connection ID' },
        },
        required: ['connectionId'],
      },
    },
    {
      name: 'explain_query',
      description: 'Analyze query execution plan for optimization',
      inputSchema: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Database connection ID' },
          sql: { type: 'string', description: 'SQL query to analyze' },
          analyze: { type: 'boolean', default: true, description: 'Run EXPLAIN ANALYZE' },
        },
        required: ['connectionId', 'sql'],
      },
    },
    {
      name: 'natural_language_query',
      description: 'Convert natural language question to SQL via QueryLens AI',
      inputSchema: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Database connection ID' },
          question: { type: 'string', description: 'Natural language question' },
          execute: { type: 'boolean', default: false, description: 'Auto-execute generated SQL' },
        },
        required: ['connectionId', 'question'],
      },
    },
  ];
}

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], isError };
}

export async function handleToolCall(
  client: QueryFluxClient,
  name: string,
  args: Record<string, unknown>
) {
  try {
    switch (name) {
      case 'execute_query': {
        const result = await client.executeQuery(
          args.connectionId as string,
          args.sql as string,
          args.dryRun as boolean
        );
        if (args.dryRun) {
          return textResult(`Query validation OK\n\n\`\`\`sql\n${args.sql}\n\`\`\``);
        }
        const time = result.executionTime?.toFixed(2) ?? '?';
        return textResult(
          `Query executed in ${time}ms (${result.rowCount} rows)\n\n` +
          JSON.stringify(result.rows, null, 2)
        );
      }
      case 'get_schema': {
        const schema = await client.getSchema(args.connectionId as string);
        return textResult(JSON.stringify(schema, null, 2));
      }
      case 'list_connections': {
        const conns = await client.listConnections();
        return textResult(JSON.stringify(conns, null, 2));
      }
      case 'test_connection': {
        const res = await client.testConnection(args.connectionId as string);
        const status = res.reachable ? 'Reachable' : 'Unreachable';
        return textResult(`${status} (${res.latency_ms}ms)`);
      }
      case 'explain_query': {
        const result = await client.explainQuery(
          args.connectionId as string,
          args.sql as string,
          args.analyze as boolean
        );
        return textResult(JSON.stringify(result.rows, null, 2));
      }
      case 'natural_language_query': {
        const nlp = await client.naturalLanguageQuery(
          args.connectionId as string,
          args.question as string
        );
        if (args.execute && nlp.sql) {
          const exec = await client.executeQuery(args.connectionId as string, nlp.sql);
          return textResult(
            `Generated SQL:\n\`\`\`sql\n${nlp.sql}\n\`\`\`\n\nResults:\n` +
            JSON.stringify(exec, null, 2)
          );
        }
        return textResult(`SQL:\n\`\`\`sql\n${nlp.sql}\n\`\`\``);
      }
      default:
        return textResult(`Unknown tool: ${name}`, true);
    }
  } catch (error: any) {
    return textResult(`Error: ${error.message}`, true);
  }
}
