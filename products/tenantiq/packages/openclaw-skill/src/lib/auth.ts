/**
 * OAuth2 Authentication for TenantIQ OpenClaw Skill
 */

import type { TenantIQConfig } from '../types';

export interface OAuth2Config {
	clientId: string;
	clientSecret: string;
	authorizationUrl: string;
	tokenUrl: string;
	redirectUri: string;
	scopes: string[];
}

export class OAuth2Handler {
	private oauth2Config: OAuth2Config;
	private apiUrl: string;

	constructor(apiUrl: string, oauth2Config: OAuth2Config) {
		this.apiUrl = apiUrl;
		this.oauth2Config = oauth2Config;
	}

	/**
	 * Generate OAuth2 authorization URL
	 */
	getAuthorizationUrl(state: string): string {
		const params = new URLSearchParams({
			client_id: this.oauth2Config.clientId,
			redirect_uri: this.oauth2Config.redirectUri,
			response_type: 'code',
			scope: this.oauth2Config.scopes.join(' '),
			state
		});

		return `${this.oauth2Config.authorizationUrl}?${params.toString()}`;
	}

	/**
	 * Exchange authorization code for access token
	 */
	async exchangeCodeForToken(code: string): Promise<{
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
	}> {
		const response = await fetch(this.oauth2Config.tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				client_id: this.oauth2Config.clientId,
				client_secret: this.oauth2Config.clientSecret,
				redirect_uri: this.oauth2Config.redirectUri
			})
		});

		if (!response.ok) {
			throw new Error('Failed to exchange authorization code for token');
		}

		const data = await response.json();

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in
		};
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshToken(refreshToken: string): Promise<{
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
	}> {
		const response = await fetch(this.oauth2Config.tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: this.oauth2Config.clientId,
				client_secret: this.oauth2Config.clientSecret
			})
		});

		if (!response.ok) {
			throw new Error('Failed to refresh access token');
		}

		const data = await response.json();

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token || refreshToken,
			expiresIn: data.expires_in
		};
	}

	/**
	 * Validate token and get user info
	 */
	async validateToken(accessToken: string): Promise<{
		userId: string;
		email: string;
		tenants: string[];
	}> {
		const response = await fetch(`${this.apiUrl}/auth/me`, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!response.ok) {
			throw new Error('Invalid or expired token');
		}

		const data = await response.json();

		return {
			userId: data.user.id,
			email: data.user.email,
			tenants: data.user.tenantIds || []
		};
	}

	/**
	 * Revoke token (logout)
	 */
	async revokeToken(accessToken: string): Promise<void> {
		await fetch(`${this.apiUrl}/auth/logout`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
	}
}

/**
 * Store and retrieve authentication configuration
 */
export class AuthStorage {
	private storageKey = 'tenantiq_auth';

	/**
	 * Save authentication data
	 */
	save(config: TenantIQConfig): void {
		// In OpenClaw, this would use the persistent storage API
		// For now, we'll use a placeholder
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(this.storageKey, JSON.stringify(config));
		}
	}

	/**
	 * Load authentication data
	 */
	load(): TenantIQConfig | null {
		if (typeof localStorage !== 'undefined') {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				return JSON.parse(data);
			}
		}
		return null;
	}

	/**
	 * Clear authentication data
	 */
	clear(): void {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(this.storageKey);
		}
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		const config = this.load();
		return !!(config?.accessToken);
	}
}
