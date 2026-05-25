import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SDLCAuth } from './auth';
import { AuthConfig } from './types';
import { validateRegistration, validateLogin } from './validation';
import { RegistrationRequest } from './types';

export function createAuthRoutes(config: AuthConfig): Hono {
  const auth = new SDLCAuth(config);
  const app = new Hono();

  // CORS middleware
  app.use('/*', cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  }));

  // Health check
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      service: 'sdlc-auth',
      timestamp: new Date().toISOString()
    });
  });

  // Registration endpoint
  app.post('/register', async (c) => {
    try {
      const body = await c.req.json() as RegistrationRequest;

      // Validate input
      const errors = validateRegistration(
        body.email,
        body.password,
        body.name,
        body.tier
      );

      if (errors.length > 0) {
        return c.json({
          error: 'Validation failed',
          errors
        }, 400);
      }

      // Create user
      const result = await auth.register(body);

      return c.json({
        success: true,
        message: 'User registered successfully',
        data: result
      }, 201);
    } catch (error) {
      console.error('Registration error:', error);
      return c.json({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  });

  // Login endpoint
  app.post('/login', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password, rememberMe } = body;

      // Validate input
      const errors = validateLogin(email, password);
      if (errors.length > 0) {
        return c.json({
          error: 'Validation failed',
          errors
        }, 400);
      }

      // Login user
      const result = await auth.login(email, password, rememberMe);

      // Set refresh token in secure cookie
      c.header('Set-Cookie', `refreshToken=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

      return c.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return c.json({
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Invalid credentials'
      }, 401);
    }
  });

  // Refresh token endpoint
  app.post('/refresh', async (c) => {
    try {
      const refreshToken = c.req.header('Cookie')?.match(/refreshToken=([^;]+)/)?.[1];

      if (!refreshToken) {
        return c.json({ error: 'No refresh token provided' }, 401);
      }

      const result = await auth.refreshToken(refreshToken);

      return c.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return c.json({
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Invalid refresh token'
      }, 401);
    }
  });

  // Logout endpoint
  app.post('/logout', async (c) => {
    try {
      // Clear refresh token cookie
      c.header('Set-Cookie', 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

      return c.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return c.json({
        error: 'Logout failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  // Get current user
  app.get('/me', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return c.json({ error: 'No token provided' }, 401);
      }

      const user = await auth.verifyToken(token);

      return c.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      return c.json({
        error: 'Failed to get current user',
        message: error instanceof Error ? error.message : 'Invalid token'
      }, 401);
    }
  });

  // Check feature access
  app.get('/check-access/:feature', async (c) => {
    try {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      const feature = c.req.param('feature');

      if (!token) {
        return c.json({ error: 'No token provided' }, 401);
      }

      if (!feature) {
        return c.json({ error: 'Feature parameter is required' }, 400);
      }

      const user = await auth.verifyToken(token);
      const hasAccess = await auth.hasFeatureAccess(user.id, feature as keyof import('./types').FeatureAccess);

      return c.json({
        success: true,
        data: {
          hasAccess,
          feature,
          tier: user.tier,
          features: user.features
        }
      });
    } catch (error) {
      console.error('Check access error:', error);
      return c.json({
        error: 'Failed to check access',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    }, 500);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: 'Not found',
      message: `Route ${c.req.method} ${c.req.path} not found`
    }, 404);
  });

  return app;
}

// Helper function to initialize auth server
export function initAuthServer(config: AuthConfig, port: number = 8787) {
  createAuthRoutes(config);

  const server = {
    start: () => {
      console.log(`🔐 SDLC Auth Server starting on port ${port}`);
      return fetch(`http://localhost:${port}/health`);
    },
    stop: () => {
      // Implementation for stopping server
      console.log('🔐 SDLC Auth Server stopped');
    }
  };

  return server;
}