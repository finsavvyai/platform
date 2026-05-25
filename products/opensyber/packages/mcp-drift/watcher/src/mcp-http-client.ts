// Minimal MCP HTTP client. Sends JSON-RPC tools/list and returns the tool array.
// Uses the standard fetch API so it runs in both Workers and Node.

import type { ToolDef } from './fingerprint.js';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: { tools?: ToolDef[] };
  error?: { code: number; message: string };
}

export async function fetchToolsList(serverUrl: string): Promise<ToolDef[]> {
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  if (!res.ok) {
    throw new Error(`MCP server returned HTTP ${res.status} from ${serverUrl}`);
  }
  const body = (await res.json()) as JsonRpcResponse;
  if (body.error) {
    throw new Error(`MCP server error ${body.error.code}: ${body.error.message}`);
  }
  const tools = body.result?.tools;
  if (!Array.isArray(tools)) {
    throw new Error(`MCP server returned no tools array from ${serverUrl}`);
  }
  return tools;
}
