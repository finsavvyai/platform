/**
 * Vendored @opensyber/tokenforge/server middleware — inline until the upstream
 * package ships a dist without the broken ./trust-score.js import chain.
 *
 * Source: @opensyber/tokenforge@0.1.1 dist/server/middleware.js
 * License: Same as @opensyber/tokenforge (SEE LICENSE IN LICENSE.md).
 */

import type { Context, Next, MiddlewareHandler } from 'hono';

const DEFAULT_API_BASE = 'https://tokenforge-api.opensyber.cloud';

export interface TokenForgeOptions {
	apiKey: string;
	apiBase?: string;
	skipPaths?: string[];
	sensitiveOps?: string[];
	allowThreshold?: number;
	stepUpThreshold?: number;
}

interface EdgeVerifyResponse {
	data: {
		status: 'allow' | 'step_up' | 'block' | 'degraded';
		trustScore: number;
		deviceId: string | null;
		bound: boolean;
		reason?: string;
		userId?: string;
		sessionId?: string;
	};
}

function shouldSkip(path: string, skipPaths?: string[]): boolean {
	if (!skipPaths) return false;
	return skipPaths.some((pattern) => {
		if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
		return path === pattern;
	});
}

function isSensitiveOp(path: string, method: string, patterns?: string[]): boolean {
	if (!patterns) return false;
	if (method === 'GET') return false;
	return patterns.some((pattern) => {
		if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
		return path === pattern;
	});
}

export function opensyberTokenForge(options: TokenForgeOptions): MiddlewareHandler {
	const apiBase = options.apiBase ?? DEFAULT_API_BASE;

	return async (c: Context, next: Next) => {
		if (shouldSkip(c.req.path, options.skipPaths)) return next();

		const headers = {
			signature: c.req.header('X-TF-Signature') ?? null,
			nonce: c.req.header('X-TF-Nonce') ?? null,
			timestamp: c.req.header('X-TF-Timestamp') ?? null,
			deviceId: c.req.header('X-TF-Device-ID') ?? null,
		};

		let data: EdgeVerifyResponse['data'];
		try {
			const res = await fetch(`${apiBase}/v1/edge/verify`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${options.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					path: c.req.path,
					method: c.req.method,
					headers,
					ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
					countryCode: c.req.header('cf-ipcountry') ?? '',
					userAgent: c.req.header('user-agent') ?? '',
				}),
			});

			if (!res.ok) {
				console.error('[TokenForge] API error:', res.status);
				c.set('tf' as never, { bound: false, trustScore: 0, deviceId: null } as never);
				return next();
			}

			data = ((await res.json()) as EdgeVerifyResponse).data;
		} catch (err) {
			console.error('[TokenForge] API unreachable:', err);
			c.set('tf' as never, { bound: false, trustScore: 0, deviceId: null } as never);
			return next();
		}

		if (data.status === 'block') {
			return c.json({ error: 'session_blocked', reason: data.reason, trustScore: data.trustScore }, 401);
		}

		const sensitive = isSensitiveOp(c.req.path, c.req.method, options.sensitiveOps);
		if (data.status === 'step_up' && sensitive) {
			return c.json({ error: 'elevated_trust_required', action: 'step_up_required', trustScore: data.trustScore }, 403);
		}

		if (sensitive && data.trustScore < 90) {
			return c.json({ error: 'elevated_trust_required', action: 'step_up_required', trustScore: data.trustScore }, 403);
		}

		c.set('tf' as never, { bound: data.bound, trustScore: data.trustScore, deviceId: data.deviceId } as never);
		return next();
	};
}
