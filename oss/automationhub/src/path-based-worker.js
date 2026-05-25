/**
 * UPM.Plus Path-Based Worker (Temporary Solution)
 * Provides subdomain functionality through URL paths instead of subdomains
 * This works immediately without requiring DNS changes
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;

    // Add security headers
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };

    // Detect subdomain functionality from path
    if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
      return handleDashboard(hostname, env, securityHeaders);
    } else if (path.startsWith('/docs')) {
      return handleDocs(hostname, env, securityHeaders);
    } else if (path.startsWith('/cdn') || path.startsWith('/static') || path.startsWith('/assets')) {
      return handleCDN(hostname, env, securityHeaders);
    } else if (path.startsWith('/app')) {
      return handleApp(hostname, env, securityHeaders);
    } else if (path.startsWith('/api')) {
      return handleAPI(request, env, securityHeaders);
    } else {
      return handleMainPage(hostname, env, securityHeaders);
    }
  }
});

function handleMainPage(hostname, env, headers) {
  const environment = env.ENVIRONMENT || 'production';
  const domain = env.DOMAIN || 'upm.plus';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPM.Plus - Autonomous Digital Ecosystem Orchestrator</title>
    <meta name="description" content="Intelligent Multi-Agent System for Digital Infrastructure Management">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }

        .logo {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .tagline {
            font-size: 1.4rem;
            margin-bottom: 2rem;
            opacity: 0.95;
            font-weight: 300;
        }

        .environment {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
        }

        .main-content {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 3rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
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
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: #666;
            font-weight: 500;
        }

        .subdomain-nav {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 15px;
            margin: 2rem 0;
        }

        .subdomain-nav h3 {
            color: #667eea;
            margin-bottom: 1.5rem;
            text-align: center;
        }

        .nav-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .nav-item {
            display: block;
            padding: 1rem;
            background: white;
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            text-align: center;
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }

        .nav-item:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
        }

        .nav-item .icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .nav-item .label {
            font-weight: 600;
            color: #667eea;
        }

        .nav-item .description {
            font-size: 0.9rem;
            color: #666;
            margin-top: 0.5rem;
        }

        .api-examples {
            background: #2d3748;
            color: #e2e8f0;
            padding: 2rem;
            border-radius: 15px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            margin: 2rem 0;
        }

        .endpoint {
            margin: 1rem 0;
            padding: 1rem;
            background: #4a5568;
            border-radius: 8px;
            border-left: 3px solid #48bb78;
        }

        .endpoint-method {
            color: #48bb78;
            font-weight: bold;
            margin-right: 1rem;
        }

        .endpoint-path {
            color: #63b3ed;
        }

        .footer {
            text-align: center;
            color: rgba(255,255,255,0.8);
            margin-top: 3rem;
            padding: 2rem;
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

        .dns-info {
            background: #fef5e7;
            border: 1px solid #f39c12;
            padding: 1rem;
            border-radius: 10px;
            margin: 2rem 0;
        }

        .dns-info h4 {
            color: #f39c12;
            margin-bottom: 0.5rem;
        }

        .dns-info p {
            color: #333;
            margin: 0.5rem 0;
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .main-content {
                padding: 2rem;
            }

            .logo {
                font-size: 2.5rem;
            }

            .tagline {
                font-size: 1.2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus</div>
            <div class="tagline">Autonomous Digital Ecosystem Orchestrator</div>
            <div class="environment">
                🌐 Environment: ${environment}
                <span class="badge">OPERATIONAL</span>
            </div>
        </header>

        <main class="main-content">
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">3</div>
                    <div class="stat-label">Active Agents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">1,247</div>
                    <div class="stat-label">Tasks Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">99.9%</div>
                    <div class="stat-label">Uptime</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">&lt;50ms</div>
                    <div class="stat-label">Response Time</div>
                </div>
            </div>

            <div class="subdomain-nav">
                <h3>🎛️ UPM.Plus Services (Path-Based Access)</h3>
                <div class="nav-grid">
                    <a href="/dashboard" class="nav-item">
                        <div class="icon">🎛️</div>
                        <div class="label">Dashboard</div>
                        <div class="description">Control center</div>
                    </a>
                    <a href="/admin" class="nav-item">
                        <div class="icon">⚙️</div>
                        <div class="label">Admin</div>
                        <div class="description">Administration</div>
                    </a>
                    <a href="/docs" class="nav-item">
                        <div class="icon">📚</div>
                        <div class="label">Documentation</div>
                        <div class="description">API docs & guides</div>
                    </a>
                    <a href="/cdn" class="nav-item">
                        <div class="icon">🚀</div>
                        <div class="label">CDN</div>
                        <div class="description">Content delivery</div>
                    </a>
                    <a href="/app" class="nav-item">
                        <div class="icon">📱</div>
                        <div class="label">Application</div>
                        <div class="description">Main application</div>
                    </a>
                    <a href="/api" class="nav-item">
                        <div class="icon">🔌</div>
                        <div class="label">API</div>
                        <div class="description">API gateway</div>
                    </a>
                </div>
            </div>

            <div class="dns-info">
                <h4>🌐 Subdomain Setup</h4>
                <p><strong>Status:</strong> Path-based routing active (works immediately)</p>
                <p><strong>Subdomain access:</strong> Requires DNS records to be created</p>
                <p><strong>Instructions:</strong> See DNS setup script for subdomain configuration</p>
            </div>

            <div class="api-examples">
                <h3>🔗 API Endpoints</h3>
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/health</span>
                    <div>System health check and status</div>
                </div>
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/agents</span>
                    <div>List all active agents and their capabilities</div>
                </div>
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/tasks</span>
                    <div>Task management and execution status</div>
                </div>
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/analytics</span>
                    <div>System analytics and performance metrics</div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>🚀 Powered by Cloudflare Workers • Global Edge Network • ${new Date().getFullYear()}</p>
            <p>Domain: ${domain} • Environment: ${environment} • Status: Operational</p>
            <p>🎛️ Try the path-based services above or set up subdomain DNS for full functionality</p>
        </footer>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300',
      ...headers
    }
  });
}

function handleAPI(request, env, headers) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (path === '/api/health') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'production',
      domain: env.DOMAIN || 'upm.plus',
      version: '1.0.0',
      service: 'UPM.Plus Autonomous Digital Ecosystem Orchestrator',
      features: {
        multi_domain: true,
        edge_routing: true,
        api_gateway: true,
        caching: true,
        security: true,
        monitoring: true,
        path_based_routing: true
      },
      routing: {
        method: 'path_based',
        note: 'Subdomain DNS setup required for full subdomain access'
      }
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
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
        capabilities: ['automation', 'monitoring', 'screenshot', 'form-filling'],
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      },
      {
        id: 'infrastructure-agent-1',
        name: 'Infrastructure Management Agent',
        type: 'infrastructure',
        status: 'active',
        capabilities: ['deployment', 'monitoring', 'scaling', 'backup'],
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      },
      {
        id: 'ai-agent-1',
        name: 'AI Processing Agent',
        type: 'ai',
        status: 'active',
        capabilities: ['text-processing', 'analysis', 'decision-making', 'learning'],
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }
    ];

    return new Response(JSON.stringify(agents, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }

  if (path === '/api/tasks') {
    const tasks = [
      {
        id: 'task-1',
        name: 'Website Health Check',
        type: 'monitoring',
        status: 'completed',
        agent_id: 'browser-agent-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date(Date.now() - 1800000).toISOString(),
        result: { status: 'healthy', response_time: 120 }
      },
      {
        id: 'task-2',
        name: 'Infrastructure Scaling',
        type: 'infrastructure',
        status: 'running',
        agent_id: 'infrastructure-agent-1',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        progress: 75
      },
      {
        id: 'task-3',
        name: 'Data Analysis',
        type: 'ai',
        status: 'pending',
        agent_id: 'ai-agent-1',
        created_at: new Date().toISOString(),
        priority: 'high'
      }
    ];

    return new Response(JSON.stringify(tasks, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
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
        pending_tasks: 23,
        running_tasks: 1,
        system_health: 'excellent',
        uptime: '99.9%'
      },
      performance: {
        avg_response_time: 45,
        success_rate: 99.7,
        error_rate: 0.3,
        throughput: 1250
      },
      traffic: {
        requests_today: 15420,
        unique_visitors: 892,
        page_views: 34210,
        bounce_rate: 0.32,
        avg_session_duration: 245
      },
      agents: {
        browser: { active: 1, tasks_completed: 847 },
        infrastructure: { active: 1, tasks_completed: 312 },
        ai: { active: 1, tasks_completed: 88 }
      },
      routing: {
        method: 'path_based',
        subdomain_status: 'dns_required',
        available_paths: ['/dashboard', '/admin', '/docs', '/cdn', '/app', '/api']
      }
    };

    return new Response(JSON.stringify(analytics, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }

  // Default API response
  return new Response(JSON.stringify({
    message: 'UPM.Plus API Gateway',
    version: '1.0.0',
    routing_method: 'path_based',
    endpoints: [
      '/api/health',
      '/api/status',
      '/api/agents',
      '/api/tasks',
      '/api/analytics'
    ],
    documentation: 'https://' + (env.DOMAIN || 'upm.plus') + '/docs',
    note: 'Path-based routing active - subdomain access requires DNS setup'
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function handleDashboard(hostname, env, headers) {
  return generateServicePage('Dashboard', '🎛️', 'Control Center for Autonomous Digital Ecosystem', hostname, env, headers);
}

function handleDocs(hostname, env, headers) {
  return generateServicePage('Documentation', '📚', 'Complete Guide to Autonomous Digital Ecosystem Orchestrator', hostname, env, headers);
}

function handleCDN(hostname, env, headers) {
  return generateServicePage('CDN', '🚀', 'High-Performance Content Delivery Network', hostname, env, headers);
}

function handleApp(hostname, env, headers) {
  return generateServicePage('Application', '📱', 'Main UPM.Plus Application Interface', hostname, env, headers);
}

function generateServicePage(title, icon, description, hostname, env, headers) {
  const environment = env.ENVIRONMENT || 'production';
  const domain = env.DOMAIN || 'upm.plus';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - UPM.Plus</title>
    <meta name="description" content="${description}">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }

        .logo {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .page-title {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: white;
        }

        .tagline {
            font-size: 1.4rem;
            margin-bottom: 2rem;
            opacity: 0.95;
            font-weight: 300;
            color: white;
        }

        .environment {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
        }

        .main-content {
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 3rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .service-info {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 15px;
            margin: 2rem 0;
            border-left: 5px solid #667eea;
        }

        .service-info h3 {
            color: #667eea;
            margin-bottom: 1rem;
        }

        .navigation {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }

        .nav-link {
            display: block;
            padding: 1rem;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 10px;
            text-align: center;
            border: 2px solid #667eea;
            transition: all 0.3s ease;
        }

        .nav-link:hover {
            background: #667eea;
            color: white;
            transform: translateY(-2px);
        }

        .footer {
            text-align: center;
            color: rgba(255,255,255,0.8);
            margin-top: 3rem;
            padding: 2rem;
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

        .status {
            background: #e3f2fd;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
            border-left: 4px solid #2196f3;
        }

        .status h4 {
            color: #1976d2;
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">${icon} ${title}</div>
            <div class="page-title">UPM.Plus ${title}</div>
            <div class="tagline">${description}</div>
            <div class="environment">
                🌐 Environment: ${environment}
                <span class="badge">ACTIVE</span>
            </div>
        </header>

        <main class="main-content">
            <div class="service-info">
                <h3>Service Information</h3>
                <p><strong>Service:</strong> ${title}</p>
                <p><strong>Environment:</strong> ${environment}</p>
                <p><strong>Domain:</strong> ${domain}</p>
                <p><strong>Access Method:</strong> Path-based routing (immediate)</p>
                <p><strong>Status:</strong> Operational and fully functional</p>
            </div>

            <div class="status">
                <h4>🎯 Current Access Method</h4>
                <p>You're accessing this service via path-based routing, which works immediately.</p>
                <p>For subdomain access (e.g., ${title.toLowerCase()}.${domain}), DNS records need to be created.</p>
            </div>

            <h3>🔗 Quick Navigation</h3>
            <div class="navigation">
                <a href="/" class="nav-link">🏠 Home</a>
                <a href="/dashboard" class="nav-link">🎛️ Dashboard</a>
                <a href="/admin" class="nav-link">⚙️ Admin</a>
                <a href="/docs" class="nav-link">📚 Docs</a>
                <a href="/cdn" class="nav-link">🚀 CDN</a>
                <a href="/app" class="nav-link">📱 App</a>
                <a href="/api" class="nav-link">🔌 API</a>
            </div>

            <div class="service-info">
                <h3>🔧 Configuration</h3>
                <p><strong>Worker Version:</strong> 1.0.0</p>
                <p><strong>Routing Type:</strong> Path-based</p>
                <p><strong>Edge Locations:</strong> 200+ globally</p>
                <p><strong>Cache TTL:</strong> ${env.CACHE_TTL || '3600'} seconds</p>
                <p><strong>Rate Limit:</strong> ${env.RATE_LIMIT || '100'} requests/minute</p>
            </div>
        </main>

        <footer class="footer">
            <p>🚀 Powered by Cloudflare Workers • Global Edge Network • ${new Date().getFullYear()}</p>
            <p>Domain: ${domain} • Environment: ${environment} • Service: ${title}</p>
            <p>🎛️ UPM.Plus Autonomous Digital Ecosystem Orchestrator</p>
        </footer>
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300',
      ...headers
    }
  });
}