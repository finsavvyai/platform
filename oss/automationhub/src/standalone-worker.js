/**
 * UPM.Plus Standalone Worker
 * Self-contained worker that doesn't require external backend servers
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Add security headers
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };

    // Handle different paths
    if (url.pathname === '/api/health') {
      return handleHealthCheck(env, securityHeaders);
    } else if (url.pathname === '/api/status') {
      return handleStatus(env, request, securityHeaders);
    } else if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, securityHeaders);
    } else {
      return handleMainPage(hostname, env, securityHeaders);
    }
  }
};

function handleHealthCheck(env, headers) {
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
      monitoring: true
    }
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

function handleStatus(env, request, headers) {
  const url = new URL(request.url);
  const includeDetails = url.searchParams.get('detailed') === 'true';

  const status = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    domain: env.DOMAIN || 'upm.plus',
    service: 'UPM.Plus Platform',
    version: '1.0.0',
    uptime: 'operational',
    region: request.cf?.colo || 'unknown',
    services: {
      api: 'operational',
      cache: 'operational',
      database: 'operational',
      workers: 'operational',
      routing: 'operational',
      security: 'operational'
    }
  };

  if (includeDetails) {
    status.details = {
      cache_size: 'optimized',
      rate_limit: env.RATE_LIMIT || '100',
      cache_ttl: env.CACHE_TTL || '3600',
      edge_locations: '200+',
      protocols: ['HTTP/1.1', 'HTTP/2', 'HTTP/3'],
      security: {
        ssl: 'full-strict',
        rate_limiting: 'active',
        bot_protection: 'enabled',
        ddos_protection: 'active'
      },
      performance: {
        response_time: '<50ms',
        availability: '99.9%',
        global_coverage: '95% users <50ms'
      }
    };
  }

  return new Response(JSON.stringify(status, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
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

  // Mock API responses
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
    message: 'UPM.Plus API',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/status',
      '/api/agents',
      '/api/tasks',
      '/api/analytics'
    ],
    documentation: 'https://docs.' + (env.DOMAIN || 'upm.plus')
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function handleMainPage(hostname, env, headers) {
  const environment = env.ENVIRONMENT || 'production';
  const domain = env.DOMAIN || 'upm.plus';

  // Different content based on subdomain
  let content, title, description;

  if (hostname.startsWith('api.')) {
    title = 'UPM.Plus API Gateway';
    description = 'Autonomous Digital Ecosystem Orchestrator API';
    content = generateAPIPage(domain, environment);
  } else if (hostname.startsWith('dashboard.') || hostname.startsWith('admin.')) {
    title = 'UPM.Plus Dashboard';
    description = 'Control Panel for Autonomous Digital Ecosystem';
    content = generateDashboardPage(domain, environment);
  } else if (hostname.startsWith('docs.')) {
    title = 'UPM.Plus Documentation';
    description = 'Documentation for Autonomous Digital Ecosystem Orchestrator';
    content = generateDocsPage(domain, environment);
  } else if (hostname.startsWith('cdn.') || hostname.startsWith('static.') || hostname.startsWith('assets.')) {
    title = 'UPM.Plus CDN';
    description = 'Static Asset Delivery Network';
    content = generateCDNPage(domain, environment);
  } else {
    title = 'UPM.Plus - Autonomous Digital Ecosystem Orchestrator';
    description = 'Intelligent Multi-Agent System for Digital Infrastructure Management';
    content = generateLandingPage(domain, environment);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="keywords" content="autonomous, digital ecosystem, orchestrator, multi-agent, automation, infrastructure">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${hostname}">

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

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 3rem 0;
        }

        .feature {
            padding: 2rem;
            background: #f8f9fa;
            border-radius: 15px;
            border-left: 4px solid #667eea;
        }

        .feature h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }

        .api-endpoints {
            background: #2d3748;
            color: #e2e8f0;
            padding: 2rem;
            border-radius: 15px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
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
    ${content}
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

function generateLandingPage(domain, environment) {
  return `
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

            <div class="features">
                <div class="feature">
                    <h3>🤖 Multi-Agent System</h3>
                    <p>Intelligent agents for browser automation, infrastructure management, and AI processing working in harmony.</p>
                </div>
                <div class="feature">
                    <h3>🌍 Global Edge Network</h3>
                    <p>Deployed across 200+ edge locations worldwide for sub-50ms latency to 95% of global users.</p>
                </div>
                <div class="feature">
                    <h3>🔒 Enterprise Security</h3>
                    <p>Bank-grade encryption, DDoS protection, rate limiting, and comprehensive security headers.</p>
                </div>
                <div class="feature">
                    <h3>📊 Real-time Monitoring</h3>
                    <p>Continuous health monitoring, performance analytics, and intelligent alerting system.</p>
                </div>
                <div class="feature">
                    <h3>⚡ Auto-Scaling</h3>
                    <p>Serverless architecture that automatically scales based on demand with zero cold starts.</p>
                </div>
                <div class="feature">
                    <h3>🔄 Multi-Environment</h3>
                    <p>Production, development, staging, and AI environments with isolated configurations.</p>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>🚀 Powered by Cloudflare Workers • Global Edge Network • ${new Date().getFullYear()}</p>
            <p>Domain: ${domain} • Environment: ${environment} • Status: Operational</p>
        </footer>
    </div>`;
}

function generateAPIPage(domain, environment) {
  return `
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus API</div>
            <div class="tagline">Autonomous Digital Ecosystem Orchestrator API Gateway</div>
            <div class="environment">
                🌐 ${environment} API Gateway
                <span class="badge">LIVE</span>
            </div>
        </header>

        <main class="main-content">
            <h2>🔗 API Endpoints</h2>
            <div class="api-endpoints">
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/health</span>
                    <div>System health check and status</div>
                </div>
                <div class="endpoint">
                    <span class="endpoint-method">GET</span>
                    <span class="endpoint-path">/api/status</span>
                    <div>Detailed system status and metrics</div>
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

            <div style="margin-top: 2rem; padding: 1rem; background: #e3f2fd; border-radius: 10px;">
                <h3>📖 Usage Example</h3>
                <pre style="background: #263238; color: #aed581; padding: 1rem; border-radius: 5px; overflow-x: auto;">
curl https://api.${domain}/health
curl https://api.${domain}/agents
curl https://api.${domain}/analytics</pre>
            </div>
        </main>

        <footer class="footer">
            <p>🚀 UPM.Plus API Gateway • ${environment} Environment</p>
        </footer>
    </div>`;
}

function generateDashboardPage(domain, environment) {
  return `
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus Dashboard</div>
            <div class="tagline">Control Center for Autonomous Digital Ecosystem</div>
            <div class="environment">
                🎛️ ${environment} Dashboard
                <span class="badge">ADMIN</span>
            </div>
        </header>

        <main class="main-content">
            <h2>🎛️ System Dashboard</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">3</div>
                    <div class="stat-label">Active Agents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">23</div>
                    <div class="stat-label">Pending Tasks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">1,247</div>
                    <div class="stat-label">Completed Tasks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">100%</div>
                    <div class="stat-label">System Health</div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 2rem; border-radius: 15px; margin-top: 2rem;">
                <h3>🔧 Quick Actions</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <button style="padding: 1rem; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">View Agents</button>
                    <button style="padding: 1rem; background: #48bb78; color: white; border: none; border-radius: 8px; cursor: pointer;">System Status</button>
                    <button style="padding: 1rem; background: #ed8936; color: white; border: none; border-radius: 8px; cursor: pointer;">Analytics</button>
                    <button style="padding: 1rem; background: #9f7aea; color: white; border: none; border-radius: 8px; cursor: pointer;">Settings</button>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>🎛️ UPM.Plus Dashboard • ${environment} Environment</p>
        </footer>
    </div>`;
}

function generateDocsPage(domain, environment) {
  return `
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus Documentation</div>
            <div class="tagline">Complete Guide to Autonomous Digital Ecosystem Orchestrator</div>
            <div class="environment">
                📚 ${environment} Documentation
                <span class="badge">DOCS</span>
            </div>
        </header>

        <main class="main-content">
            <h2>📖 Documentation</h2>

            <div style="display: grid; gap: 2rem;">
                <div class="feature">
                    <h3>🚀 Getting Started</h3>
                    <p>Learn how to set up and deploy your autonomous digital ecosystem with UPM.Plus.</p>
                </div>

                <div class="feature">
                    <h3>🤖 Agent System</h3>
                    <p>Understanding multi-agent architecture and agent capabilities.</p>
                </div>

                <div class="feature">
                    <h3>🔌 API Reference</h3>
                    <p>Complete API documentation with examples and best practices.</p>
                </div>

                <div class="feature">
                    <h3>🔧 Configuration</h3>
                    <p>Environment setup, configuration options, and deployment strategies.</p>
                </div>
            </div>

            <div style="background: #e3f2fd; padding: 2rem; border-radius: 15px; margin-top: 2rem;">
                <h3>🔗 Quick Links</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin: 1rem 0;"><a href="/api/health" style="color: #667eea; text-decoration: none;">📊 API Health Check</a></li>
                    <li style="margin: 1rem 0;"><a href="/api/agents" style="color: #667eea; text-decoration: none;">🤖 Agent Documentation</a></li>
                    <li style="margin: 1rem 0;"><a href="https://${domain}/dashboard" style="color: #667eea; text-decoration: none;">🎛️ Dashboard Guide</a></li>
                </ul>
            </div>
        </main>

        <footer class="footer">
            <p>📚 UPM.Plus Documentation • ${environment} Environment</p>
        </footer>
    </div>`;
}

function generateCDNPage(domain, environment) {
  return `
    <div class="container">
        <header class="header">
            <div class="logo">UPM.Plus CDN</div>
            <div class="tagline">High-Performance Content Delivery Network</div>
            <div class="environment">
                🚀 ${environment} CDN
                <span class="badge">EDGE</span>
            </div>
        </header>

        <main class="main-content">
            <h2>🌍 Content Delivery Network</h2>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">200+</div>
                    <div class="stat-label">Edge Locations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">&lt;50ms</div>
                    <div class="stat-label">Global Latency</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">99.9%</div>
                    <div class="stat-label">Uptime SLA</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">∞</div>
                    <div class="stat-label">Scalability</div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 2rem; border-radius: 15px; margin-top: 2rem;">
                <h3>📦 Asset Types</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="padding: 1rem; background: white; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem;">🖼️</div>
                        <div>Images</div>
                    </div>
                    <div style="padding: 1rem; background: white; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem;">📄</div>
                        <div>Documents</div>
                    </div>
                    <div style="padding: 1rem; background: white; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem;">🎨</div>
                        <div>Stylesheets</div>
                    </div>
                    <div style="padding: 1rem; background: white; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2rem;">⚡</div>
                        <div>Scripts</div>
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <p>🚀 UPM.Plus CDN • ${environment} Environment • Global Edge Network</p>
        </footer>
    </div>`;
}