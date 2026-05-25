import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { aiExportRoutes } from './ai-export';

// ─── Mocks ───────────────────────────────────────────────────────────────────
let queryResults: any[];
const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values', 'returning'];
const mockDbChain: any = {};
for (const m of chainMethods) mockDbChain[m] = vi.fn(() => mockDbChain);
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); }, configurable: true
});

const kvStore: Record<string, string> = {};
const mockKV = {
	get: vi.fn((key: string) => { const v = kvStore[key]; if (!v) return null; try { return JSON.parse(v); } catch { return v; } }),
	put: vi.fn((key: string, value: string) => { kvStore[key] = value; })
};
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
function makeMockDb() {
	const chain = { bind: vi.fn(), first: vi.fn(), all: vi.fn(), run: vi.fn() };
	chain.bind.mockReturnValue(chain);
	chain.first.mockResolvedValue({ id: 'tenant-1' });
	chain.all.mockResolvedValue({ results: [] });
	chain.run.mockResolvedValue({ success: true });
	return { prepare: vi.fn(() => chain) };
}
const mockEnv = { DB: makeMockDb() as any, KV: mockKV as any, REMEDIATION_QUEUE: { send: vi.fn() } as any, JWT_SECRET, FRONTEND_URL: 'https://app.tenantiq.com' };

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn((..._: any[]) => ({})), desc: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: { aiConversations: { id: {}, tenantId: {}, userEmail: {}, messages: {}, updatedAt: {} }, auditLog: { id: {}, tenantId: {}, actor: {}, action: {}, details: {}, createdAt: {} } }
}));

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

// D1 stores `messages` as JSON text; getConversationById parses it before returning.
const sampleConversation = {
	id: 'conv-1', tenantId: 'tenant-1', userId: 'admin@test.com',
	messages: JSON.stringify([
		{ role: 'user', content: 'What are my top risks?' },
		{ role: 'assistant', content: 'Your tenant has 3 critical security issues.' },
	]),
	createdAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000),
};

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('AI Export Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		Object.keys(kvStore).forEach((k) => delete kvStore[k]);
		app = new Hono<AppEnv>();
		app.route('/', aiExportRoutes);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin' });
		mockKV.get.mockImplementation((key: string) => { const v = kvStore[key]; if (!v) return null; try { return JSON.parse(v); } catch { return v; } });
		mockKV.put.mockImplementation((key: string, value: string) => { kvStore[key] = value; });
	});

	describe('GET /conversations/:id/export', () => {
		it('should export conversation as markdown by default', async () => {
			queryResults = [[sampleConversation]];
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/conv-1/export',
				{ method: 'GET', headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain('# TenantIQ Conversation Export');
			expect(text).toContain('### User');
			expect(text).toContain('### Assistant');
			expect(text).toContain('What are my top risks?');
		});

		it('should export conversation as JSON when format=json', async () => {
			queryResults = [[sampleConversation]];
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/conv-1/export?format=json',
				{ method: 'GET', headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.conversationId).toBe('conv-1');
			expect(json.exportedAt).toBeDefined();
			expect(json.messages).toHaveLength(2);
			expect(json.messages[0].role).toBe('user');
		});

		it('should return 404 for non-existent conversation', async () => {
			queryResults = [[]];
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/missing/export',
				{ method: 'GET', headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(404);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/conv-1/export', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /conversations/:id/share', () => {
		it('should create a shareable link with expiry', async () => {
			queryResults = [[sampleConversation], undefined];
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/conv-1/share',
				{ method: 'POST', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' } }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.shareUrl).toContain('/api/shared/conversations/');
			expect(json.expiresAt).toBeDefined();
			expect(mockKV.put).toHaveBeenCalled();
		});

		it('should return 404 for non-existent conversation', async () => {
			queryResults = [[]];
			const res = await app.request('/api/tenants/tenant-1/ai/conversations/missing/share',
				{ method: 'POST', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' } }, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /shared/conversations/:token', () => {
		it('should return conversation without auth', async () => {
			mockKV.get
				.mockResolvedValueOnce(null) // rate-limit counter (no prior requests)
				.mockResolvedValueOnce({
					// Shared-link payload stored in KV keeps messages as an array (not JSON-serialized like the D1 column).
					conversationId: 'conv-1',
					messages: JSON.parse(sampleConversation.messages),
					sharedBy: 'admin@test.com',
				});
			const res = await app.request('/api/shared/conversations/test-token-123', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.conversationId).toBe('conv-1');
			expect(json.readOnly).toBe(true);
			expect(json.messages).toHaveLength(2);
		});

		it('should return 404 for expired or invalid token', async () => {
			mockKV.get
				.mockResolvedValueOnce(null) // rate-limit counter
				.mockResolvedValueOnce(null); // shared conversation not found
			const res = await app.request('/api/shared/conversations/invalid-token', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(404);
			const json: any = await res.json();
			expect(json.error).toContain('expired');
		});
	});
});
