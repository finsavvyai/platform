/**
 * UPM.Plus AutomationHub - Cloudflare Workers
 * Simple working deployment
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        name: 'UPM.Plus AutomationHub',
        status: 'active',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api/v1'
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'unknown'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/api/v1/stats') {
      // Mock stats data
      return new Response(JSON.stringify({
        agents: {
          total: 4,
          active: 4
        },
        workflows: {
          total: 10,
          active: 8
        },
        tasks: {
          total: 100,
          completed: 85,
          failed: 5
        },
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 404 for other routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      available_endpoints: ['/', '/health', '/api/v1/stats']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
