import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { mcpRoutes } from './mcp';
import { createMcpTestEnv, rpc, tokenFor } from './mcp-test-helpers';

describe('MCP server', () => {
	let app: Hono<AppEnv>;
	let token: string;
	let env: ReturnType<typeof createMcpTestEnv>;

	beforeEach(async () => {
		vi.clearAllMocks();
		env = createMcpTestEnv();
		app = new Hono<AppEnv>();
		app.route('/api/mcp', mcpRoutes);
		token = await tokenFor({ sub: 'u-1', orgId: 'org-1', email: 'a@b.com' });
	});

	it('rejects unauthenticated requests', async () => {
		const res = await rpc(app, env.env, 'initialize');
		expect(res.status).toBe(401);
	});

	it('rejects malformed JSON-RPC envelopes', async () => {
		const res = await app.request('/api/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ method: 'initialize' }),
		}, env.env);
		expect(res.status).toBe(400);
		const body = await res.json() as { error: { code: number } };
		expect(body.error.code).toBe(-32600);
	});

	it('responds to initialize with protocol version + serverInfo', async () => {
		const res = await rpc(app, env.env, 'initialize', {}, token);
		expect(res.status).toBe(200);
		const body = await res.json() as { result: { protocolVersion: string; serverInfo: { name: string } } };
		expect(body.result.protocolVersion).toBeTruthy();
		expect(body.result.serverInfo.name).toBe('tenantiq');
	});

	it('lists 13 tools via tools/list (10 read + 3 write)', async () => {
		const res = await rpc(app, env.env, 'tools/list', {}, token);
		const body = await res.json() as { result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] } };
		expect(body.result.tools).toHaveLength(13);
		const names = body.result.tools.map((t) => t.name);
		expect(names).toContain('list_tenants');
		expect(names).toContain('get_cis_posture');
		expect(names).toContain('list_recent_drift');
		expect(names).toContain('get_msp_backup_health');
		expect(names).toContain('list_open_alerts');
		expect(names).toContain('list_active_skills');
		expect(names).toContain('acknowledge_alert');
		expect(names).toContain('acknowledge_drift');
		expect(names).toContain('apply_skill_template');
		const writeTools = body.result.tools.filter((t) => t.annotations?.readOnlyHint === false);
		expect(writeTools).toHaveLength(3);
	});

	it('lists 3 resources via resources/list', async () => {
		const res = await rpc(app, env.env, 'resources/list', {}, token);
		const body = await res.json() as { result: { resources: { uri: string; mimeType: string }[] } };
		expect(body.result.resources).toHaveLength(3);
		expect(body.result.resources.map((r) => r.uri)).toContain('tenantiq://compliance/frameworks');
	});

	it('resources/read returns the stable compliance frameworks resource', async () => {
		const res = await rpc(app, env.env, 'resources/read', { uri: 'tenantiq://compliance/frameworks' }, token);
		const body = await res.json() as { result: { contents: { text: string }[] } };
		const parsed = JSON.parse(body.result.contents[0].text);
		expect(parsed.frameworks).toBeDefined();
		expect(parsed.frameworks.find((f: { id: string }) => f.id === 'iso27001')).toBeDefined();
	});

	it('resources/read returns -32602 for unknown URI', async () => {
		const res = await rpc(app, env.env, 'resources/read', { uri: 'tenantiq://nope' }, token);
		const body = await res.json() as { error: { code: number } };
		expect(body.error.code).toBe(-32602);
	});

	it('initialize advertises tools + resources + prompts capabilities', async () => {
		const res = await rpc(app, env.env, 'initialize', {}, token);
		const body = await res.json() as { result: { capabilities: { tools?: unknown; resources?: unknown; prompts?: unknown } } };
		expect(body.result.capabilities.tools).toBeDefined();
		expect(body.result.capabilities.resources).toBeDefined();
		expect(body.result.capabilities.prompts).toBeDefined();
	});

	it('lists 6 prompts via prompts/list', async () => {
		const res = await rpc(app, env.env, 'prompts/list', {}, token);
		const body = await res.json() as { result: { prompts: { name: string; arguments: unknown[] }[] } };
		expect(body.result.prompts).toHaveLength(6);
		const names = body.result.prompts.map((p) => p.name);
		expect(names).toContain('onboard_tenant');
		expect(names).toContain('explain_posture_gap');
		expect(names).toContain('qbr_summary');
	});

	it('prompts/get returns ready-to-use messages with the tenantId interpolated', async () => {
		const res = await rpc(app, env.env, 'prompts/get', {
			name: 'onboard_tenant',
			arguments: { tenantId: 'demo-tenant-acme' },
		}, token);
		const body = await res.json() as { result: { messages: { role: string; content: { text: string } }[] } };
		expect(body.result.messages).toHaveLength(1);
		expect(body.result.messages[0].content.text).toContain('demo-tenant-acme');
		expect(body.result.messages[0].content.text).toContain('apply_skill_template');
	});

	it('prompts/get returns -32602 for unknown prompt names', async () => {
		const res = await rpc(app, env.env, 'prompts/get', { name: 'nonexistent' }, token);
		const body = await res.json() as { error: { code: number } };
		expect(body.error.code).toBe(-32602);
	});

	it('GET / without Accept: text/event-stream returns 406', async () => {
		const res = await app.request('/api/mcp', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, env.env);
		expect(res.status).toBe(406);
	});

	it('GET / with Accept: text/event-stream returns an SSE stream', async () => {
		const res = await app.request('/api/mcp', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
		}, env.env);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
		const reader = res.body!.getReader();
		let combined = '';
		for (let i = 0; i < 4; i++) {
			const { value, done } = await reader.read();
			if (done) break;
			combined += new TextDecoder().decode(value);
			if (combined.includes('notifications/connected')) break;
		}
		expect(combined).toContain(': connected');
		expect(combined).toContain('notifications/connected');
		await reader.cancel();
	});

	it('write tools refuse callers without a write-eligible role', async () => {
		const viewerToken = await tokenFor({ sub: 'u-2', orgId: 'org-1', role: 'viewer' });
		const res = await rpc(app, env.env, 'tools/call', {
			name: 'acknowledge_alert',
			arguments: { tenantId: 't-1', alertId: 'a-1' },
		}, viewerToken);
		const body = await res.json() as { result: { content: { text: string }[] } };
		const parsed = JSON.parse(body.result.content[0].text);
		expect(parsed.error).toMatch(/forbidden/i);
	});

	it('returns -32601 for unknown methods', async () => {
		const res = await rpc(app, env.env, 'sampling/createMessage', {}, token);
		const body = await res.json() as { error: { code: number } };
		expect(body.error.code).toBe(-32601);
	});

	it('returns -32602 for unknown tool name in tools/call', async () => {
		const res = await rpc(app, env.env, 'tools/call', { name: 'made_up_tool', arguments: {} }, token);
		const body = await res.json() as { error: { code: number } };
		expect(body.error.code).toBe(-32602);
	});

	it('list_tenants queries DB with the caller\'s orgId', async () => {
		env.mockAll.mockResolvedValueOnce({ results: [{ id: 't-1', display_name: 'Acme' }] });
		const res = await rpc(app, env.env, 'tools/call', { name: 'list_tenants', arguments: {} }, token);
		expect(res.status).toBe(200);
		expect(env.mockBind).toHaveBeenCalledWith('org-1');
		const body = await res.json() as { result: { content: { text: string }[] } };
		const parsed = JSON.parse(body.result.content[0].text);
		expect(parsed.tenants[0].id).toBe('t-1');
	});

	it('get_cis_posture returns cached posture or a hint when none', async () => {
		env.mockKV.get.mockResolvedValueOnce(null);
		const res = await rpc(app, env.env, 'tools/call', { name: 'get_cis_posture', arguments: { tenantId: 't-1' } }, token);
		const body = await res.json() as { result: { content: { text: string }[] } };
		expect(body.result.content[0].text).toMatch(/run.*scan/i);
	});
});
