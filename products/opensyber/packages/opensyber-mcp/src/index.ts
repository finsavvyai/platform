#!/usr/bin/env node
/**
 * OpenSyber MCP Server
 *
 * Provides AI agent security monitoring, dependency scanning, and threat
 * intelligence to any MCP-compatible client (Claude Desktop, Cursor, Claude Code).
 *
 * @example
 * Install: npx @opensyber/mcp
 * Config: Add to claude_desktop_config.json or .cursor/mcp.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.js';
import {
  handleScanDependency,
  handleCheckSecurity,
  handleQueryThreats,
  handleListSkills,
  handleProtect,
} from './handlers.js';

const server = new Server(
  { name: 'opensyber', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

/** Register available tools with their JSON schemas */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

/** Route tool calls to the appropriate handler */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const params = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'opensyber_scan_dependency':
      return handleScanDependency(params);

    case 'opensyber_check_security':
      return handleCheckSecurity(params);

    case 'opensyber_query_threats':
      return handleQueryThreats(params);

    case 'opensyber_list_skills':
      return handleListSkills(params);

    case 'opensyber_protect':
      return handleProtect(params);

    default:
      return {
        content: [{
          type: 'text' as const,
          text: `Unknown tool: "${name}". Available tools: ${TOOLS.map((t) => t.name).join(', ')}`,
        }],
      };
  }
});

/** Start the server on stdio transport */
const transport = new StdioServerTransport();
server.connect(transport).catch((error: unknown) => {
  console.error('Failed to start OpenSyber MCP server:', error);
  process.exit(1);
});
