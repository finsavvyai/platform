/**
 * Tool call handlers: map each MCP tool name to a TenantIQ API HTTP call.
 */

import { findTool, type ToolDefinition } from './tools.js';

export interface HandlerConfig {
  apiUrl: string;
  apiToken: string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Execute a tool call by proxying to the TenantIQ API. */
export async function handleToolCall(
  toolName: string,
  params: Record<string, unknown> | undefined,
  config: HandlerConfig,
): Promise<ToolResult> {
  const tool = findTool(toolName);
  if (!tool) {
    return errorResult(`Unknown tool: ${toolName}`);
  }

  try {
    const url = buildUrl(tool, params, config.apiUrl);
    const response = await executeRequest(tool, url, params, config.apiToken);
    return successResult(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResult(`Tool ${toolName} failed: ${message}`);
  }
}

/** Build the full API URL, substituting path parameters like :tenantId. */
function buildUrl(
  tool: ToolDefinition,
  params: Record<string, unknown> | undefined,
  baseUrl: string,
): string {
  let path = tool.apiPath;

  // Replace path params (e.g., :tenantId, :alertId, :provider)
  const pathParamRegex = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pathParamRegex.exec(tool.apiPath)) !== null) {
    const paramName = match[1];
    const value = params?.[paramName];
    if (!value) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }
    path = path.replace(`:${paramName}`, encodeURIComponent(String(value)));
  }

  // Add query params for GET requests
  if (tool.apiMethod === 'GET' && params) {
    const queryParams = buildQueryParams(tool, params);
    if (queryParams) {
      path += `?${queryParams}`;
    }
  }

  return `${baseUrl}${path}`;
}

/** Build query string from non-path params for GET requests. */
function buildQueryParams(
  tool: ToolDefinition,
  params: Record<string, unknown>,
): string {
  const pathParams = extractPathParams(tool.apiPath);
  const entries = Object.entries(params).filter(
    ([key, val]) => !pathParams.has(key) && val !== undefined,
  );
  if (entries.length === 0) return '';
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
}

function extractPathParams(apiPath: string): Set<string> {
  const params = new Set<string>();
  const regex = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(apiPath)) !== null) {
    params.add(match[1]);
  }
  return params;
}

/** Execute the HTTP request to TenantIQ API. */
async function executeRequest(
  tool: ToolDefinition,
  url: string,
  params: Record<string, unknown> | undefined,
  apiToken: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'tenantiq-mcp-server/1.0',
  };

  const init: RequestInit = { method: tool.apiMethod, headers };

  if (tool.apiMethod !== 'GET' && params) {
    const pathParams = extractPathParams(tool.apiPath);
    const bodyParams = Object.fromEntries(
      Object.entries(params).filter(([k]) => !pathParams.has(k)),
    );
    if (Object.keys(bodyParams).length > 0) {
      init.body = JSON.stringify(bodyParams);
    }
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text().catch(() => 'No body');
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return response.json();
}

function successResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
