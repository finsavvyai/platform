import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { aiStreamingRoutes } from './ai-streaming';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})), desc: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({ getDb: () => mockDbChain }));

vi.mock('@tenantiq/db', () => ({
	getConversationById: vi.fn(async () => null),
	createConversation: vi.fn(async () => ({ id: 'conv-1' })),
	updateConversationMessages: vi.fn(async () => {}),
	getAlertCountsByTenant: vi.fn(async () => ({ total: 5, critical: 1, high: 2 })),
	getUsersByTenant: vi.fn(async () => [{ id: 'u1' }]),
	getTenantById: vi.fn(async () => ({ id: 't1', displayName: 'Test', domain: 'test.com', azureTenantId: 'az1' })),
	createAuditEntry: vi.fn(async () => {}),
}));

vi.mock('@tenantiq/ai', () => ({ tools: [] }));
vi.mock('../lib/ai-handlers', () => ({ handleToolCall: vi.fn() }));
vi.mock('../cron/user-sync', () => ({ createGraphClient: vi.fn(() => ({})) }));
vi.mock('@tenantiq/shared', () => ({
	aiChatMessageSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
}));
vi.mock('../lib/ai-suggested-actions', () => ({
	generateSuggestedActions: vi.fn(() => ['action1']),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };

function makeMockDb() {
	const chain = { bind: vi.fn(), first: vi.fn(), all: vi.fn(), run: vi.fn() };
	chain.bind.mockReturnValue(chain);
	chain.first.mockResolvedValue({ id: 't1' });
	chain.all.mockResolvedValue({ results: [] });
	chain.run.mockResolvedValue({ success: true });
	return { prepare: vi.fn(() => chain) };
}

const mockEnv = {
	DB: makeMockDb() as any, KV: mockKV as any,
	REMEDIATION_QUEUE: { send: vi.fn() } as any,
	JWT_SECRET,
	ANTHROPIC_API_KEY: 'test-key',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('AI Streaming Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/tenants/:tenantId/ai', aiStreamingRoutes);
		token = await createToken({ sub: 'u1', email: 'a@test.com', orgId: 'org-1', tenantIds: ['t1'], role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);

		// Mock global fetch for Anthropic API
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
			content: [{ type: 'text', text: 'Hello from AI' }],
			stop_reason: 'end_turn',
		}), { status: 200 })));
	});

	it('POST /stream returns SSE content-type', async () => {
		const res = await app.request('/api/tenants/t1/ai/stream', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'Hello' }),
		}, mockEnv);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/event-stream');
	});

	it('POST /stream requires authentication', async () => {
		const res = await app.request('/api/tenants/t1/ai/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'Hello' }),
		}, mockEnv);

		expect(res.status).toBe(401);
	});

	it('POST /stream requires tenant access', async () => {
		(mockEnv.DB.prepare('') as any).first.mockResolvedValueOnce(null);
		const noTenantToken = await createToken({ sub: 'u1', email: 'a@test.com', orgId: 'org-2', tenantIds: [], role: 'admin' });
		const res = await app.request('/api/tenants/t1/ai/stream', {
			method: 'POST',
			headers: { Authorization: `Bearer ${noTenantToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'Hello' }),
		}, mockEnv);

		expect([400, 403]).toContain(res.status);
	});

	it('POST /stream returns 503 without ANTHROPIC_API_KEY', async () => {
		const envNoKey = { ...mockEnv, ANTHROPIC_API_KEY: undefined };
		const res = await app.request('/api/tenants/t1/ai/stream', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'Hello' }),
		}, envNoKey);

		expect(res.status).toBe(503);
	});
});
