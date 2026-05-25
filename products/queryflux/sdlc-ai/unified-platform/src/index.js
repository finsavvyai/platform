// Unified Compliance Platform - Single Entry Point
// Integrates SDLC, Qestro, PipeWarden, and MCPOverflow

import { LAMEnhancedSDLC } from '../services/lam-enhanced-sdlc.js';
import { QestroComplianceAdapter } from './adapters/qestro-adapter.js';
import { PipeWardenComplianceAdapter } from './adapters/pipewarden-adapter.js';
import { MCPOverflowComplianceAdapter } from './adapters/mcpoverflow-adapter.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Platform',
        },
      });
    }

    try {
      // API Routes
      if (path.startsWith('/api/v1/')) {
        return await handleAPIRequest(request, env, url, method);
      }

      // Platform Routes
      if (path.startsWith('/qestro/')) {
        return await handleQestroRequest(request, env, url, method);
      }

      if (path.startsWith('/pipewarden/')) {
        return await handlePipeWardenRequest(request, env, url, method);
      }

      if (path.startsWith('/mcpoverflow/')) {
        return await handleMCPOverflowRequest(request, env, url, method);
      }

      // SDLC Routes
      if (path.startsWith('/sdlc/')) {
        return await handleSDLCCRequest(request, env, url, method);
      }

      // Default: Main dashboard
      if (path === '/' || path === '/dashboard') {
        return await handleDashboard(request, env);
      }

      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Unified Platform Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Initialize shared SDLC engine
let sdlcEngine = null;

async function getSDLCEngine(env) {
  if (!sdlcEngine) {
    sdlcEngine = new LAMEnhancedSDLC({
      knowledgeBase: env.SDLC_KNOWLEDGE_BASE,
      policyEngine: env.SDLC_POLICY_ENGINE,
      autonomousLearning: true,
      safety: {
        humanApprovalRequired: ['critical', 'high'],
        rollbackEnabled: true,
        monitoringLevel: 'comprehensive'
      }
    });
  }
  return sdlcEngine;
}

// API Request Handler
async function handleAPIRequest(request, env, url, method) {
  const path = url.pathname.replace('/api/v1', '');
  const sdlc = await getSDLCEngine(env);

  switch (true) {
    case path === '/compliance/process' && method === 'POST':
      return await processComplianceRequest(request, sdlc);

    case path === '/compliance/overview' && method === 'GET':
      return await getComplianceOverview(request, env, sdlc);

    case path === '/compliance/validate' && method === 'POST':
      return await validateComplianceRequest(request, sdlc);

    case path === '/compliance/insights' && method === 'GET':
      return await getComplianceInsights(request, env, sdlc);

    case path === '/auth/login' && method === 'POST':
      return await handleUnifiedAuth(request, env);

    case path === '/auth/switch' && method === 'POST':
      return await handlePlatformSwitch(request, env);

    case path === '/billing/usage' && method === 'GET':
      return await getUnifiedBilling(request, env);

    default:
      return new Response('API endpoint not found', { status: 404 });
  }
}

// Process compliance request across all platforms
async function processComplianceRequest(request, sdlc) {
  try {
    const { platform, type, data, context } = await request.json();

    // Validate required fields
    if (!platform || !type || !data) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: platform, type, data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get appropriate adapter
    const adapter = getPlatformAdapter(platform, sdlc);
    if (!adapter) {
      return new Response(JSON.stringify({
        error: `Unsupported platform: ${platform}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process request through SDLC compliance layer
    const result = await adapter.processRequest(type, data, context);

    return new Response(JSON.stringify({
      success: true,
      platform,
      type,
      result,
      processingTime: result.processingTime,
      lamMetadata: result.lamMetadata
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get platform adapter
function getPlatformAdapter(platform, sdlc) {
  const adapters = {
    'qestro': new QestroComplianceAdapter(sdlc),
    'pipewarden': new PipeWardenComplianceAdapter(sdlc),
    'mcpoverflow': new MCPOverflowComplianceAdapter(sdlc),
    'sdlc': sdlc
  };

  return adapters[platform];
}

// Get unified compliance overview
async function getComplianceOverview(request, env, sdlc) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const timeRange = url.searchParams.get('timeRange') || '7d';

  if (!userId) {
    return new Response(JSON.stringify({
      error: 'userId parameter required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const dashboard = new UnifiedComplianceDashboard(sdlc);
    const overview = await dashboard.getUnifiedOverview(userId, timeRange);

    return new Response(JSON.stringify(overview), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle unified authentication
async function handleUnifiedAuth(request, env) {
  try {
    const { email, password, company } = await request.json();

    // Authenticate user
    const user = await authenticateUser(email, password, env);

    if (!user) {
      return new Response(JSON.stringify({
        error: 'Invalid credentials'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate platform tokens
    const tokens = await generatePlatformTokens(user, env);

    // Set compliance profile
    await setComplianceProfile(user, env);

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan
      },
      tokens,
      dashboardUrl: '/dashboard'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle platform switching
async function handlePlatformSwitch(request, env) {
  try {
    const { userId, targetPlatform, currentToken } = await request.json();

    // Validate user and token
    const user = await validateUserToken(userId, currentToken, env);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Invalid authentication'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check platform access
    const hasAccess = await validatePlatformAccess(user, targetPlatform, env);
    if (!hasAccess) {
      return new Response(JSON.stringify({
        error: 'Access denied for platform: ' + targetPlatform
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate new platform token
    const newToken = await generatePlatformToken(user, targetPlatform, env);

    const platformUrls = {
      'qestro': '/qestro/dashboard',
      'pipewarden': '/pipewarden/policies',
      'mcpoverflow': '/mcpoverflow/tools',
      'sdlc': '/sdlc/monitoring'
    };

    return new Response(JSON.stringify({
      success: true,
      platform: targetPlatform,
      url: platformUrls[targetPlatform],
      token: newToken
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle main dashboard
async function handleDashboard(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unified Compliance Platform</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .platform-card {
            transition: all 0.3s ease;
            cursor: pointer;
        }
        .platform-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .compliance-score {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    </style>
</head>
<body class="bg-gray-50">
    <nav class="bg-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                        <i class="fas fa-shield-alt text-white"></i>
                    </div>
                    <span class="ml-3 text-xl font-bold text-gray-900">Unified Compliance</span>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-600">Welcome back</span>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-user mr-2"></i>
                        Profile
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 py-12">
        <!-- Hero Section -->
        <div class="text-center mb-12">
            <h1 class="text-4xl font-bold text-gray-900 mb-4">
                Your Unified Compliance Platform
            </h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                Manage compliance across Qestro, PipeWarden, MCPOverflow, and SDLC from a single dashboard
            </p>
        </div>

        <!-- Platform Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div class="platform-card bg-white rounded-xl shadow-lg p-6" onclick="switchPlatform('qestro')">
                <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <i class="fas fa-network-wired text-blue-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Qestro</h3>
                <p class="text-gray-600 text-sm mb-4">Orchestration Compliance</p>
                <div class="flex justify-between items-center">
                    <span class="text-2xl font-bold compliance-score">98.5%</span>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
            </div>

            <div class="platform-card bg-white rounded-xl shadow-lg p-6" onclick="switchPlatform('pipewarden')">
                <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <i class="fas fa-shield-alt text-green-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">PipeWarden</h3>
                <p class="text-gray-600 text-sm mb-4">Security Compliance</p>
                <div class="flex justify-between items-center">
                    <span class="text-2xl font-bold compliance-score">97.2%</span>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
            </div>

            <div class="platform-card bg-white rounded-xl shadow-lg p-6" onclick="switchPlatform('mcpoverflow')">
                <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <i class="fas fa-plug text-purple-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">MCPOverflow</h3>
                <p class="text-gray-600 text-sm mb-4">MCP Platform</p>
                <div class="flex justify-between items-center">
                    <span class="text-2xl font-bold compliance-score">96.8%</span>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
            </div>

            <div class="platform-card bg-white rounded-xl shadow-lg p-6" onclick="switchPlatform('sdlc')">
                <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                    <i class="fas fa-robot text-orange-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">SDLC Core</h3>
                <p class="text-gray-600 text-sm mb-4">AI Compliance</p>
                <div class="flex justify-between items-center">
                    <span class="text-2xl font-bold compliance-score">99.1%</span>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                </div>
            </div>
        </div>

        <!-- Unified Metrics -->
        <div class="bg-white rounded-xl shadow-lg p-8 mb-12">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Unified Compliance Overview</h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="text-center">
                    <div class="text-3xl font-bold text-green-600 mb-2">98.4%</div>
                    <div class="text-sm text-gray-600">Average Compliance Score</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-blue-600 mb-2">45.2K</div>
                    <div class="text-sm text-gray-600">Requests Processed Today</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-purple-600 mb-2">12</div>
                    <div class="text-sm text-gray-600">Violations Prevented</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-orange-600 mb-2">247ms</div>
                    <div class="text-sm text-gray-600">Average Response Time</div>
                </div>
            </div>
        </div>

        <!-- LAM Insights -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
            <h2 class="text-2xl font-bold mb-4">🧠 AI-Powered Insights</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 class="font-semibold mb-2">🔍 Pattern Detected</h3>
                    <p class="text-sm opacity-90">Increased GDPR violations during EU business hours. Auto-applied EU-only routing policy.</p>
                </div>
                <div>
                    <h3 class="font-semibold mb-2">⚡ Optimization Applied</h3>
                    <p class="text-sm opacity-90">Switched 23% of healthcare requests to AWS Bedrock for better HIPAA compliance.</p>
                </div>
                <div>
                    <h3 class="font-semibold mb-2">📊 Risk Mitigation</h3>
                    <p class="text-sm opacity-90">Enhanced monitoring enabled for financial workflows. Zero violations in 48 hours.</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        function switchPlatform(platform) {
            // Switch to platform with authentication
            fetch('/api/v1/auth/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: 'current_user_id', // Get from auth context
                    targetPlatform: platform
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = data.url;
                } else {
                    alert('Error switching platform: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error switching platform');
            });
        }
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// Helper functions (simplified implementations)
async function authenticateUser(email, password, env) {
  // Implementation would check against user database
  return {
    id: 'user_123',
    email: email,
    name: 'John Doe',
    company: 'Tech Corp',
    plan: 'enterprise'
  };
}

async function generatePlatformTokens(user, env) {
  // Implementation would generate JWT tokens for each platform
  return {
    qestro: 'token_qestro_abc123',
    pipewarden: 'token_pipewarden_def456',
    mcpoverflow: 'token_mcpoverflow_ghi789',
    sdlc: 'token_sdlc_jkl012'
  };
}

async function setComplianceProfile(user, env) {
  // Implementation would set up user's compliance preferences
  console.log('Setting compliance profile for user:', user.id);
}

async function validateUserToken(userId, token, env) {
  // Implementation would validate JWT token
  return true;
}

async function validatePlatformAccess(user, platform, env) {
  // Implementation would check user's platform access permissions
  return true;
}

async function generatePlatformToken(user, platform, env) {
  // Implementation would generate new token for specific platform
  return `token_${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Unified Compliance Dashboard Class
class UnifiedComplianceDashboard {
  constructor(sdlcEngine) {
    this.sdlc = sdlcEngine;
    this.platforms = ['qestro', 'pipewarden', 'mcpoverflow', 'sdlc'];
  }

  async getUnifiedOverview(userId, timeRange = '7d') {
    // Simulate fetching data from all platforms
    const overview = {
      user: { id: userId },
      platforms: {},
      combinedMetrics: {},
      crossPlatformInsights: {}
    };

    // Get data from each platform
    for (const platform of this.platforms) {
      overview.platforms[platform] = {
        name: platform,
        complianceScore: 95 + Math.random() * 5,
        requestsProcessed: Math.floor(Math.random() * 10000),
        violationsBlocked: Math.floor(Math.random() * 50),
        lastActivity: new Date().toISOString()
      };
    }

    // Calculate combined metrics
    const totalRequests = Object.values(overview.platforms)
      .reduce((sum, p) => sum + p.requestsProcessed, 0);
    const avgComplianceScore = Object.values(overview.platforms)
      .reduce((sum, p) => sum + p.complianceScore, 0) / this.platforms.length;
    const totalViolationsBlocked = Object.values(overview.platforms)
      .reduce((sum, p) => sum + p.violationsBlocked, 0);

    overview.combinedMetrics = {
      totalRequests,
      averageComplianceScore: avgComplianceScore.toFixed(1),
      violationsBlocked: totalViolationsBlocked,
      lamDecisions: Math.floor(Math.random() * 100)
    };

    // Generate cross-platform insights
    overview.crossPlatformInsights = await this.sdlc.policyAgent.generateCrossPlatformInsights(overview);

    return overview;
  }
}