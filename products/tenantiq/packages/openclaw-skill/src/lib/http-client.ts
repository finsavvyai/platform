/**
 * Base HTTP client with authentication and token management
 */

import type { TenantIQConfig } from '../types';

export class BaseHttpClient {
	protected config: TenantIQConfig;

	constructor(config: TenantIQConfig) {
		this.config = config;
	}

	/**
	 * Make authenticated request to TenantIQ API
	 */
	protected async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${this.config.apiUrl}${endpoint}`;

		// Check if token is expired and refresh if needed
		if (this.config.tokenExpiresAt && Date.now() > this.config.tokenExpiresAt) {
			await this.refreshAccessToken();
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(options.headers as Record<string, string> | undefined)
		};

		if (this.config.accessToken) {
			headers['Authorization'] = `Bearer ${this.config.accessToken}`;
		}

		if (this.config.activeTenantId) {
			headers['X-Tenant-Id'] = this.config.activeTenantId;
		}

		const response = await fetch(url, {
			...options,
			headers
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Refresh OAuth2 access token
	 */
	private async refreshAccessToken(): Promise<void> {
		if (!this.config.refreshToken) {
			throw new Error('No refresh token available. Please re-authenticate.');
		}

		const response = await fetch(`${this.config.apiUrl}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				refresh_token: this.config.refreshToken
			})
		});

		if (!response.ok) {
			throw new Error('Failed to refresh access token. Please re-authenticate.');
		}

		const data = await response.json();
		this.config.accessToken = data.access_token;
		this.config.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
	}

	/**
	 * Update active tenant
	 */
	setActiveTenant(tenantId: string): void {
		this.config.activeTenantId = tenantId;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): TenantIQConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<TenantIQConfig>): void {
		this.config = { ...this.config, ...updates };
	}
}
