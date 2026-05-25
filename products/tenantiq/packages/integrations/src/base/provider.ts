/**
 * Base integration provider — shared auth, retry, rate-limit, and sync patterns.
 * Each PSA provider (ConnectWise, Datto, Kaseya) extends this class.
 */
import type {
	PSAProvider, PSACompany, PSATicket, PSAAgreement,
	SyncResult, MappingEntityType,
} from './types';

export interface ProviderConfig {
	provider: PSAProvider;
	baseUrl: string;
	headers: Record<string, string>;
	maxRetries?: number;
	rateLimitPerMinute?: number;
}

export abstract class IntegrationProvider {
	protected config: ProviderConfig;
	private requestCount = 0;
	private windowStart = Date.now();

	constructor(config: ProviderConfig) {
		this.config = config;
	}

	/** HTTP request with retry and rate-limit */
	protected async request<T>(
		path: string,
		init: RequestInit = {},
	): Promise<T> {
		await this.enforceRateLimit();
		const maxRetries = this.config.maxRetries ?? 3;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const url = `${this.config.baseUrl}${path}`;
			const res = await fetch(url, {
				...init,
				headers: {
					'Content-Type': 'application/json',
					...this.config.headers,
					...init.headers,
				},
			});

			if (res.status === 429) {
				const wait = parseInt(res.headers.get('Retry-After') || '5', 10);
				await this.sleep(wait * 1000);
				continue;
			}

			if (res.status >= 500 && attempt < maxRetries) {
				await this.sleep(Math.pow(2, attempt) * 1000);
				continue;
			}

			if (!res.ok) {
				const body = await res.text().catch(() => '');
				throw new Error(
					`${this.config.provider} API error (${res.status}): ${body}`,
				);
			}

			return res.json() as Promise<T>;
		}

		throw new Error(`${this.config.provider}: max retries exceeded`);
	}

	/** Paginated fetch — override per provider for different pagination styles */
	protected async fetchAll<T>(
		path: string,
		pageSize = 100,
	): Promise<T[]> {
		const results: T[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			const separator = path.includes('?') ? '&' : '?';
			const data = await this.request<T[]>(
				`${path}${separator}pageSize=${pageSize}&page=${page}`,
			);
			results.push(...data);
			hasMore = data.length === pageSize;
			page++;
		}

		return results;
	}

	/** Test connection to the PSA */
	abstract testConnection(): Promise<{ ok: boolean; message: string }>;

	/** Fetch companies/accounts from PSA */
	abstract getCompanies(): Promise<PSACompany[]>;

	/** Create a service ticket in the PSA */
	abstract createTicket(ticket: Omit<PSATicket, 'id' | 'createdAt'>): Promise<PSATicket>;

	/** Update an existing ticket */
	abstract updateTicket(ticketId: string, updates: Partial<PSATicket>): Promise<PSATicket>;

	/** Fetch agreements/contracts from PSA */
	abstract getAgreements(companyId: string): Promise<PSAAgreement[]>;

	/** Create or update an agreement */
	abstract syncAgreement(agreement: Omit<PSAAgreement, 'id'>): Promise<PSAAgreement>;

	private async enforceRateLimit(): Promise<void> {
		const limit = this.config.rateLimitPerMinute ?? 120;
		const now = Date.now();

		if (now - this.windowStart > 60_000) {
			this.requestCount = 0;
			this.windowStart = now;
		}

		if (this.requestCount >= limit) {
			const waitMs = 60_000 - (now - this.windowStart);
			await this.sleep(waitMs);
			this.requestCount = 0;
			this.windowStart = Date.now();
		}

		this.requestCount++;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}
}

/** Helper: run sync and return result metrics */
export async function measureSync(
	provider: PSAProvider,
	entityType: MappingEntityType,
	fn: () => Promise<{ created: number; updated: number; failed: number; errors: string[] }>,
): Promise<SyncResult> {
	const start = Date.now();
	const result = await fn();
	return { provider, entityType, ...result, durationMs: Date.now() - start };
}
