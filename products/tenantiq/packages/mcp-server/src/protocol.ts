/**
 * JSON-RPC 2.0 types and helpers for MCP protocol communication.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Standard JSON-RPC 2.0 error codes */
export const ErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** Parse a raw JSON string into a validated JsonRpcRequest. */
export function parseMessage(raw: string): JsonRpcRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw createProtocolError(ErrorCode.PARSE_ERROR, 'Invalid JSON');
  }

  if (!isObject(parsed)) {
    throw createProtocolError(ErrorCode.INVALID_REQUEST, 'Request must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.jsonrpc !== '2.0') {
    throw createProtocolError(ErrorCode.INVALID_REQUEST, 'Missing jsonrpc: "2.0"');
  }

  if (obj.id === undefined || obj.id === null) {
    throw createProtocolError(ErrorCode.INVALID_REQUEST, 'Missing id field');
  }

  if (typeof obj.method !== 'string' || obj.method.length === 0) {
    throw createProtocolError(ErrorCode.INVALID_REQUEST, 'Missing or invalid method');
  }

  if (obj.params !== undefined && !isObject(obj.params)) {
    throw createProtocolError(ErrorCode.INVALID_PARAMS, 'Params must be an object');
  }

  return {
    jsonrpc: '2.0',
    id: obj.id as string | number,
    method: obj.method,
    params: obj.params as Record<string, unknown> | undefined,
  };
}

/** Format a successful JSON-RPC response. */
export function formatResponse(id: string | number, result: unknown): string {
  const response: JsonRpcResponse = { jsonrpc: '2.0', id, result };
  return JSON.stringify(response);
}

/** Format a JSON-RPC error response. */
export function formatError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): string {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id: id ?? 0,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
  return JSON.stringify(response);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createProtocolError(code: number, message: string): JsonRpcError & Error {
  const err = new Error(message) as JsonRpcError & Error;
  err.code = code;
  return err;
}
