import { AuthUser } from '../types';

export interface ClerkUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
}

export interface ClerkConfig {
  publishableKey: string;
  secretKey?: string;
  apiUrl?: string;
}

export class ClerkAuthProvider {
  private publishableKey: string;
  private secretKey?: string;
  private apiUrl: string;

  constructor(config: ClerkConfig) {
    if (!config.publishableKey) {
      throw new Error('Clerk publishableKey is required');
    }
    this.publishableKey = config.publishableKey;
    this.secretKey = config.secretKey;
    this.apiUrl = config.apiUrl || 'https://api.clerk.com/v1';
  }

  verifyClerkToken(token: string): Promise<Record<string, unknown>> {
    if (!this.secretKey) {
      throw new Error('secretKey is required');
    }

    if (!token) {
      throw new Error('Token is required');
    }

    return this._performVerifyClerkToken(token);
  }

  private async _performVerifyClerkToken(
    token: string
  ): Promise<Record<string, unknown>> {

    const response = await fetch(`${this.apiUrl}/tokens/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error(`Clerk token verification failed: ${response.statusText}`);
    }

    return response.json();
  }

  getClerkUser(userId: string): Promise<ClerkUser> {
    if (!this.secretKey) {
      throw new Error('Clerk secretKey is required for user retrieval');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    return this._performGetClerkUser(userId);
  }

  private async _performGetClerkUser(userId: string): Promise<ClerkUser> {

    const response = await fetch(`${this.apiUrl}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Clerk user: ${response.statusText}`);
    }

    return response.json();
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const claims = await this.verifyClerkToken(token);
      const userId = claims.sub as string;

      if (!userId) {
        throw new Error('No user ID in token claims');
      }

      const clerkUser = await this.getClerkUser(userId);
      const email =
        clerkUser.emailAddresses?.[0]?.emailAddress || 'unknown@example.com';
      const role =
        (clerkUser.publicMetadata?.role as string) || 'user';

      return {
        id: userId,
        email,
        role: role as 'admin' | 'user' | 'guest',
        permissions: [],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Clerk verification failed: ${message}`);
    }
  }

  getPublishableKey(): string {
    return this.publishableKey;
  }
}

export function initClerk(config: ClerkConfig): ClerkAuthProvider {
  return new ClerkAuthProvider(config);
}
