/**
 * UPM.Plus Simple Path-Based Worker
 * Immediate solution that works without DNS setup
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route based on path
    if (path.startsWith('/api/')) {
      return handleAPI(path, env, corsHeaders);
    } else if (path.startsWith('/dashboard')) {
      return handleService('Dashboard', env);
    } else if (path.startsWith('/admin')) {
      return handleService('Admin', env);
    } else if (path.startsWith('/docs')) {
      return handleService('Documentation', env);
    } else if (path.startsWith('/cdn')) {
      return handleService('CDN', env);
    } else if (path.startsWith('/app')) {
      return handleService('Application', env);
    } else {
      return handleMainPage(env);
    }
  }
};

function handleAPI(path, env, corsHeaders) {
  if (path === '/api/health') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'production',
      domain: env.DOMAIN || 'upm.plus',
      version: '1.0.0',
      service: 'UPM.Plus Autonomous Digital Ecosystem Orchestrator',
      routing: 'path_based'
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  if (path === '/api/agents') {
    const agents = [
      {
        id: 'browser-agent-1',
        name: 'Browser Automation Agent',
        type: 'browser',
        status: 'active',
        capabilities: ['automation', 'monitoring', 'screenshot']
      },
      {
        id: 'infrastructure-agent-1',
        name: 'Infrastructure Management Agent',
        type: 'infrastructure',
        status: 'active',
        capabilities: ['deployment', 'monitoring', 'scaling']
      },
      {
        id: 'ai-agent-1',
        name: 'AI Processing Agent',
        type: 'ai',
        status: 'active',
        capabilities: ['text-processing', 'analysis', 'learning']
      }
    ];

    return new Response(JSON.stringify(agents, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  if (path === '/api/analytics') {
    const analytics = {
      overview: {
        total_agents: 3,
        active_agents: 3,
        completed_tasks: 1247,
        system_health: 'excellent',
        uptime: '99.9%'
      },
      performance: {
        avg_response_time: 45,
        success_rate: 99.7,
        error_rate: 0.3
      },
      traffic: {
        requests_today: 15420,
        unique_visitors: 892,
        page_views: 34210
      }
    };

    return new Response(JSON.stringify(analytics, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // Default API response
  return new Response(JSON.stringify({
    message: 'UPM.Plus API',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/agents', '/api/analytics'],
    routing: 'path_based'
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function handleService(serviceType, env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${serviceType} - UPM.Plus</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255,255,255,0.95);
            padding: 3rem;
            border-radius: 20px;
            text-align: center;
            max-width: 600px;
            backdrop-filter: blur(10px);
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 1rem;
        }
        .description {
            color: #666;
            margin-bottom: 2rem;
            font-size: 1.1rem;
        }
        .nav {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .nav-link {
            padding: 1rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            transition: all 0.3s ease;
        }
        .nav-link:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        .status {
            background: #e3f2fd;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
            border-left: 4px solid #2196f3;
        }
        .environment {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🎛️</div>
        <div class="title">${serviceType}</div>
        <div class="description">UPM.Plus ${serviceType} Service</div>
        <div class="environment">
            Environment: ${env.ENVIRONMENT || 'production'}
        </div>
        <div class="status">
            <strong>✅ Service Status:</strong> Operational<br>
            <strong>🎯 Access Method:</strong> Path-based routing<br>
            <strong>🌐 Domain:</strong> ${env.DOMAIN || 'upm.plus'}
        </div>
        <div class="nav">
            <a href="/" class="nav-link">🏠 Home</a>
            <a href="/dashboard" class="nav-link">🎛️ Dashboard</a>
            <a href="/admin" class="nav-link">⚙️ Admin</a>
            <a href="/docs" class="nav-link">📚 Docs</a>
            <a href="/api" class="nav-link">🔌 API</a>
        </div>
        <p style="color: #666; margin-top: 2rem;">
            Powered by Cloudflare Workers • Global Edge Network
        </p>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

function handleMainPage(env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPM.Plus - Autonomous Digital Ecosystem Orchestrator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .logo {
            font-size: 4rem;
            font-weight: 800;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .tagline {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .environment {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }
        .main-content {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 3rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            color: #333;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
        }
        .stat-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 1.5rem;
            border-radius: 15px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        .services {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin: 3rem 0;
        }
        .service {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            text-align: center;
            text-decoration: none;
            color: #333;
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }
        .service:hover {
            border-color: #667eea;
            transform: translateY(-5px);
        }
        .service-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        .service-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        .api-examples {
            background: #2d3748;
            color: #e2e8f0;
            padding: 2rem;
            border-radius: 15px;
            font-family: monospace;
            margin: 2rem 0;
        }
        .endpoint {
            margin: 1rem 0;
            padding: 1rem;
            background: #4a5568;
            border-radius: 8px;
            border-left: 3px solid #48bb78;
        }
        .badge {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 0.3rem 0.8rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-left: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus</div>
            <div class="tagline">Autonomous Digital Ecosystem Orchestrator</div>
            <div class="environment">
                Environment: ${env.ENVIRONMENT || 'production'}
                <span class="badge">OPERATIONAL</span>
            </div>
        </header>

        <main class="main-content">
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">3</div>
                    <div>Active Agents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">1,247</div>
                    <div>Tasks Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">99.9%</div>
                    <div>Uptime</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">&lt;50ms</div>
                    <div>Response Time</div>
                </div>
            </div>

            <h2 style="text-align: center; color: #667eea; margin-bottom: 2rem;">🎛️ Services (Path-Based Access)</h2>
            <div class="services">
                <a href="/dashboard" class="service">
                    <div class="service-icon">🎛️</div>
                    <div class="service-title">Dashboard</div>
                    <div>Control Center</div>
                </a>
                <a href="/admin" class="service">
                    <div class="service-icon">⚙️</div>
                    <div class="service-title">Admin</div>
                    <div>Administration</div>
                </a>
                <a href="/docs" class="service">
                    <div class="service-icon">📚</div>
                    <div class="service-title">Docs</div>
                    <div>Documentation</div>
                </a>
                <a href="/cdn" class="service">
                    <div class="service-icon">🚀</div>
                    <div class="service-title">CDN</div>
                    <div>Content Delivery</div>
                </a>
                <a href="/app" class="service">
                    <div class="service-icon">📱</div>
                    <div class="service-title">App</div>
                    <div>Application</div>
                </a>
                <a href="/api" class="service">
                    <div class="service-icon">🔌</div>
                    <div class="service-title">API</div>
                    <div>API Gateway</div>
                </a>
            </div>

            <div class="api-examples">
                <h3>🔗 API Endpoints</h3>
                <div class="endpoint">
                    <strong>GET</strong> /api/health - System health check
                </div>
                <div class="endpoint">
                    <strong>GET</strong> /api/agents - Active agents list
                </div>
                <div class="endpoint">
                    <strong>GET</strong> /api/analytics - Performance metrics
                </div>
            </div>
        </main>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300'
    }
  });
}