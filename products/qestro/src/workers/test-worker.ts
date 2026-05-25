/**
 * Qestro Workers - Test Worker
 *
 * Simple test worker to validate the build pipeline and Workers setup
 */

type WorkerEnv = {
  ENVIRONMENT?: string
}

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development',
        version: '1.0.0',
        uptime: Date.now()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // API info endpoint
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Qestro Test Worker',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'development',
        endpoints: {
          health: '/health',
          api: '/api'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `Route ${url.pathname} not found`
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
