import { Hono } from 'hono';
import * as jose from 'jose';
import { vi } from 'vitest';
import type { AppEnv } from '../index';

export const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
export const ISSUER = 'https://api.tenantiq.app';
export const AUDIENCE = 'tenantiq-api';

export function createMcpTestEnv() {
	const mockKV = { get: vi.fn(), put: vi.fn() };
	const mockAll = vi.fn().mockResolvedValue({ results: [] });
	const mockRun = vi.fn().mockResolvedValue({});
	const mockBind = vi.fn().mockReturnValue({ all: mockAll, run: mockRun });
	const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
	const mockDB = { prepare: mockPrepare } as any;
	const env = {
		DB: mockDB,
		KV: mockKV as any,
		JWT_SECRET,
		ENVIRONMENT: 'test',
		JWT_ISSUER: ISSUER,
		JWT_AUDIENCE: AUDIENCE,
	} as any;
	return { env, mockKV, mockPrepare, mockBind, mockAll, mockRun };
}

export async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setExpirationTime('1h')
		.sign(secret);
}

export async function rpc(
	app: Hono<AppEnv>,
	env: any,
	method: string,
	params?: Record<string, unknown>,
	token?: string,
) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;
	return app.request(
		'/api/mcp',
		{
			method: 'POST',
			headers,
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
		},
		env,
	);
}
