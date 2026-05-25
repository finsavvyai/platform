/**
 * Authentication routes for Cloudflare Workers
 */

import { corsHeaders } from '../utils/cors.js';
import { signJWT } from '../utils/jwt.js';

export async function authRoutes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/auth', '');

  switch (path) {
    case '/login':
      return handleLogin(request, env);
    case '/register':
      return handleRegister(request, env);
    case '/refresh':
      return handleRefreshToken(request, env);
    case '/logout':
      return handleLogout(request, env);
    case '/me':
      return handleGetProfile(request, env);
    default:
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Auth endpoint not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
  }
}

async function handleLogin(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Email and password are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const configError = validateAuthConfig(env);
    if (configError) {
      return configError;
    }

    const user = await findUserByEmail(email, env);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const token = await signJWT({
      email: user.email,
      role: user.role,
      name: user.name
    }, env.JWT_SECRET, { expiresIn: 3600 });

    const refreshToken = generateRefreshToken();

    return new Response(JSON.stringify({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          email: user.email,
          role: user.role,
          name: user.name
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Bad Request',
      message: 'Invalid JSON'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
}

async function handleRegister(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Email, password, and name are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const configError = validateAuthConfig(env);
    if (configError) {
      return configError;
    }

    if (!env?.AUTH_ALLOW_REGISTER) {
      return new Response(JSON.stringify({
        error: 'Not Implemented',
        message: 'Registration is disabled'
      }), {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const passwordHash = await hashPassword(password);
    try {
      await storeUser({
        email,
        name,
        role: 'user',
        passwordHash
      }, env);
    } catch (storeError) {
      return new Response(JSON.stringify({
        error: 'Service Unavailable',
        message: 'User store not configured'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const token = await signJWT({ email, role: 'user', name }, env.JWT_SECRET, { expiresIn: 3600 });
    const refreshToken = generateRefreshToken();

    return new Response(JSON.stringify({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          email,
          role: 'user',
          name
        }
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Bad Request',
      message: 'Invalid JSON'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
}

async function handleRefreshToken(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Refresh token is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const configError = validateAuthConfig(env);
    if (configError) {
      return configError;
    }

    if (!env?.AUTH_ALLOW_REFRESH) {
      return new Response(JSON.stringify({
        error: 'Not Implemented',
        message: 'Refresh tokens are disabled'
      }), {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      });
    }

    const token = await signJWT({ email: 'user@quantumbeam.io', role: 'user' }, env.JWT_SECRET, { expiresIn: 3600 });

    return new Response(JSON.stringify({
      success: true,
      data: {
        token
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Bad Request',
      message: 'Invalid JSON'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
}

async function handleLogout(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Logged out successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

async function handleGetProfile(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  if (!request.user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Missing user context'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      user: request.user
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function generateRefreshToken() {
  // In a real implementation, generate a proper refresh token
  return crypto.randomUUID();
}

function isProduction(env) {
  return env?.ENVIRONMENT === 'production' || env?.ENVIRONMENT === 'staging';
}

function validateAuthConfig(env) {
  if (!env?.JWT_SECRET) {
    return new Response(JSON.stringify({
      error: 'Service Unavailable',
      message: 'Authentication not configured'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  const hasUserStore = !!env?.AUTH_USERS || !!env?.CONFIG?.get;
  if (isProduction(env) && !hasUserStore) {
    return new Response(JSON.stringify({
      error: 'Service Unavailable',
      message: 'Authentication user store not configured'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }

  return null;
}

function parseAuthUsers(env) {
  if (!env?.AUTH_USERS) {
    return [];
  }

  try {
    const parsed = JSON.parse(env.AUTH_USERS);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse AUTH_USERS:', error);
    return [];
  }
}

async function findUserByEmail(email, env) {
  const users = parseAuthUsers(env);
  const normalized = email.toLowerCase();
  const user = users.find((user) => user.email?.toLowerCase() === normalized) || null;
  if (user) {
    return user;
  }

  if (env?.CONFIG?.get) {
    const key = `user:${normalized}`;
    const stored = await env.CONFIG.get(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
      }
    }
  }

  return null;
}

async function storeUser(user, env) {
  if (!env?.CONFIG?.put) {
    throw new Error('CONFIG KV binding not configured');
  }

  const key = `user:${user.email.toLowerCase()}`;
  await env.CONFIG.put(key, JSON.stringify(user));
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }
  const hashed = await hashPassword(password);
  return hashed === passwordHash;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
