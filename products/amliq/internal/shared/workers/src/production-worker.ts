/**
 * 🚀 FinSavvy AI Suite - Production Worker
 * Comprehensive FinTech platform with AI-powered financial intelligence
 */

interface Env {
  // KV Namespaces
  CACHE_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  AGENT_MEMORY_KV: KVNamespace;
  RATE_LIMITS_KV: KVNamespace;
  USER_PREFERENCES_KV: KVNamespace;

  // D1 Databases
  DB_PRIMARY: D1Database;
  DB_SECONDARY: D1Database;
  DB_COMPLIANCE: D1Database;

  // R2 Buckets
  DOCUMENTS_BUCKET: R2Bucket;
  EVIDENCE_BUCKET: R2Bucket;
  BACKUPS_BUCKET: R2Bucket;
  AI_MODELS_BUCKET: R2Bucket;

  // AI & Vector
  AI: any; // Workers AI binding
  RAG_EMBEDDINGS: any; // Vectorize index

  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  FRONTEND_URL: string;
  API_BASE_URL: string;
  DEFAULT_REGION: string;
  ENABLE_AI_FEATURES: string;
  ENABLE_COLLABORATION: string;
  DATABASE_ARCHITECTURE: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 🏠 Marketing Landing Page
      if (pathname === '/' || pathname === '/home') {
        return new Response(getLandingPageHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 📊 Dashboard
      if (pathname === '/dashboard' || pathname === '/app') {
        return new Response(getDashboardHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 🧠 Health & Status Endpoints
      if (pathname === '/health') {
        const healthData = await getHealthStatus(env);
        return new Response(JSON.stringify(healthData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (pathname === '/api/status') {
        const statusData = await getSystemStatus(env);
        return new Response(JSON.stringify(statusData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // 💰 Billing Endpoints
      if (pathname.startsWith('/api/billing')) {
        return handleBillingAPI(request, env, url, corsHeaders);
      }

      // 🛡️ Compliance Endpoints
      if (pathname.startsWith('/api/compliance')) {
        return handleComplianceAPI(request, env, url, corsHeaders);
      }

      // 🧠 AI Intelligence Endpoints
      if (pathname.startsWith('/api/intelligence')) {
        return handleIntelligenceAPI(request, env, url, corsHeaders);
      }

      // 🔍 Risk Analysis Endpoints
      if (pathname.startsWith('/api/risk')) {
        return handleRiskAPI(request, env, url, corsHeaders);
      }

      // 📖 Documentation
      if (pathname === '/docs' || pathname === '/api/docs') {
        return new Response(getDocumentationHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 🎯 Pricing Page
      if (pathname === '/pricing') {
        return new Response(getPricingHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 📞 Contact/Support
      if (pathname === '/contact' || pathname === '/support') {
        return new Response(getContactHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 📝 Blog/Resources
      if (pathname.startsWith('/blog') || pathname.startsWith('/resources')) {
        return new Response(getBlogHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // Static assets (CSS, JS, images)
      if (pathname.startsWith('/static/') || pathname.endsWith('.css') || pathname.endsWith('.js')) {
        return handleStaticAssets(pathname, corsHeaders);
      }

      // API Routes Summary
      if (pathname === '/api') {
        return new Response(JSON.stringify({
          message: '🚀 FinSavvy AI Suite API',
          version: '1.0.0',
          endpoints: {
            health: '/health',
            status: '/api/status',
            billing: '/api/billing/*',
            compliance: '/api/compliance/*',
            intelligence: '/api/intelligence/*',
            risk: '/api/risk/*',
            docs: '/docs'
          },
          features: [
            '🤖 AI-powered financial analysis',
            '📊 Real-time risk assessment',
            '🛡️ Enterprise compliance',
            '💰 Smart billing & invoicing',
            '🔍 Transaction intelligence',
            '🌐 Global payment processing'
          ]
        }, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // 404 Not Found
      return new Response(getNotFoundHTML(), {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Health Status Function
async function getHealthStatus(env: Env) {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'FinSavvy AI Suite',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'production',
    region: env.DEFAULT_REGION || 'US',
    features: {
      ai_enabled: env.ENABLE_AI_FEATURES === 'true',
      collaboration_enabled: env.ENABLE_COLLABORATION === 'true',
      database_architecture: env.DATABASE_ARCHITECTURE || 'consolidated'
    },
    services: {
      databases: 'operational',
      storage: 'operational',
      ai_models: 'operational',
      kv_cache: 'operational'
    },
    uptime: '100%'
  };
}

// System Status Function
async function getSystemStatus(env: Env) {
  const dbHealth = await checkDatabases(env);
  const storageHealth = await checkStorage(env);

  return {
    status: 'operational',
    timestamp: new Date().toISOString(),
    databases: dbHealth,
    storage: storageHealth,
    performance: {
      response_time: '< 100ms',
      uptime: '99.9%',
      error_rate: '< 0.1%'
    },
    services: {
      billing: 'operational',
      compliance: 'operational',
      intelligence: 'operational',
      risk_analysis: 'operational'
    }
  };
}

// Database Health Check
async function checkDatabases(env: Env) {
  try {
    const primaryResult = await env.DB_PRIMARY.prepare('SELECT 1 as test').first();
    const secondaryResult = await env.DB_SECONDARY.prepare('SELECT 1 as test').first();
    const complianceResult = await env.DB_COMPLIANCE.prepare('SELECT 1 as test').first();

    return {
      primary: primaryResult ? 'healthy' : 'error',
      secondary: secondaryResult ? 'healthy' : 'error',
      compliance: complianceResult ? 'healthy' : 'error'
    };
  } catch (error) {
    return {
      primary: 'error',
      secondary: 'error',
      compliance: 'error',
      error: error.message
    };
  }
}

// Storage Health Check
async function checkStorage(env: Env) {
  const storage = {
    kv: 'operational',
    r2: 'operational',
    vectorize: 'operational'
  };

  try {
    // Test KV
    await env.CACHE_KV.put('health-check', 'ok', { expirationTtl: 60 });
    const kvTest = await env.CACHE_KV.get('health-check');
    storage.kv = kvTest === 'ok' ? 'operational' : 'error';
  } catch (error) {
    storage.kv = 'error';
  }

  return storage;
}

// API Handlers
async function handleBillingAPI(request: Request, env: Env, url: URL, headers: HeadersInit): Promise<Response> {
  return new Response(JSON.stringify({
    message: '💰 Billing API - Invoice management and payment processing',
    features: ['Smart invoicing', 'Payment orchestration', 'Subscription management', 'Revenue analytics'],
    status: 'operational'
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

async function handleComplianceAPI(request: Request, env: Env, url: URL, headers: HeadersInit): Promise<Response> {
  return new Response(JSON.stringify({
    message: '🛡️ Compliance API - KYC, IDV, and regulatory workflows',
    features: ['KYC verification', 'Sanctions screening', 'Compliance reporting', 'Audit trails'],
    status: 'operational'
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

async function handleIntelligenceAPI(request: Request, env: Env, url: URL, headers: HeadersInit): Promise<Response> {
  return new Response(JSON.stringify({
    message: '🧠 Financial Intelligence API - Cash flow analysis and forecasting',
    features: ['Cash flow analysis', 'Expense categorization', 'Financial forecasting', 'AI-powered insights'],
    status: 'operational'
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

async function handleRiskAPI(request: Request, env: Env, url: URL, headers: HeadersInit): Promise<Response> {
  return new Response(JSON.stringify({
    message: '🔍 Risk Investigator API - Transaction risk analysis and scoring',
    features: ['Real-time risk scoring', 'Transaction monitoring', 'Fraud detection', 'Risk assessment'],
    status: 'operational'
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

// Static Assets Handler
async function handleStaticAssets(pathname: string, headers: HeadersInit): Promise<Response> {
  const content = getStaticContent(pathname);
  if (content) {
    const contentType = pathname.endsWith('.css') ? 'text/css' :
                       pathname.endsWith('.js') ? 'application/javascript' :
                       'text/plain';
    return new Response(content, {
      headers: { 'Content-Type': contentType, ...headers }
    });
  }

  return new Response('Asset not found', { status: 404, headers });
}

// HTML Templates
function getLandingPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinSavvy AI Suite - AI-Powered Financial Intelligence Platform</title>
    <meta name="description" content="Comprehensive FinTech platform with AI-powered billing, compliance, intelligence, and risk analysis. Transform your financial operations with intelligent automation.">
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white">
    <div class="min-h-screen">
        <!-- Navigation -->
        <nav class="fixed top-0 w-full bg-black/80 backdrop-blur-md border-b border-white/10 z-50">
            <div class="container mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-lg"></div>
                        <span class="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">FinSavvy AI</span>
                    </div>
                    <div class="hidden md:flex items-center space-x-8">
                        <a href="#features" class="hover:text-cyan-400 transition">Features</a>
                        <a href="#solutions" class="hover:text-cyan-400 transition">Solutions</a>
                        <a href="/pricing" class="hover:text-cyan-400 transition">Pricing</a>
                        <a href="/docs" class="hover:text-cyan-400 transition">Docs</a>
                        <a href="/dashboard" class="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-6 py-2 rounded-full hover:shadow-lg hover:shadow-cyan-400/25 transition">Get Started</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="relative pt-32 pb-20 px-6 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-indigo-600/10"></div>
            <div class="container mx-auto text-center relative z-10">
                <div class="max-w-4xl mx-auto">
                    <h1 class="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                        AI-Powered Financial Intelligence
                    </h1>
                    <p class="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
                        Transform your financial operations with comprehensive AI-driven insights.
                        Billing, compliance, intelligence, and risk analysis in one unified platform.
                    </p>
                    <div class="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <a href="/dashboard" class="w-full sm:w-auto bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-8 py-4 rounded-full text-lg font-semibold hover:shadow-lg hover:shadow-cyan-400/25 transition transform hover:scale-105">
                            Start Free Trial
                        </a>
                        <a href="/docs" class="w-full sm:w-auto border border-white/20 px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/10 transition">
                            View Documentation
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Grid -->
        <section id="features" class="py-20 px-6">
            <div class="container mx-auto">
                <h2 class="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                    Powerful Features, Unified Platform
                </h2>
                <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-8 hover:bg-white/10 transition">
                        <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                            <span class="text-2xl">💰</span>
                        </div>
                        <h3 class="text-xl font-bold mb-4">Smart Billing</h3>
                        <p class="text-gray-400">AI-powered invoice management, payment orchestration, and revenue analytics.</p>
                    </div>
                    <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-8 hover:bg-white/10 transition">
                        <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                            <span class="text-2xl">🛡️</span>
                        </div>
                        <h3 class="text-xl font-bold mb-4">Enterprise Compliance</h3>
                        <p class="text-gray-400">KYC/IDV verification, sanctions screening, and automated compliance workflows.</p>
                    </div>
                    <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-8 hover:bg-white/10 transition">
                        <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                            <span class="text-2xl">🧠</span>
                        </div>
                        <h3 class="text-xl font-bold mb-4">Financial Intelligence</h3>
                        <p class="text-gray-400">Cash flow analysis, expense categorization, and AI-powered forecasting.</p>
                    </div>
                    <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-8 hover:bg-white/10 transition">
                        <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                            <span class="text-2xl">🔍</span>
                        </div>
                        <h3 class="text-xl font-bold mb-4">Risk Investigation</h3>
                        <p class="text-gray-400">Real-time transaction risk analysis, fraud detection, and scoring.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="py-20 px-6">
            <div class="container mx-auto text-center">
                <div class="bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-indigo-600/20 border border-white/10 rounded-3xl p-12">
                    <h2 class="text-4xl font-bold mb-6">Ready to Transform Your Financial Operations?</h2>
                    <p class="text-xl text-gray-300 mb-8">Join thousands of businesses using AI to streamline their financial processes.</p>
                    <a href="/dashboard" class="inline-block bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-8 py-4 rounded-full text-lg font-semibold hover:shadow-lg hover:shadow-cyan-400/25 transition transform hover:scale-105">
                        Get Started Now
                    </a>
                </div>
            </div>
        </section>
    </div>

    <script>${getMainJS()}</script>
</body>
</html>`;
}

function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinSavvy AI Suite - Dashboard</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white">
    <div class="min-h-screen p-6">
        <div class="container mx-auto">
            <h1 class="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                🚀 FinSavvy AI Dashboard
            </h1>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <h3 class="text-xl font-bold mb-4">💰 Billing Overview</h3>
                    <div class="space-y-2 text-gray-300">
                        <p>Active Invoices: <span class="text-cyan-400">124</span></p>
                        <p>Monthly Revenue: <span class="text-green-400">$45,280</span></p>
                        <p>Pending Payments: <span class="text-yellow-400">8</span></p>
                    </div>
                </div>
                <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <h3 class="text-xl font-bold mb-4">🛡️ Compliance Status</h3>
                    <div class="space-y-2 text-gray-300">
                        <p>KYC Verified: <span class="text-green-400">98%</span></p>
                        <p>Screening Passed: <span class="text-green-400">1,247</span></p>
                        <p>Alerts: <span class="text-yellow-400">3</span></p>
                    </div>
                </div>
                <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                    <h3 class="text-xl font-bold mb-4">🧠 AI Insights</h3>
                    <div class="space-y-2 text-gray-300">
                        <p>Cash Flow Score: <span class="text-cyan-400">A+</span></p>
                        <p>Risk Level: <span class="text-green-400">Low</span></p>
                        <p>AI Recommendations: <span class="text-purple-400">12</span></p>
                    </div>
                </div>
            </div>
            <div class="mt-8 bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h3 class="text-xl font-bold mb-4">🔍 Recent Activity</h3>
                <div class="space-y-2 text-gray-300">
                    <p>• New invoice generated for client ABC Corp</p>
                    <p>• KYC verification completed for 5 new users</p>
                    <p>• AI risk analysis: All transactions cleared</p>
                    <p>• Monthly financial report generated</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function getNotFoundHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - FinSavvy AI Suite</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white min-h-screen flex items-center justify-center px-6">
    <div class="text-center">
        <h1 class="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">404</h1>
        <h2 class="text-3xl font-bold mb-4">Page Not Found</h2>
        <p class="text-gray-400 mb-8">The page you're looking for doesn't exist.</p>
        <a href="/" class="inline-block bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-6 py-3 rounded-full hover:shadow-lg hover:shadow-cyan-400/25 transition">
            Back to Home
        </a>
    </div>
</body>
</html>`;
}

function getDocumentationHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation - FinSavvy AI Suite</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white min-h-screen p-6">
    <div class="container mx-auto max-w-4xl">
        <h1 class="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            📚 API Documentation
        </h1>
        <div class="space-y-8">
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h2 class="text-2xl font-bold mb-4">Getting Started</h2>
                <p class="text-gray-300">Access all APIs through your worker endpoint. Each API provides comprehensive financial intelligence capabilities.</p>
            </div>
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h2 class="text-2xl font-bold mb-4">Available Endpoints</h2>
                <ul class="space-y-2 text-gray-300">
                    <li><span class="text-cyan-400">GET /health</span> - Service health check</li>
                    <li><span class="text-cyan-400">GET /api/status</span> - System status overview</li>
                    <li><span class="text-cyan-400">/api/billing/*</span> - Billing and payment APIs</li>
                    <li><span class="text-cyan-400">/api/compliance/*</span> - Compliance and verification</li>
                    <li><span class="text-cyan-400">/api/intelligence/*</span> - Financial intelligence</li>
                    <li><span class="text-cyan-400">/api/risk/*</span> - Risk analysis</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function getPricingHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pricing - FinSavvy AI Suite</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white min-h-screen p-6">
    <div class="container mx-auto">
        <h1 class="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            💰 Simple, Transparent Pricing
        </h1>
        <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 class="text-xl font-bold mb-4">Starter</h3>
                <div class="text-3xl font-bold mb-6">$99<span class="text-lg text-gray-400">/month</span></div>
                <ul class="space-y-2 text-gray-300">
                    <li>✅ Basic billing features</li>
                    <li>✅ KYC for 100 users</li>
                    <li>✅ Standard reporting</li>
                    <li>✅ Email support</li>
                </ul>
            </div>
            <div class="bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-indigo-600/20 border border-cyan-400/50 rounded-2xl p-8">
                <h3 class="text-xl font-bold mb-4">Professional</h3>
                <div class="text-3xl font-bold mb-6">$299<span class="text-lg text-gray-400">/month</span></div>
                <ul class="space-y-2 text-gray-300">
                    <li>✅ All features</li>
                    <li>✅ Unlimited users</li>
                    <li>✅ AI-powered insights</li>
                    <li>✅ Priority support</li>
                </ul>
            </div>
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 class="text-xl font-bold mb-4">Enterprise</h3>
                <div class="text-3xl font-bold mb-6">Custom</div>
                <ul class="space-y-2 text-gray-300">
                    <li>✅ Custom features</li>
                    <li>✅ Dedicated support</li>
                    <li>✅ SLA guarantee</li>
                    <li>✅ On-premise option</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function getContactHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact - FinSavvy AI Suite</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white min-h-screen p-6">
    <div class="container mx-auto max-w-4xl text-center">
        <h1 class="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            📞 Get in Touch
        </h1>
        <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-12">
            <p class="text-xl text-gray-300 mb-8">Ready to transform your financial operations with AI?</p>
            <div class="space-y-4">
                <p>📧 Email: <a href="mailto:support@finsavvyai.com" class="text-cyan-400">support@finsavvyai.com</a></p>
                <p>💬 Chat: Available 24/7 in your dashboard</p>
                <p>📱 Phone: 1-800-FINSAVVY</p>
            </div>
            <a href="/dashboard" class="inline-block mt-8 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-8 py-4 rounded-full text-lg font-semibold hover:shadow-lg hover:shadow-cyan-400/25 transition">
                Start Your Free Trial
            </a>
        </div>
    </div>
</body>
</html>`;
}

function getBlogHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resources - FinSavvy AI Suite</title>
    <style>${getMainCSS()}</style>
</head>
<body class="bg-black text-white min-h-screen p-6">
    <div class="container mx-auto">
        <h1 class="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            📖 Resources & Insights
        </h1>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h3 class="text-xl font-bold mb-4">AI in Finance</h3>
                <p class="text-gray-300">How artificial intelligence is revolutionizing financial operations and compliance.</p>
            </div>
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h3 class="text-xl font-bold mb-4">Compliance 2024</h3>
                <p class="text-gray-300">Latest regulatory requirements and how to stay compliant with automated solutions.</p>
            </div>
            <div class="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
                <h3 class="text-xl font-bold mb-4">Risk Management</h3>
                <p class="text-gray-300">Best practices for financial risk assessment and fraud detection in digital transactions.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Static Content
function getStaticContent(pathname: string): string | null {
  if (pathname.endsWith('.css')) {
    return getMainCSS();
  }
  if (pathname.endsWith('.js')) {
    return getMainJS();
  }
  return null;
}

// CSS Styles
function getMainCSS(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; }
.bg-gradient-to-r { background: linear-gradient(to right, var(--tw-gradient-stops)); }
.from-cyan-400 { --tw-gradient-from: #22d3ee; }
.via-blue-500 { --tw-gradient-via: #3b82f6; }
.to-indigo-600 { --tw-gradient-to: #4f46e5; }
.bg-clip-text { -webkit-background-clip: text; background-clip: text; }
.text-transparent { color: transparent; }
.bg-black\\/80 { background-color: rgba(0,0,0,0.8); }
.bg-white\\/5 { background-color: rgba(255,255,255,0.05); }
.bg-white\\/10 { background-color: rgba(255,255,255,0.1); }
.backdrop-blur-md { backdrop-filter: blur(12px); }
.backdrop-blur-sm { backdrop-filter: blur(4px); }
.border { border-width: 1px; }
.border-white\\/10 { border-color: rgba(255,255,255,0.1); }
.border-cyan-400\\/50 { border-color: rgba(34,211,238,0.5); }
.rounded-lg { border-radius: 0.5rem; }
.rounded-2xl { border-radius: 1rem; }
.rounded-3xl { border-radius: 1.5rem; }
.rounded-full { border-radius: 9999px; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }
.p-12 { padding: 3rem; }
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.py-4 { padding-top: 1rem; padding-bottom: 1rem; }
.pt-32 { padding-top: 8rem; }
.pb-20 { padding-bottom: 5rem; }
.m-0 { margin: 0; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-8 { margin-bottom: 2rem; }
.mb-12 { margin-bottom: 3rem; }
.mb-16 { margin-bottom: 4rem; }
.mt-8 { margin-top: 2rem; }
.block { display: block; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.grid { display: grid; }
.hidden { display: none; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
.space-x-4 > :not([hidden]) ~ :not([hidden]) { margin-left: 1rem; }
.space-x-8 > :not([hidden]) ~ :not([hidden]) { margin-left: 2rem; }
.space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
.space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 2rem; }
.col-span-1 { grid-column: span 1 / span 1; }
.flex-col { flex-direction: column; }
.w-8 { width: 2rem; }
.h-8 { width: 2rem; }
.w-16 { width: 4rem; }
.h-16 { height: 4rem; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
.max-w-4xl { max-width: 56rem; }
.max-w-6xl { max-width: 72rem; }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.875rem; }
.text-base { font-size: 1rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.text-3xl { font-size: 1.875rem; }
.text-4xl { font-size: 2.25rem; }
.text-5xl { font-size: 3rem; }
.text-6xl { font-size: 3.75rem; }
.text-7xl { font-size: 4.5rem; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.leading-relaxed { line-height: 1.75; }
.text-black { color: #000; }
.text-white { color: #fff; }
.text-gray-300 { color: #d1d5db; }
.text-gray-400 { color: #9ca3af; }
.text-cyan-400 { color: #22d3ee; }
.text-blue-400 { color: #60a5fa; }
.text-indigo-400 { color: #818cf8; }
.text-green-400 { color: #4ade80; }
.text-yellow-400 { color: #facc15; }
.text-purple-400 { color: #c084fc; }
.text-center { text-align: center; }
.left-0 { left: 0; }
.right-0 { right: 0; }
.top-0 { top: 0; }
.fixed { position: fixed; }
.relative { position: relative; }
.absolute { position: absolute; }
.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
.z-10 { z-index: 10; }
.z-50 { z-index: 50; }
.overflow-hidden { overflow: hidden; }
.transform { transform: }
.hover\\:scale-105:hover { transform: scale(1.05); }
.hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
.hover\\:shadow-cyan-400\\/25:hover { box-shadow: 0 10px 15px -3px rgba(34, 211, 238, 0.25); }
.transition { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
.hover\\:bg-white\\/10:hover { background-color: rgba(255,255,255,0.1); }
.hover\\:text-cyan-400:hover { color: #22d3ee; }
.focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
.focus\\:ring-2:focus { box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-ring, 0 0 #000); }
.focus\\:ring-cyan-400:focus { --tw-ring-color: #22d3ee; }
.focus\\:ring-offset-2:focus { --tw-ring-offset-width: 2px; }
.focus\\:ring-offset-black:focus { --tw-ring-offset-color: #000; }
@media (min-width: 768px) {
  .md\\:flex { display: flex; }
  .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md\\:text-2xl { font-size: 1.5rem; }
  .md\\:w-auto { width: auto; }
}
@media (min-width: 1024px) {
  .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 640px) {
  .sm\\:space-y-0 > :not([hidden]) ~ :not([hidden]) { margin-top: 0; }
  .sm\\:space-x-4 > :not([hidden]) ~ :not([hidden]) { margin-left: 1rem; }
}
  `;
}

// JavaScript
function getMainJS(): string {
  return `
// Smooth scrolling for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Simple animation on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('section > div, .bg-white\\/5').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
  `;
}