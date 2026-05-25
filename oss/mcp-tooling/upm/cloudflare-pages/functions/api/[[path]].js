/**
 * Cloudflare Pages Function to proxy API requests
 * Handles /api/* routes and proxies to backend
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get backend URL from environment or use default
  const backendUrl = env.BACKEND_URL || 'http://34.29.39.106:8040';
  
  // Construct backend URL
  const backendRequestUrl = `${backendUrl}${url.pathname}${url.search}`;
  
  try {
    // Forward request to backend
    const response = await fetch(backendRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // Return response with CORS headers
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Backend unavailable',
        message: error.message 
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
