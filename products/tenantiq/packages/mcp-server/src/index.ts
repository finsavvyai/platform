#!/usr/bin/env node
/**
 * TenantIQ MCP stdio server entry point.
 * Reads JSON-RPC 2.0 messages from stdin, dispatches to handlers, writes to stdout.
 */

import { createInterface } from 'node:readline';
import { parseMessage, formatResponse, formatError, ErrorCode } from './protocol.js';
import { listToolsPayload } from './tools.js';
import { handleToolCall, type HandlerConfig } from './handlers.js';
import { resolveAuth } from './auth.js';

let config: HandlerConfig;

try {
  config = resolveAuth();
} catch (err) {
  process.stderr.write(`Auth error: ${(err as Error).message}\n`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let id: string | number | null = null;
  try {
    const request = parseMessage(line);
    id = request.id;
    const result = await dispatch(request.method, request.params);
    process.stdout.write(formatResponse(request.id, result) + '\n');
  } catch (err) {
    const code = (err as { code?: number }).code ?? ErrorCode.INTERNAL_ERROR;
    const message = err instanceof Error ? err.message : 'Unknown error';
    process.stdout.write(formatError(id, code, message) + '\n');
  }
});

async function dispatch(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'tenantiq-mcp-server', version: '1.0.0' },
      };

    case 'tools/list':
      return listToolsPayload();

    case 'tools/call': {
      const toolName = params?.name as string | undefined;
      const toolArgs = params?.arguments as Record<string, unknown> | undefined;
      if (!toolName) {
        throw Object.assign(new Error('Missing tool name'), { code: ErrorCode.INVALID_PARAMS });
      }
      return handleToolCall(toolName, toolArgs, config);
    }

    default:
      throw Object.assign(
        new Error(`Method not found: ${method}`),
        { code: ErrorCode.METHOD_NOT_FOUND },
      );
  }
}

rl.on('close', () => process.exit(0));
