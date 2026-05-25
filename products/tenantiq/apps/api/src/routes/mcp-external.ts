/**
 * Per-org registry of external MCP servers TenantIQ orchestrates.
 *
 * Storage: KV `mcp:external:<orgId>` → array of McpServerConfig.
 * (No D1 table — simple, reversible, no migration. Move to D1 if/when
 * we want change-history.)
 *
 *   GET    /                  list servers + capabilities
 *   POST   /                  add server { name, url, bearer? }
 *   PATCH  /:id                update { enabled?, bearer?, name? }
 *   DELETE /:id                remove
 *   POST   /:id/probe          ping the server's initialize handshake
 *   POST   /tools/call         { serverId, tool, arguments } — invoke + return content
 *   GET    /tools              aggregated tools/list across all enabled servers
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import {
	type McpServerConfig,
	listToolsRemote, callToolRemote, initializeRemote,
} from '../lib/mcp-client';
import { logAgentAction } from '../lib/agent-actions';

export const mcpExternalRoutes = new Hono<AppEnv>();
mcpExternalRoutes.use('*', authMiddleware);

const KV = (orgId: string) => `mcp:external:${orgId}`;

mcpExternalRoutes.get('/', async (c) => {
	const orgId = c.get('user')?.orgId ?? '';
	const servers = await read(c.env.KV, orgId);
	return c.json({ servers: servers.map(safe) });
});

mcpExternalRoutes.post('/', async (c) => {
	if (!isAdmin(c.get('user')?.role)) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
	const body = await c.req.json<{ name?: string; url?: string; bearer?: string }>().catch(() => ({} as { name?: string; url?: string; bearer?: string }));
	if (!body.name || !body.url) return c.json({ error: 'name + url required' }, 400);
	if (!/^https?:\/\//.test(body.url)) return c.json({ error: 'url must start with http(s)://' }, 400);

	const orgId = c.get('user')!.orgId;
	const servers = await read(c.env.KV, orgId);
	if (servers.length >= 25) return c.json({ error: 'Limit reached (25 servers per org)' }, 400);
	const server: McpServerConfig = {
		id: crypto.randomUUID(), name: body.name.slice(0, 80), url: body.url,
		bearer: body.bearer, enabled: true,
	};
	servers.push(server);
	await write(c.env.KV, orgId, servers);
	return c.json({ server: safe(server) }, 201);
});

mcpExternalRoutes.patch('/:id', async (c) => {
	if (!isAdmin(c.get('user')?.role)) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
	const orgId = c.get('user')!.orgId;
	const servers = await read(c.env.KV, orgId);
	const idx = servers.findIndex((s) => s.id === c.req.param('id'));
	if (idx < 0) return c.json({ error: 'Not found' }, 404);
	const body = await c.req.json<Partial<McpServerConfig>>().catch(() => ({} as Partial<McpServerConfig>));
	servers[idx] = { ...servers[idx], ...pickUpdatable(body) };
	await write(c.env.KV, orgId, servers);
	return c.json({ server: safe(servers[idx]) });
});

mcpExternalRoutes.delete('/:id', async (c) => {
	if (!isAdmin(c.get('user')?.role)) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
	const orgId = c.get('user')!.orgId;
	const servers = await read(c.env.KV, orgId);
	const next = servers.filter((s) => s.id !== c.req.param('id'));
	if (next.length === servers.length) return c.json({ error: 'Not found' }, 404);
	await write(c.env.KV, orgId, next);
	return c.json({ ok: true });
});

mcpExternalRoutes.post('/:id/probe', async (c) => {
	const orgId = c.get('user')!.orgId;
	const server = (await read(c.env.KV, orgId)).find((s) => s.id === c.req.param('id'));
	if (!server) return c.json({ error: 'Not found' }, 404);
	const probe = await initializeRemote(server);
	return c.json(probe);
});

mcpExternalRoutes.get('/tools', async (c) => {
	const orgId = c.get('user')!.orgId;
	const servers = await read(c.env.KV, orgId);
	const results = await Promise.all(servers.map(listToolsRemote));
	return c.json({ servers: results });
});

mcpExternalRoutes.post('/tools/call', async (c) => {
	const orgId = c.get('user')!.orgId;
	const body = await c.req.json<{ serverId?: string; tool?: string; arguments?: Record<string, unknown> }>()
		.catch(() => ({} as { serverId?: string; tool?: string; arguments?: Record<string, unknown> }));
	if (!body.serverId || !body.tool) return c.json({ error: 'serverId + tool required' }, 400);

	const server = (await read(c.env.KV, orgId)).find((s) => s.id === body.serverId);
	if (!server) return c.json({ error: 'Server not found' }, 404);

	const result = await callToolRemote(server, body.tool, body.arguments ?? {});
	await logAgentAction(c.env, {
		orgId, agent: 'mcp-tool-call', action: 'tool-invoked',
		metadata: { externalServer: server.name, tool: body.tool, ok: !result.error },
	});
	return c.json(result);
});

async function read(kv: KVNamespace, orgId: string): Promise<McpServerConfig[]> {
	if (!orgId) return [];
	const raw = await kv.get(KV(orgId), 'json') as McpServerConfig[] | null;
	return raw ?? [];
}
async function write(kv: KVNamespace, orgId: string, servers: McpServerConfig[]): Promise<void> {
	await kv.put(KV(orgId), JSON.stringify(servers), { expirationTtl: 60 * 60 * 24 * 365 });
}
function safe(s: McpServerConfig) {
	return { id: s.id, name: s.name, url: s.url, enabled: s.enabled, hasBearer: !!s.bearer };
}
function pickUpdatable(body: Partial<McpServerConfig>): Partial<McpServerConfig> {
	const out: Partial<McpServerConfig> = {};
	if (typeof body.name === 'string') out.name = body.name.slice(0, 80);
	if (typeof body.bearer === 'string') out.bearer = body.bearer;
	if (typeof body.enabled === 'boolean') out.enabled = body.enabled;
	return out;
}
function isAdmin(role?: string): boolean {
	return role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || role === 'platform_admin';
}
