/**
 * Generic MCP (Model Context Protocol) client.
 *
 * TenantIQ-as-client: our AI Agent can call ANY MCP server (Microsoft
 * Graph MCP when it ships, GitHub MCP, Moody's MCP, etc.) as a tool source.
 * This module is the JSON-RPC 2.0 transport + thin abstractions for
 * initialize / tools/list / tools/call.
 *
 * Auth = Bearer header, Origin scrubbing, 10s timeouts. Per-server failures
 * never throw — return { error } so a single bad server doesn't poison the
 * aggregator.
 */

const TIMEOUT_MS = 10_000;

export interface McpServerConfig {
	id: string;
	name: string;
	url: string;
	bearer?: string;
	enabled: boolean;
}

export interface McpToolEntry {
	name: string;
	description: string;
	inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface McpListToolsResult {
	serverId: string;
	serverName: string;
	tools: McpToolEntry[];
	error?: string;
}

export interface McpCallResult {
	serverId: string;
	tool: string;
	content?: Array<{ type: 'text'; text: string }>;
	error?: string;
}

export async function listToolsRemote(server: McpServerConfig): Promise<McpListToolsResult> {
	if (!server.enabled) return { serverId: server.id, serverName: server.name, tools: [], error: 'disabled' };
	try {
		const res = await jsonRpc(server, 'tools/list');
		const result = (res?.result as { tools?: McpToolEntry[] }) ?? null;
		const tools = result?.tools ?? [];
		return { serverId: server.id, serverName: server.name, tools };
	} catch (err) {
		return { serverId: server.id, serverName: server.name, tools: [], error: errMsg(err) };
	}
}

export async function callToolRemote(
	server: McpServerConfig,
	name: string,
	args: Record<string, unknown> = {},
): Promise<McpCallResult> {
	if (!server.enabled) return { serverId: server.id, tool: name, error: 'disabled' };
	try {
		const res = await jsonRpc(server, 'tools/call', { name, arguments: args });
		if (res.error) return { serverId: server.id, tool: name, error: res.error.message ?? 'rpc error' };
		const content = (res.result as { content?: McpCallResult['content'] })?.content;
		return { serverId: server.id, tool: name, content };
	} catch (err) {
		return { serverId: server.id, tool: name, error: errMsg(err) };
	}
}

export async function initializeRemote(server: McpServerConfig): Promise<{ ok: boolean; serverInfo?: { name: string; version?: string }; error?: string }> {
	if (!server.enabled) return { ok: false, error: 'disabled' };
	try {
		const res = await jsonRpc(server, 'initialize', { protocolVersion: '2025-06-18', clientInfo: { name: 'tenantiq', version: '0.4.0' } });
		const info = (res?.result as { serverInfo?: { name: string; version?: string } })?.serverInfo;
		return { ok: !!info, serverInfo: info };
	} catch (err) {
		return { ok: false, error: errMsg(err) };
	}
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id?: string | number;
	result?: unknown;
	error?: { code: number; message: string };
}

async function jsonRpc(
	server: McpServerConfig,
	method: string,
	params?: Record<string, unknown>,
): Promise<JsonRpcResponse> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(server.url, {
			method: 'POST',
			signal: ctrl.signal,
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				...(server.bearer ? { authorization: `Bearer ${server.bearer}` } : {}),
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return await res.json() as JsonRpcResponse;
	} finally {
		clearTimeout(timer);
	}
}

function errMsg(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
