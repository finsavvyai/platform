/**
 * Simple Worker Entry Point
 *
 * Basic Cloudflare Worker for initial deployment
 */

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development',
        version: '1.0.0'
      })
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return Response.json({
        message: 'Questro API - Workers deployed successfully!',
        database: env.DB ? 'connected' : 'not configured',
        timestamp: new Date().toISOString()
      })
    }

    // Default response
    return Response.json({
      message: 'Questro Platform - Cloudflare Workers',
      status: 'operational',
      endpoints: {
        health: '/health',
        api: '/api/v1'
      }
    })
  }
}
