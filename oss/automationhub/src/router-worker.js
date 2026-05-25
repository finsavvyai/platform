/**
 * UPM.Plus Multi-Domain Router Worker
 * Handles routing across all UPM.Plus domains and subdomains
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Get environment and routing info
    const routing = await getRoutingConfig(hostname, env);

    // Handle different routing scenarios
    if (routing.type === 'api') {
      return handleAPIRoute(request, routing, env);
    } else if (routing.type === 'app') {
      return handleAppRoute(request, routing, env);
    } else if (routing.type === 'cdn') {
      return handleCDNRoute(request, routing, env);
    } else if (routing.type === 'dashboard') {
      return handleDashboardRoute(request, routing, env);
    } else {
      return handleMainRoute(request, routing, env);
    }
  }
};

/**
 * Get routing configuration based on hostname
 */
async function getRoutingConfig(hostname, env) {
  const domainMap = {
    // Production domain (upm.plus)
    'upm.plus': { type: 'main', env: 'production', backend: 'https://api.upm.plus' },
    'www.upm.plus': { type: 'main', env: 'production', backend: 'https://api.upm.plus' },
    'api.upm.plus': { type: 'api', env: 'production', backend: 'https://api.upm.plus' },
    'app.upm.plus': { type: 'app', env: 'production', backend: 'https://api.upm.plus' },
    'dashboard.upm.plus': { type: 'dashboard', env: 'production', backend: 'https://api.upm.plus' },
    'admin.upm.plus': { type: 'dashboard', env: 'production', backend: 'https://api.upm.plus' },
    'docs.upm.plus': { type: 'docs', env: 'production', backend: 'https://api.upm.plus' },
    'cdn.upm.plus': { type: 'cdn', env: 'production', backend: 'https://api.upm.plus' },
    'static.upm.plus': { type: 'cdn', env: 'production', backend: 'https://api.upm.plus' },
    'assets.upm.plus': { type: 'cdn', env: 'production', backend: 'https://api.upm.plus' },

    // Development domain (upmplus.dev)
    'upmplus.dev': { type: 'main', env: 'development', backend: 'https://api.upmplus.dev' },
    'www.upmplus.dev': { type: 'main', env: 'development', backend: 'https://api.upmplus.dev' },
    'api.upmplus.dev': { type: 'api', env: 'development', backend: 'https://api.upmplus.dev' },
    'app.upmplus.dev': { type: 'app', env: 'development', backend: 'https://api.upmplus.dev' },
    'dashboard.upmplus.dev': { type: 'dashboard', env: 'development', backend: 'https://api.upmplus.dev' },
    'admin.upmplus.dev': { type: 'dashboard', env: 'development', backend: 'https://api.upmplus.dev' },
    'docs.upmplus.dev': { type: 'docs', env: 'development', backend: 'https://api.upmplus.dev' },
    'cdn.upmplus.dev': { type: 'cdn', env: 'development', backend: 'https://api.upmplus.dev' },
    'static.upmplus.dev': { type: 'cdn', env: 'development', backend: 'https://api.upmplus.dev' },
    'assets.upmplus.dev': { type: 'cdn', env: 'development', backend: 'https://api.upmplus.dev' },

    // Staging domain (upmplus.io)
    'upmplus.io': { type: 'main', env: 'staging', backend: 'https://api.upmplus.io' },
    'www.upmplus.io': { type: 'main', env: 'staging', backend: 'https://api.upmplus.io' },
    'api.upmplus.io': { type: 'api', env: 'staging', backend: 'https://api.upmplus.io' },
    'app.upmplus.io': { type: 'app', env: 'staging', backend: 'https://api.upmplus.io' },
    'dashboard.upmplus.io': { type: 'dashboard', env: 'staging', backend: 'https://api.upmplus.io' },
    'admin.upmplus.io': { type: 'dashboard', env: 'staging', backend: 'https://api.upmplus.io' },
    'docs.upmplus.io': { type: 'docs', env: 'staging', backend: 'https://api.upmplus.io' },
    'cdn.upmplus.io': { type: 'cdn', env: 'staging', backend: 'https://api.upmplus.io' },
    'static.upmplus.io': { type: 'cdn', env: 'staging', backend: 'https://api.upmplus.io' },
    'assets.upmplus.io': { type: 'cdn', env: 'staging', backend: 'https://api.upmplus.io' },

    // AI Production domain (upmplus.ai)
    'upmplus.ai': { type: 'main', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'www.upmplus.ai': { type: 'main', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'api.upmplus.ai': { type: 'api', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'app.upmplus.ai': { type: 'app', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'dashboard.upmplus.ai': { type: 'dashboard', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'admin.upmplus.ai': { type: 'dashboard', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'docs.upmplus.ai': { type: 'docs', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'cdn.upmplus.ai': { type: 'cdn', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'static.upmplus.ai': { type: 'cdn', env: 'ai-production', backend: 'https://api.upmplus.ai' },
    'assets.upmplus.ai': { type: 'cdn', env: 'ai-production', backend: 'https://api.upmplus.ai' }
  };

  return domainMap[hostname] || { type: 'main', env: 'production', backend: env.API_BASE_URL };
}

/**
 * Handle API routes with proper headers and caching
 */
async function handleAPIRoute(request, routing, env) {
  const url = new URL(request.url);

  // Add CORS headers for API
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Proxy to backend API
    const backendUrl = new URL(url.pathname + url.search, routing.backend);

    const response = await fetch(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    // Add CORS headers to response
    const newResponse = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });

    return newResponse;

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'API Gateway Error', message: error.message }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

/**
 * Handle frontend application routes
 */
async function handleAppRoute(request, routing, env) {
  const url = new URL(request.url);

  try {
    // Serve the React app from CDN or backend
    let appUrl;

    if (url.pathname.startsWith('/api/')) {
      // API calls within the app
      appUrl = new URL(url.pathname + url.search, routing.backend);
    } else if (url.pathname === '/' || url.pathname.startsWith('/app')) {
      // Main application - serve from build cache or backend
      const cachedApp = await env.UPM_CACHE.get(`app:${routing.env}:${url.pathname}`);
      if (cachedApp) {
        return new Response(cachedApp, {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
      appUrl = new URL('/app/index.html', routing.backend);
    } else {
      // Static assets
      appUrl = new URL(url.pathname, `https://cdn.${url.hostname}`);
    }

    const response = await fetch(appUrl, request);

    // Cache static assets
    if (response.ok && url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
      const cacheKey = `static:${routing.env}:${url.pathname}`;
      ctx.waitUntil(env.UPM_CACHE.put(cacheKey, response.clone()));
    }

    return response;

  } catch (error) {
    return new Response(
      `Application Error: ${error.message}`,
      { status: 502, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}

/**
 * Handle CDN routes for static assets
 */
async function handleCDNRoute(request, routing, env) {
  const url = new URL(request.url);
  const cacheKey = `cdn:${routing.env}:${url.pathname}`;

  // Try to serve from cache first
  const cached = await env.UPM_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    // Fetch from backend or origin
    const originUrl = new URL(url.pathname + url.search, routing.backend);
    const response = await fetch(originUrl, request);

    if (response.ok) {
      // Cache the response
      ctx.waitUntil(env.UPM_CACHE.put(cacheKey, response.clone(), {
        expirationTtl: 86400 // 24 hours
      }));

      return new Response(response.body, response);
    }

    return response;

  } catch (error) {
    return new Response(
      'CDN Error: Resource not found',
      { status: 404, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}

/**
 * Handle dashboard routes
 */
async function handleDashboardRoute(request, routing, env) {
  const url = new URL(request.url);

  try {
    if (url.pathname.startsWith('/api/')) {
      // Proxy API calls
      const apiUrl = new URL(url.pathname + url.search, routing.backend);
      return await fetch(apiUrl, request);
    } else {
      // Serve dashboard application
      const dashboardUrl = new URL('/dashboard/index.html', routing.backend);
      return await fetch(dashboardUrl, request);
    }
  } catch (error) {
    return new Response(
      'Dashboard Error: Service unavailable',
      { status: 503, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}

/**
 * Handle main landing page routes
 */
async function handleMainRoute(request, routing, env) {
  const url = new URL(request.url);

  try {
    if (url.pathname.startsWith('/api/')) {
      // Proxy API calls
      const apiUrl = new URL(url.pathname + url.search, routing.backend);
      return await fetch(apiUrl, request);
    } else {
      // Serve landing page
      const landingUrl = new URL('/landing/index.html', routing.backend);
      return await fetch(landingUrl, request);
    }
  } catch (error) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>UPM.Plus - Autonomous Digital Ecosystem Orchestrator</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { text-align: center; color: white; max-width: 600px; padding: 2rem; }
          .logo { font-size: 3rem; font-weight: bold; margin-bottom: 1rem; }
          .tagline { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
          .status { background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin: 1rem 0; }
          .env { font-size: 0.9rem; opacity: 0.7; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">UPM.Plus</div>
          <div class="tagline">Autonomous Digital Ecosystem Orchestrator</div>
          <div class="status">
            <strong>🚀 Service Status: Available</strong><br>
            Environment: ${routing.env}<br>
            Domain: ${url.hostname}
          </div>
          <div class="env">
            Powered by Cloudflare Workers • Multi-Domain Architecture
          </div>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=300'
        }
      }
    );
  }
}