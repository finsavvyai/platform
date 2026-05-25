/**
 * Health check endpoint
 * Proxies to backend health endpoint
 */

export async function onRequest(context) {
  const { request, env } = context;
  const backendUrl = env.BACKEND_URL || 'http://34.29.39.106:8040';
  
  try {
    const response = await fetch(`${backendUrl}/health`);
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'unhealthy', error: error.message }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
