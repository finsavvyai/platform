#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { QueryFluxClient } from './client.js';
import { getQueryFluxTools, handleToolCall } from './tools/index.js';
import { getQueryFluxResources } from './resources/index.js';

const QUERYFLUX_API_URL = process.env.QUERYFLUX_API_URL || 'https://queryflux-backend-prod.broad-dew-49ad.workers.dev';
const QUERYFLUX_TOKEN = process.env.QUERYFLUX_TOKEN || '';

const server = new Server(
  { name: 'queryflux', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

const client = new QueryFluxClient(QUERYFLUX_API_URL, QUERYFLUX_TOKEN);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getQueryFluxTools(),
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: getQueryFluxResources(),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === 'queryflux://connections') {
    const connections = await client.listConnections();
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(connections, null, 2),
      }],
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!args) throw new Error('Missing arguments');
  return handleToolCall(client, name, args as Record<string, unknown>);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('QueryFlux MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
