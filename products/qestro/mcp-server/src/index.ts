/**
 * Qestro MCP Server
 * Enables Claude and other AI agents to use Qestro testing platform natively
 */

import {
  StdioServerTransport,
  Server,
  Tool,
  TextContent,
  ErrorContent,
} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { generateTestsTool, generateTests } from './tools/generate-tests.js';
import { runTestsTool, runTests } from './tools/run-tests.js';
import { analyzeResultsTool, analyzeResults } from './tools/analyze-results.js';
import { healTestTool, healTest } from './tools/heal-test.js';
import { projectInfoTool, getProjectInfo } from './tools/project-info.js';

// Initialize MCP server
const transport = new StdioServerTransport();
const server = new Server(
  {
    name: 'qestro-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool registry
const tools: Tool[] = [
  generateTestsTool as Tool,
  runTestsTool as Tool,
  analyzeResultsTool as Tool,
  healTestTool as Tool,
  projectInfoTool as Tool,
];

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    let result: unknown;

    switch (name) {
      case 'qestro_generate_tests':
        result = await generateTests(args as Parameters<typeof generateTests>[0]);
        break;

      case 'qestro_run_tests':
        result = await runTests(args as Parameters<typeof runTests>[0]);
        break;

      case 'qestro_analyze_results':
        result = await analyzeResults(
          args as Parameters<typeof analyzeResults>[0],
        );
        break;

      case 'qestro_heal_test':
        result = await healTest(args as Parameters<typeof healTest>[0]);
        break;

      case 'qestro_project_info':
        result = await getProjectInfo(
          args as Parameters<typeof getProjectInfo>[0],
        );
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        } as TextContent,
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool: ${message}`,
        } as ErrorContent,
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main(): Promise<void> {
  console.error('[Qestro MCP] Initializing server...');

  try {
    await server.connect(transport);
    console.error('[Qestro MCP] Server started successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Qestro MCP] Failed to start server: ${message}`);
    process.exit(1);
  }
}

main();
