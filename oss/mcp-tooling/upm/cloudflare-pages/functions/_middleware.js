/**
 * Cloudflare Pages Functions Middleware
 * Handles routing and API proxying
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // API requests - proxy to backend
  if (url.pathname.startsWith('/api/') || url.pathname === '/health' || url.pathname === '/ready') {
    return proxyToBackend(request, env);
  }
  
  // Continue with normal Pages routing
  return context.next();
}

async function proxyToBackend(request, env) {
  const backendUrl = env.BACKEND_URL || 'http://34.29.39.106:8040';
  const url = new URL(request.url);
  const backendRequestUrl = `${backendUrl}${url.pathname}${url.search}`;
  
  try {
    const response = await fetch(backendRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
