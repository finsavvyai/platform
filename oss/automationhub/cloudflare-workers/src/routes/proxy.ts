/**
 * Proxy Routes for Cloudflare Workers
 * Provides edge proxy functionality to backend services
 */

import { Hono } from 'hono';

const proxyRoutes = new Hono();

// Configuration for backend services
const BACKEND_SERVICES = {
  api: 'https://api.upm.plus',
  admin: 'https://admin.upm.plus',
  monitoring: 'https://grafana.upm.plus',
  files: 'https://files.upm.plus'
} as const;

// Proxy to backend API
proxyRoutes.get('/api/*', async (c) => {
  const path = c.req.path.replace('/proxy/api', '');
  const backendUrl = `${BACKEND_SERVICES.api}${path}`;

  try {
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.headers),
        'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
        'X-Forwarded-Proto': c.req.url.split(':')[0],
        'X-Forwarded-Host': c.req.header('Host') || '',
        'User-Agent': `UPM-Edge-Proxy/${c.env.VERSION || '1.0.0'}`
      }
    });

    // Return response with appropriate headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Edge-Cache': c.req.cf?.cacheStatus || 'unknown',
        'X-Edge-Colo': c.req.cf?.colo || 'unknown'
      }
    });
  } catch (error) {
    return c.json({
      error: 'Proxy request failed',
      message: error.message,
      backend_url: backendUrl
    }, 502);
  }
});

// Enhanced proxy with caching for GET requests
proxyRoutes.get('/cached-api/*', async (c) => {
  const path = c.req.path.replace('/proxy/cached-api', '');
  const backendUrl = `${BACKEND_SERVICES.api}${path}`;
  const cacheKey = `proxy:${path}:${JSON.stringify(c.req.query())}`;

  try {
    // Check cache first
    const cached = await c.env.UPM_CACHE.get(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      return new Response(cachedData.body, {
        status: cachedData.status,
        headers: {
          ...cachedData.headers,
          'X-Edge-Cache': 'HIT',
          'X-Cache-Age': Math.floor((Date.now() - cachedData.timestamp) / 1000).toString()
        }
      });
    }

    // Fetch from backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
        'X-Forwarded-Proto': c.req.url.split(':')[0],
        'X-Forwarded-Host': c.req.header('Host') || '',
        'User-Agent': `UPM-Edge-Proxy/${c.env.VERSION || '1.0.0'}`
      }
    });

    const body = await response.text();

    // Cache successful responses for 5 minutes
    if (response.ok) {
      await c.env.UPM_CACHE.put(cacheKey, JSON.stringify({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body,
        timestamp: Date.now()
      }), { expirationTtl: 300 });
    }

    return new Response(body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': '*',
        'X-Edge-Cache': 'MISS',
        'X-Edge-Colo': c.req.cf?.colo || 'unknown'
      }
    });
  } catch (error) {
    return c.json({
      error: 'Cached proxy request failed',
      message: error.message,
      backend_url: backendUrl
    }, 502);
  }
});

// Proxy with request/response transformation
proxyRoutes.all('/transform/*', async (c) => {
  const path = c.req.path.replace('/proxy/transform', '');
  const backendUrl = `${BACKEND_SERVICES.api}${path}`;

  try {
    // Transform request
    let requestBody = null;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const originalBody = await c.req.text();
      requestBody = transformRequestBody(originalBody, c.req.method);
    }

    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.headers),
        'Content-Type': 'application/json',
        'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
        'X-Forwarded-Proto': c.req.url.split(':')[0],
        'X-Forwarded-Host': c.req.header('Host') || '',
        'User-Agent': `UPM-Edge-Proxy/${c.env.VERSION || '1.0.0'}`,
        'X-Edge-Transform': 'enabled'
      },
      body: requestBody
    });

    // Transform response
    const responseBody = await response.text();
    const transformedBody = transformResponseBody(responseBody, response.status);

    return new Response(transformedBody, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': '*',
        'X-Edge-Transform': 'applied',
        'X-Edge-Colo': c.req.cf?.colo || 'unknown'
      }
    });
  } catch (error) {
    return c.json({
      error: 'Transform proxy request failed',
      message: error.message,
      backend_url: backendUrl
    }, 502);
  }
});

// Load balancer proxy
proxyRoutes.get('/load-balanced/*', async (c) => {
  const path = c.req.path.replace('/proxy/load-balanced', '');

  // Define multiple backend instances
  const backendInstances = [
    'https://api1.upm.plus',
    'https://api2.upm.plus',
    'https://api3.upm.plus'
  ];

  // Select backend based on request hash for consistency
  const hash = hashString(c.req.header('CF-Connecting-IP') || path);
  const selectedBackend = backendInstances[hash % backendInstances.length];
  const backendUrl = `${selectedBackend}${path}`;

  try {
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.headers),
        'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
        'X-Forwarded-Proto': c.req.url.split(':')[0],
        'X-Forwarded-Host': c.req.header('Host') || '',
        'User-Agent': `UPM-Edge-Proxy/${c.env.VERSION || '1.0.0'}`,
        'X-Load-Balanced-By': selectedBackend
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': '*',
        'X-Load-Balanced-Backend': selectedBackend,
        'X-Edge-Colo': c.req.cf?.colo || 'unknown'
      }
    });
  } catch (error) {
    // Try fallback backend
    const fallbackBackend = backendInstances[(hash + 1) % backendInstances.length];
    const fallbackUrl = `${fallbackBackend}${path}`;

    try {
      const response = await fetch(fallbackUrl, {
        method: c.req.method,
        headers: {
          ...Object.fromEntries(c.req.headers),
          'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
          'X-Forwarded-Proto': c.req.url.split(':')[0],
          'X-Forwarded-Host': c.req.header('Host') || '',
          'User-Agent': `UPM-Edge-Proxy/${c.env.VERSION || '1.0.0'}`,
          'X-Fallback-Backend': fallbackBackend
        }
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Access-Control-Allow-Origin': '*',
          'X-Fallback-Used': 'true',
          'X-Fallback-Backend': fallbackBackend,
          'X-Edge-Colo': c.req.cf?.colo || 'unknown'
        }
      });
    } catch (fallbackError) {
      return c.json({
        error: 'All backend instances failed',
        message: `${error.message} | ${fallbackError.message}`,
        attempted_backends: [selectedBackend, fallbackBackend]
      }, 503);
    }
  }
});

// Request transformation function
function transformRequestBody(body: string, method: string): string | null {
  if (!body || method === 'GET') return null;

  try {
    const data = JSON.parse(body);

    // Add edge-specific metadata
    const transformed = {
      ...data,
      _edge: {
        timestamp: new Date().toISOString(),
        method,
        transformed: true
      }
    };

    return JSON.stringify(transformed);
  } catch {
    // If not JSON, return as-is
    return body;
  }
}

// Response transformation function
function transformResponseBody(body: string, status: number): string {
  if (status !== 200) return body;

  try {
    const data = JSON.parse(body);

    // Add edge-specific metadata
    const transformed = {
      ...data,
      _edge: {
        processed_at: new Date().toISOString(),
        transformed: true,
        proxy_version: '1.0.0'
      }
    };

    return JSON.stringify(transformed);
  } catch {
    // If not JSON, return as-is
    return body;
  }
}

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export { proxyRoutes };