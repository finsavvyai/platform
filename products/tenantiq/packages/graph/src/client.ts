/**
 * Microsoft Graph API HTTP client.
 * Handles token management, refresh, retry, and throttle handling.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface TokenStore {
	getToken(tenantId: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }>;
	setToken(tenantId: string, accessToken: string, refreshToken: string, expiresAt: number): Promise<void>;
}

interface GraphClientConfig {
	clientId: string;
	clientSecret: string;
	tokenStore: TokenStore;
}

export class GraphClient {
	private config: GraphClientConfig;

	constructor(config: GraphClientConfig) {
		this.config = config;
	}

	/**
	 * Make an authenticated request to the Microsoft Graph API.
	 */
	async request<T>(tenantId: string, path: string, options: RequestInit = {}): Promise<T> {
		const token = await this.getValidToken(tenantId);

		const response = await this.fetchWithRetry(`${GRAPH_BASE}${path}`, {
			...options,
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				...options.headers
			}
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new GraphApiError(
				(error as { error?: { message?: string } }).error?.message ?? `Graph API error: ${response.status}`,
				response.status
			);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Paginate through all results from a Graph API endpoint.
	 */
	async *paginate<T>(tenantId: string, path: string): AsyncGenerator<T[]> {
		let nextLink: string | undefined = `${GRAPH_BASE}${path}`;

		while (nextLink) {
			const token = await this.getValidToken(tenantId);
			const response = await this.fetchWithRetry(nextLink, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new GraphApiError(`Graph API pagination error: ${response.status}`, response.status);
			}

			const data = (await response.json()) as { value: T[]; '@odata.nextLink'?: string };
			yield data.value;
			nextLink = data['@odata.nextLink'];
		}
	}

	/**
	 * Get a valid access token, refreshing if needed.
	 */
	private async getValidToken(tenantId: string): Promise<string> {
		const stored = await this.config.tokenStore.getToken(tenantId);

		if (Date.now() < stored.expiresAt - 300_000) {
			// Token is valid for at least 5 more minutes
			return stored.accessToken;
		}

		// Refresh the token
		const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: this.config.clientId,
				client_secret: this.config.clientSecret,
				refresh_token: stored.refreshToken,
				grant_type: 'refresh_token'
			})
		});

		if (!response.ok) {
			throw new GraphApiError('Token refresh failed', 401);
		}

		const tokens = (await response.json()) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
		};

		const expiresAt = Date.now() + tokens.expires_in * 1000;
		await this.config.tokenStore.setToken(tenantId, tokens.access_token, tokens.refresh_token, expiresAt);

		return tokens.access_token;
	}

	/**
	 * Fetch with retry and 429 (throttle) handling.
	 */
	private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
		for (let attempt = 0; attempt <= retries; attempt++) {
			const response = await fetch(url, options);

			if (response.status === 429) {
				const retryAfter = parseInt(response.headers.get('Retry-After') ?? '10', 10);
				console.warn(`[Graph] Rate limited. Retrying after ${retryAfter}s (attempt ${attempt + 1}/${retries})`);
				await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
				continue;
			}

			if (response.status >= 500 && attempt < retries) {
				const delay = Math.pow(2, attempt) * 1000;
				console.warn(`[Graph] Server error ${response.status}. Retrying in ${delay}ms`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			return response;
		}

		throw new GraphApiError('Max retries exceeded', 503);
	}
}

export class GraphApiError extends Error {
	constructor(
		message: string,
		public statusCode: number
	) {
		super(message);
		this.name = 'GraphApiError';
	}
}
