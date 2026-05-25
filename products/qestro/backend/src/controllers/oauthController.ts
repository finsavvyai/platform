import { Request, Response } from 'express';
import { OAuthService } from '../services/OAuthService.js';
import { z } from 'zod';

const authUrlSchema = z.object({
  provider: z.enum(['github', 'azure']),
  redirect_uri: z.string().url().optional()
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
  provider: z.enum(['github', 'azure'])
});

export const getOAuthUrl = async (req: Request, res: Response) => {
  try {
    const { provider, redirect_uri } = authUrlSchema.parse(req.query);

    // Generate secure state for CSRF protection
    const state = OAuthService.generateState();

    // Store state (in production, use Redis or session)
    OAuthService.storeState(state, provider);

    let authUrl: string;

    if (provider === 'github') {
      authUrl = OAuthService.getGitHubAuthUrl(state);
    } else if (provider === 'azure') {
      authUrl = OAuthService.getAzureAuthUrl(state);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported OAuth provider'
      });
    }

    res.json({
      success: true,
      data: {
        authUrl,
        state,
        provider
      }
    });

  } catch (error) {
    console.error('OAuth URL generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate OAuth URL'
    });
  }
};

export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, provider } = callbackSchema.parse(req.body);

    let result;

    if (provider === 'github') {
      result = await OAuthService.handleGitHubCallback(code, state);
    } else if (provider === 'azure') {
      result = await OAuthService.handleAzureCallback(code, state);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported OAuth provider'
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Successfully authenticated with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
    });

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'OAuth authentication failed'
    });
  }
};

export const getOAuthConnections = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const connections = await OAuthService.getUserOAuthConnections(userId);

    res.json({
      success: true,
      data: connections
    });

  } catch (error) {
    console.error('Get OAuth connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OAuth connections'
    });
  }
};

export const disconnectOAuth = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { provider } = z.object({
      provider: z.enum(['github', 'azure'])
    }).parse(req.body);

    await OAuthService.disconnectOAuth(userId, provider);

    res.json({
      success: true,
      message: `Successfully disconnected ${provider} account`
    });

  } catch (error) {
    console.error('Disconnect OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect OAuth account'
    });
  }
};

// OAuth provider information for frontend
export const getOAuthProviders = async (req: Request, res: Response) => {
  try {
    const providers = [
      {
        id: 'github',
        name: 'GitHub',
        description: 'Connect with your GitHub account',
        icon: 'github',
        enabled: !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET
      },
      {
        id: 'azure',
        name: 'Microsoft 365',
        description: 'Connect with your Microsoft account',
        icon: 'microsoft',
        enabled: !!process.env.AZURE_CLIENT_ID && !!process.env.AZURE_CLIENT_SECRET && !!process.env.AZURE_TENANT_ID
      }
    ];

    res.json({
      success: true,
      data: providers
    });

  } catch (error) {
    console.error('Get OAuth providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OAuth providers'
    });
  }
};
