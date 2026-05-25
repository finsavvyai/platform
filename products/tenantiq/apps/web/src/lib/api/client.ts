import { auth } from '$stores/auth';
import { tenant } from '$stores/tenant';
import { get } from 'svelte/store';
import { API_BASE } from '$lib/config';

export class SkillGateError extends Error {
	public readonly skillId: string;
	public readonly skillName: string;
	public readonly price: number;
	public readonly upgradeUrl: string;

	constructor(message: string, skillId: string, skillName: string, price: number, upgradeUrl: string) {
		super(message);
		this.name = 'SkillGateError';
		this.skillId = skillId;
		this.skillName = skillName;
		this.price = price;
		this.upgradeUrl = upgradeUrl;
	}
}

/** Thrown by api client when /api/remediations/execute returns 402
 *  LICENSE_UPGRADE_REQUIRED. Carries the upsell payload so the UI can
 *  render <UpsellCard {upsell} /> directly. */
export interface UpsellInfo {
	required: { display: string; reason: string; priceUsdPerUserPerMonth: number; anyOf: string[] };
	suggestedSeats: number;
	estimatedMonthlyCostUsd: number;
}

export class UpgradeRequiredError extends Error {
	public readonly upsell: UpsellInfo;
	constructor(message: string, upsell: UpsellInfo) {
		super(message);
		this.name = 'UpgradeRequiredError';
		this.upsell = upsell;
	}
}

interface RequestOptions {
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
}

interface SWREntry<T = unknown> { data: T; ts: number }

const SWR_MAX_AGE_MS = 60_000; // serve cached data for up to 60s

class ApiClient {
	private refreshing: Promise<string | null> | null = null;
	private swrCache = new Map<string, SWREntry>();

	/** Return cached data if fresh enough, and revalidate in background. */
	async getSWR<T>(path: string): Promise<T> {
		const entry = this.swrCache.get(path) as SWREntry<T> | undefined;
		const fresh = entry && Date.now() - entry.ts < SWR_MAX_AGE_MS;

		if (entry) {
			// Revalidate in background unless still fresh
			if (!fresh) {
				this.get<T>(path).then((data) => {
					this.swrCache.set(path, { data, ts: Date.now() });
				}).catch(() => {});
			}
			return entry.data;
		}

		// No cache — fetch and cache
		const data = await this.get<T>(path);
		this.swrCache.set(path, { data, ts: Date.now() });
		return data;
	}

	/** Invalidate SWR cache for a path (call after mutations). */
	invalidate(path: string) {
		this.swrCache.delete(path);
	}

	private getHeaders(extra?: Record<string, string>): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...extra
		};

		const tenantState = get(tenant);
		if (tenantState.currentTenantId) {
			headers['X-Tenant-Id'] = tenantState.currentTenantId;
		}

		return headers;
	}

	private async refreshToken(): Promise<boolean> {
		const authState = get(auth);
		if (!authState.user) return false;

		try {
			const response = await fetch(`${API_BASE}/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			});

			return response.ok;
		} catch {
			return false;
		}
	}

	async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const response = await fetch(`${API_BASE}${path}`, {
			method: options.method ?? 'GET',
			headers: this.getHeaders(options.headers),
			credentials: 'include',
			body: options.body ? JSON.stringify(options.body) : undefined
		});

		// Server signals "your JWT is stale" via this header (e.g., a tenant was
		// provisioned after sign-in). Refresh in the background so subsequent
		// requests take the fast path. Don't await — current request already succeeded.
		if (response.headers.get('X-Refresh-Session') === '1' && !this.refreshing) {
			this.refreshing = this.refreshToken().then((ok) => ok ? 'refreshed' : null).finally(() => {
				this.refreshing = null;
			});
		}

		// On 401, try to refresh the token and retry once
		if (response.status === 401) {
			// Unauthenticated visitor — no session to refresh, no redirect.
			// Caller's .catch handles it (e.g. layout's /auth/me probe → SignInHero).
			const hadSession = !!get(auth).user;
			if (!hadSession) {
				throw new Error('Unauthorized');
			}

			// Deduplicate concurrent refresh attempts
			if (!this.refreshing) {
				this.refreshing = this.refreshToken().then((ok) => ok ? 'refreshed' : null).finally(() => {
					this.refreshing = null;
				});
			}

			const result = await this.refreshing;
			if (result) {
				// Retry the original request (cookie is already updated)
				const retryResponse = await fetch(`${API_BASE}${path}`, {
					method: options.method ?? 'GET',
					headers: this.getHeaders(options.headers),
					credentials: 'include',
					body: options.body ? JSON.stringify(options.body) : undefined
				});

				if (retryResponse.ok) {
					return retryResponse.json();
				}
			}

			// Session expired for an authed user. Clear local auth state and
			// let the SvelteKit layout render SignInHero instead of bouncing
			// to /auth/login. The hard redirect caused a Microsoft-OAuth loop:
			// MS → callback → cookie set → dashboard fires API → 401 → redirect
			// → MS again, because the API cookie was rejected by the request
			// (CORS / cross-subdomain), not because the session was actually
			// expired. Letting SignInHero render breaks the loop visibly.
			auth.clear();
			throw new Error('Session expired');
		}

		if (!response.ok) {
			const body = await response.json().catch(() => ({ message: 'Request failed' }));
			if (response.status === 403 && body.skillId) {
				const err = new SkillGateError(body.error, body.skillId, body.skillName, body.price, body.upgradeUrl);
				throw err;
			}
			if (response.status === 402 && body.code === 'LICENSE_UPGRADE_REQUIRED' && body.upsell) {
				throw new UpgradeRequiredError(body.message ?? body.error ?? 'License upgrade required', body.upsell as UpsellInfo);
			}
			throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
		}

		return response.json();
	}

	get<T>(path: string) {
		return this.request<T>(path);
	}

	post<T>(path: string, body?: unknown) {
		return this.request<T>(path, { method: 'POST', body });
	}

	patch<T>(path: string, body?: unknown) {
		return this.request<T>(path, { method: 'PATCH', body });
	}

	delete<T>(path: string) {
		return this.request<T>(path, { method: 'DELETE' });
	}
}

export const api = new ApiClient();
