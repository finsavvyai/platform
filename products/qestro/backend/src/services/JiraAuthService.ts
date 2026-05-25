// Jira Authentication Service
// Handles OAuth 2.0 (3LO) authentication flow with Jira

import crypto from 'crypto';

interface JiraTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

interface JiraResource {
    id: string;
    url: string;
    name: string;
    scopes: string[];
    avatarUrl: string;
}

export class JiraAuthService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    constructor() {
        this.clientId = process.env.JIRA_CLIENT_ID || '';
        this.clientSecret = process.env.JIRA_CLIENT_SECRET || '';
        this.redirectUri = process.env.JIRA_REDIRECT_URI || 'http://localhost:8000/api/jira/auth/callback';
    }

    /**
     * Generate authorization URL for OAuth flow
     */
    getAuthorizationURL(state?: string): string {
        const generatedState = state || this.generateState();

        const params = new URLSearchParams({
            audience: 'api.atlassian.com',
            client_id: this.clientId,
            scope: 'read:jira-work read:jira-user write:jira-work offline_access',
            redirect_uri: this.redirectUri,
            state: generatedState,
            response_type: 'code',
            prompt: 'consent',
        });

        return `https://auth.atlassian.com/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<JiraTokens> {
        const response = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to exchange code for token: ${error}`);
        }

        return response.json();
    }

    /**
     * Refresh expired access token
     */
    async refreshAccessToken(refreshToken: string): Promise<JiraTokens> {
        const response = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to refresh token: ${error}`);
        }

        return response.json();
    }

    /**
     * Get accessible Jira resources (sites) for the authenticated user
     */
    async getAccessibleResources(accessToken: string): Promise<JiraResource[]> {
        const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get accessible resources: ${error}`);
        }

        return response.json();
    }

    /**
     * Verify if token is still valid
     */
    isTokenExpired(expiresAt: number): boolean {
        return Date.now() >= expiresAt;
    }

    /**
     * Generate random state for OAuth flow
     */
    private generateState(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Encrypt sensitive data (tokens)
     */
    encrypt(text: string): string {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-replace-in-production', 'utf-8');
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key.slice(0, 32), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return `${iv.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt sensitive data (tokens)
     */
    decrypt(encryptedText: string): string {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-replace-in-production', 'utf-8');

        const [ivHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');

        const decipher = crypto.createDecipheriv(algorithm, key.slice(0, 32), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

export const jiraAuthService = new JiraAuthService();
