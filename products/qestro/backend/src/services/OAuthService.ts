import axios from 'axios';
import crypto from 'crypto';
import { db } from '../database/database.js';
import { users, oauthAccounts } from '../schema/index.js';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  username?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

export class OAuthService {
  // In-memory state store with TTL (use Redis in production for multi-instance)
  private static stateStore = new Map<string, { provider: string; expiresAt: number }>();
  private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  // GitHub OAuth configuration
  private static githubConfig = {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: process.env.GITHUB_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/github/callback`,
    scope: 'user:email',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    userEmailUrl: 'https://api.github.com/user/emails'
  };

  // Azure AD OAuth configuration
  private static azureConfig = {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    tenantId: process.env.AZURE_TENANT_ID!,
    redirectUri: process.env.AZURE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/azure/callback`,
    scope: 'openid profile email',
    authUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    userUrl: 'https://graph.microsoft.com/v1.0/me'
  };

  // Google OAuth configuration
  private static googleConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/google/callback`,
    scope: 'openid email profile',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://www.googleapis.com/oauth2/v3/userinfo'
  };

  static generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static storeState(state: string, provider: string): void {
    // Clean expired entries periodically
    const now = Date.now();
    for (const [key, val] of this.stateStore) {
      if (val.expiresAt < now) this.stateStore.delete(key);
    }
    this.stateStore.set(state, { provider, expiresAt: now + this.STATE_TTL_MS });
  }

  static verifyState(state: string, provider: string): boolean {
    const entry = this.stateStore.get(state);
    if (!entry) return false;
    this.stateStore.delete(state); // one-time use
    return entry.provider === provider && entry.expiresAt > Date.now();
  }

  // GitHub OAuth
  static getGitHubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.githubConfig.clientId,
      redirect_uri: this.githubConfig.redirectUri,
      scope: this.githubConfig.scope,
      state,
      response_type: 'code'
    });

    return `${this.githubConfig.authUrl}?${params.toString()}`;
  }

  static async handleGitHubCallback(code: string, state: string): Promise<{ user: any; tokens: any }> {
    // Verify state for CSRF protection
    if (!this.verifyState(state, 'github')) {
      throw new Error('Invalid state parameter');
    }

    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken('github', code);

    // Get user information from GitHub
    const userInfo = await this.getGitHubUserInfo(tokenResponse.access_token);

    // Find or create user
    const user = await this.findOrCreateUser('github', userInfo, tokenResponse);

    // Generate JWT tokens
    const jwtTokens = this.generateJWTTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        authMethod: user.authMethod
      },
      tokens: jwtTokens
    };
  }

  private static async exchangeCodeForToken(provider: string, code: string): Promise<OAuthTokens> {
    let tokenUrl: string;
    let params: URLSearchParams;

    if (provider === 'github') {
      tokenUrl = this.githubConfig.tokenUrl;
      params = new URLSearchParams({
        client_id: this.githubConfig.clientId,
        client_secret: this.githubConfig.clientSecret,
        code,
        redirect_uri: this.githubConfig.redirectUri
      });
    } else if (provider === 'azure') {
      tokenUrl = this.azureConfig.tokenUrl;
      params = new URLSearchParams({
        client_id: this.azureConfig.clientId,
        client_secret: this.azureConfig.clientSecret,
        code,
        redirect_uri: this.azureConfig.redirectUri,
        grant_type: 'authorization_code',
        scope: this.azureConfig.scope
      });
    } else if (provider === 'google') {
      tokenUrl = this.googleConfig.tokenUrl;
      params = new URLSearchParams({
        client_id: this.googleConfig.clientId,
        client_secret: this.googleConfig.clientSecret,
        code,
        redirect_uri: this.googleConfig.redirectUri,
        grant_type: 'authorization_code'
      });
    } else {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  }

  private static async getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Get user profile
    const userResponse = await axios.get(this.githubConfig.userUrl, {
      headers: {
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'Questro'
      }
    });

    const githubUser = userResponse.data;

    // Get user emails (GitHub requires separate API call for emails)
    const emailResponse = await axios.get(this.githubConfig.userEmailUrl, {
      headers: {
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'Questro'
      }
    });

    const emails = emailResponse.data;
    const primaryEmail = emails.find((email: any) => email.primary && email.verified);

    if (!primaryEmail) {
      throw new Error('No verified primary email found');
    }

    return {
      id: githubUser.id.toString(),
      email: primaryEmail.email,
      name: githubUser.name,
      username: githubUser.login,
      avatar: githubUser.avatar_url
    };
  }

  private static async findOrCreateUser(
    provider: string,
    userInfo: OAuthUserInfo,
    tokens: OAuthTokens
  ): Promise<any> {
    // Check if OAuth account already exists
    const existingOAuthAccount = await db.select()
      .from(oauthAccounts)
      .where(and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, userInfo.id)
      ))
      .limit(1);

    if (existingOAuthAccount.length > 0) {
      // Update OAuth tokens
      await db.update(oauthAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
          scope: tokens.scope,
          tokenType: tokens.token_type,
          updatedAt: new Date()
        })
        .where(eq(oauthAccounts.id, existingOAuthAccount[0].id));

      // Return existing user
      const user = await db.select()
        .from(users)
        .where(eq(users.id, existingOAuthAccount[0].userId))
        .limit(1);

      return user[0];
    }

    // Check if user with same email exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, userInfo.email))
      .limit(1);

    let user: any;

    if (existingUser.length > 0) {
      // Link OAuth account to existing user
      user = existingUser[0];

      await db.insert(oauthAccounts).values({
        userId: user.id,
        provider,
        providerAccountId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Create new user
      const nameParts = userInfo.name?.split(' ') || [userInfo.username || ''];
      const [firstName, lastName] = [nameParts[0], nameParts.slice(1).join(' ')];

      const [newUser] = await db.insert(users).values({
        email: userInfo.email,
        password: null, // OAuth users don't have passwords
        firstName,
        lastName,
        avatar: userInfo.avatar,
        authMethod: provider,
        isEmailVerified: true, // OAuth providers verify emails
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      user = newUser;

      // Create OAuth account record
      await db.insert(oauthAccounts).values({
        userId: user.id,
        provider,
        providerAccountId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return user;
  }

  // Azure AD OAuth
  static getAzureAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.azureConfig.clientId,
      response_type: 'code',
      redirect_uri: this.azureConfig.redirectUri,
      scope: this.azureConfig.scope,
      state,
      response_mode: 'query'
    });

    return `${this.azureConfig.authUrl}?${params.toString()}`;
  }

  static async handleAzureCallback(code: string, state: string): Promise<{ user: any; tokens: any }> {
    // Verify state for CSRF protection
    if (!this.verifyState(state, 'azure')) {
      throw new Error('Invalid state parameter');
    }

    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken('azure', code);

    // Get user information from Azure AD
    const userInfo = await this.getAzureUserInfo(tokenResponse.access_token);

    // Find or create user
    const user = await this.findOrCreateUser('azure', userInfo, tokenResponse);

    // Generate JWT tokens
    const jwtTokens = this.generateJWTTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        authMethod: user.authMethod
      },
      tokens: jwtTokens
    };
  }

  private static async getAzureUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await axios.get(this.azureConfig.userUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const azureUser = response.data;

    return {
      id: azureUser.id,
      email: azureUser.mail || azureUser.userPrincipalName,
      name: azureUser.displayName,
      avatar: null // Azure AD doesn't provide profile photos by default
    };
  }

  private static generateJWTTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Google OAuth
  static getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId,
      redirect_uri: this.googleConfig.redirectUri,
      response_type: 'code',
      scope: this.googleConfig.scope,
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.googleConfig.authUrl}?${params.toString()}`;
  }

  static async handleGoogleCallback(code: string, state: string): Promise<{ user: any; tokens: any }> {
    if (!this.verifyState(state, 'google')) {
      throw new Error('Invalid state parameter');
    }

    const tokenResponse = await this.exchangeCodeForToken('google', code);
    const userInfo = await this.getGoogleUserInfo(tokenResponse.access_token);
    const user = await this.findOrCreateUser('google', userInfo, tokenResponse);
    const jwtTokens = this.generateJWTTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        authMethod: user.authMethod
      },
      tokens: jwtTokens
    };
  }

  private static async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await axios.get(this.googleConfig.userUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const googleUser = response.data;

    return {
      id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture
    };
  }

  // Disconnect OAuth account
  static async disconnectOAuth(userId: string, provider: string): Promise<void> {
    await db.delete(oauthAccounts)
      .where(and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, provider)
      ));

    // If user has no other auth methods, update their auth method
    const remainingOAuthAccounts = await db.select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId))
      .limit(1);

    if (remainingOAuthAccounts.length === 0) {
      await db.update(users)
        .set({ authMethod: 'email' })
        .where(eq(users.id, userId));
    }
  }

  // Get user's OAuth connections
  static async getUserOAuthConnections(userId: string): Promise<any[]> {
    return await db.select({
      provider: oauthAccounts.provider,
      providerAccountId: oauthAccounts.providerAccountId,
      createdAt: oauthAccounts.createdAt
    })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));
  }
}
