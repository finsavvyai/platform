/**
 * MCP (Model Context Protocol) server for TenantIQ.
 *
 * JSON-RPC 2.0 dispatcher. Tool catalog + dispatch live in mcp-tools.ts;
 * resource catalog + read live in mcp-resources.ts. This file just routes
 * spec methods to the right module.
 *
 * Auth = same Bearer token / cookie as the rest of the API; tenant scoping
 * inherited from the JWT.
 *
 * Connect from Claude Desktop:
 *   "tenantiq": {
 *     "transport": { "type": "http", "url": "https://api.tenantiq.app/api/mcp",
 *                    "headers": { "Authorization": "Bearer <jwt>" } }
 *   }
 *
 * Spec: https://modelcontextprotocol.io/specification
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { TOOLS, dispatchTool } from './mcp-tools';
import { RESOURCES, readResource } from './mcp-resources';
import { handleMcpSse } from './mcp-sse';
import { PROMPTS, getPromptMessages } from './mcp-prompts';

export const mcpRoutes = new Hono<AppEnv>();
mcpRoutes.use('*', authMiddleware);

interface McpRequest {
	jsonrpc: '2.0';
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

// Streamable-HTTP transport: GET with Accept: text/event-stream opens an SSE
// stream of server-initiated `notifications/message` events for the calling
// org's tenants. Same auth as the POST endpoint.
mcpRoutes.get('/', async (c) => {
	const accept = c.req.header('accept') ?? '';
	if (!accept.includes('text/event-stream')) {
		return c.json({ error: 'GET requires Accept: text/event-stream — POST for JSON-RPC' }, 406);
	}
	return handleMcpSse(c);
});

mcpRoutes.post('/', async (c) => {
	const body = await c.req.json<McpRequest>().catch(() => null);
	if (!body || body.jsonrpc !== '2.0' || !body.method) {
		return c.json({
			jsonrpc: '2.0',
			id: body?.id ?? null,
			error: { code: -32600, message: 'Invalid Request' },
		}, 400);
	}

	switch (body.method) {
		case 'initialize':
			return c.json({
				jsonrpc: '2.0',
				id: body.id,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: {
						tools: { listChanged: false },
						resources: { listChanged: false, subscribe: false },
						prompts: { listChanged: false },
					},
					serverInfo: { name: 'tenantiq', version: '0.3.0' },
				},
			});

		case 'tools/list':
			return c.json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });

		case 'tools/call': {
			const toolName = (body.params as { name?: string })?.name;
			const args = (body.params as { arguments?: Record<string, unknown> })?.arguments ?? {};
			const tool = TOOLS.find((t) => t.name === toolName);
			if (!tool) {
				return c.json({
					jsonrpc: '2.0', id: body.id,
					error: { code: -32602, message: `Unknown tool: ${toolName}` },
				});
			}
			const text = await dispatchTool(c, toolName!, args);
			return c.json({
				jsonrpc: '2.0',
				id: body.id,
				result: { content: [{ type: 'text', text }] },
			});
		}

		case 'resources/list':
			return c.json({ jsonrpc: '2.0', id: body.id, result: { resources: RESOURCES } });

		case 'prompts/list':
			return c.json({ jsonrpc: '2.0', id: body.id, result: { prompts: PROMPTS } });

		case 'prompts/get': {
			const params = body.params as { name?: string; arguments?: Record<string, string> } | undefined;
			const name = params?.name ?? '';
			const args = params?.arguments ?? {};
			const messages = getPromptMessages(name, args);
			if (!messages) {
				return c.json({ jsonrpc: '2.0', id: body.id, error: { code: -32602, message: `Unknown prompt: ${name}` } });
			}
			const def = PROMPTS.find((p) => p.name === name);
			return c.json({
				jsonrpc: '2.0', id: body.id,
				result: { description: def?.description ?? '', messages },
			});
		}

		case 'resources/read': {
			const uri = (body.params as { uri?: string })?.uri ?? '';
			const text = await readResource(c, uri);
			if (text === null) {
				return c.json({
					jsonrpc: '2.0', id: body.id,
					error: { code: -32602, message: `Unknown resource URI: ${uri}` },
				});
			}
			const resource = RESOURCES.find((r) => r.uri === uri);
			return c.json({
				jsonrpc: '2.0',
				id: body.id,
				result: {
					contents: [{ uri, mimeType: resource?.mimeType ?? 'application/json', text }],
				},
			});
		}

		default:
			return c.json({
				jsonrpc: '2.0', id: body.id,
				error: { code: -32601, message: `Method not found: ${body.method}` },
			});
	}
});
