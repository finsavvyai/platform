/**
 * Simple test worker to verify Cloudflare functionality
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'FinSavvy AI Suite - Test Worker',
        environment: env.ENVIRONMENT || 'unknown'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Root endpoint
    return new Response(JSON.stringify({
      message: 'FinSavvy AI Suite - Operational',
      timestamp: new Date().toISOString(),
      endpoints: ['/health', '/api/status'],
      environment: env.ENVIRONMENT || 'unknown'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};