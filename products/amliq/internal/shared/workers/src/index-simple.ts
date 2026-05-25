/**
 * FinTech Suite - Cloudflare Worker
 * SEO-Optimized Subdomain Routing for finsavvyai.com
 */

interface Env {
  // AI and Machine Learning
  AI: any;

  // D1 Databases
  DB_PRIMARY: D1Database;
  DB_SECONDARY: D1Database;
  DB_COMPLIANCE: D1Database;

  // KV Namespaces
  CACHE_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  AGENT_MEMORY_KV: KVNamespace;
  RATE_LIMITS_KV: KVNamespace;
  USER_PREFERENCES_KV: KVNamespace;

  // R2 Buckets
  DOCUMENTS_BUCKET: R2Bucket;
  EVIDENCE_BUCKET: R2Bucket;
  BACKUPS_BUCKET: R2Bucket;
  AI_MODELS_BUCKET: R2Bucket;

  // Queues (commented out for now)
  // BILLING_QUEUE: Queue;
  // COMPLIANCE_QUEUE: Queue;
  // INTELLIGENCE_QUEUE: Queue;
  // RISK_QUEUE: Queue;
  // NOTIFICATION_QUEUE: Queue;

  // Vectorize
  RAG_EMBEDDINGS: VectorizeIndex;

  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  AI_MODEL: string;
  EMBEDDING_MODEL: string;
  FRONTEND_URL: string;
  API_BASE_URL: string;
  DEFAULT_REGION: string;
  DATABASE_ARCHITECTURE: string;
}

// SEO-optimized response generator
function generateSEOResponse(host: string, title: string, description: string, service: string) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="keywords" content="FinTech, AI billing, KYC compliance, financial intelligence, risk management, ${service}">
    <meta name="author" content="FinSavvy AI">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${host}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">

    <!-- Schema.org structured data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "FinSavvy AI - ${service}",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            flex: 1;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .logo {
            font-size: 3rem;
            font-weight: bold;
            background: linear-gradient(135deg, #00d4ff, #0099ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #a0a0ff;
            margin-bottom: 2rem;
        }
        .services {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        .service-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(10px);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .service-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 212, 255, 0.2);
        }
        .service-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #00d4ff, #0099ff);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        .service-title {
            font-size: 1.3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: #00d4ff;
        }
        .service-description {
            color: #b0b0ff;
            line-height: 1.6;
        }
        .api-status {
            background: rgba(0, 255, 0, 0.1);
            border: 1px solid rgba(0, 255, 0, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 2rem;
            text-align: center;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #00ff00;
            border-radius: 50%;
            margin-right: 0.5rem;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .footer {
            text-align: center;
            padding: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: #8080ff;
        }
        .footer a {
            color: #00d4ff;
            text-decoration: none;
            margin: 0 1rem;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .current-service {
            background: rgba(0, 212, 255, 0.1);
            border: 2px solid #00d4ff;
        }
        .endpoint-list {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
        .endpoint {
            color: #00d4ff;
            font-family: 'Monaco', 'Menlo', monospace;
            margin: 0.5rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">FinSavvy AI</div>
            <div class="subtitle">AI-Powered Financial Technology Platform</div>
        </div>

        <div class="api-status">
            <span class="status-indicator"></span>
            <strong>All Systems Operational</strong> - Real-time status monitoring
        </div>

        <div class="services">
            <div class="service-card current-service">
                <div class="service-icon">💳</div>
                <div class="service-title">${service}</div>
                <div class="service-description">${description}</div>
            </div>

            <div class="service-card">
                <div class="service-icon">🔍</div>
                <div class="service-title">Smart Billing & Payments</div>
                <div class="service-description">AI-powered invoice management, automated payment processing, and intelligent financial analytics.</div>
            </div>

            <div class="service-card">
                <div class="service-icon">🛡️</div>
                <div class="service-title">Enterprise Compliance</div>
                <div class="service-description">Automated KYC/AML screening, sanctions checking, and comprehensive regulatory compliance.</div>
            </div>

            <div class="service-card">
                <div class="service-icon">📊</div>
                <div class="service-title">Financial Intelligence</div>
                <div class="service-description">AI-driven cash flow analysis, expense categorization, and predictive financial insights.</div>
            </div>

            <div class="service-card">
                <div class="service-icon">⚠️</div>
                <div class="service-title">Risk Investigation</div>
                <div class="service-description">Real-time transaction monitoring, fraud detection, and automated risk assessment.</div>
            </div>

            <div class="service-card">
                <div class="service-icon">🤖</div>
                <div class="service-title">AI Assistant</div>
                <div class="service-description">Intelligent financial assistant for automated insights and decision support.</div>
            </div>
        </div>

        ${service.includes('API') ? `
        <div class="endpoint-list">
            <h3>Available API Endpoints:</h3>
            <div class="endpoint">GET /health - System health check</div>
            <div class="endpoint">GET /api/status - Service status</div>
            <div class="endpoint">POST /api/billing/invoices - Create invoice</div>
            <div class="endpoint">GET /api/compliance/kyc - KYC status</div>
            <div class="endpoint">GET /api/intelligence/transactions - Transaction analysis</div>
            <div class="endpoint">POST /api/risk/assessment - Risk assessment</div>
        </div>
        ` : ''}
    </div>

    <div class="footer">
        <p>&copy; 2025 FinSavvy AI. All rights reserved.</p>
        <nav>
            <a href="https://suite.finsavvyai.com">Suite</a>
            <a href="https://api.finsavvyai.com/docs">API Docs</a>
            <a href="https://status.finsavvyai.com">Status</a>
            <a href="mailto:contact@finsavvyai.com">Contact</a>
        </nav>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// Main worker request handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const host = url.hostname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          },
        });
      }

      // Health check endpoint (JSON API)
      if (path === '/health' || path === '/api/health') {
        return Response.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'unknown',
          version: '1.0.0',
          services: {
            billing: true,
            compliance: true,
            intelligence: true,
            risk: true,
          },
        });
      }

      // API status endpoint
      if (path === '/api/status') {
        try {
          const primaryResult = await env.DB_PRIMARY.prepare('SELECT COUNT(*) as count FROM organizations').first();
          const secondaryResult = await env.DB_SECONDARY.prepare('SELECT COUNT(*) as count FROM organizations').first();
          const complianceResult = await env.DB_COMPLIANCE.prepare('SELECT COUNT(*) as count FROM organizations').first();

          return Response.json({
            status: 'operational',
            databases: {
              primary: { connected: true, tables: primaryResult?.count || 0 },
              secondary: { connected: true, tables: secondaryResult?.count || 0 },
              compliance: { connected: true, tables: complianceResult?.count || 0 },
            },
            services: {
              ai: !!env.AI,
              kv: !!env.CACHE_KV,
              r2: !!env.DOCUMENTS_BUCKET,
              vectorize: !!env.RAG_EMBEDDINGS,
            },
            environment: env.ENVIRONMENT,
            architecture: env.DATABASE_ARCHITECTURE,
          });
        } catch (error) {
          return Response.json({
            status: 'degraded',
            error: error.message,
          }, { status: 500 });
        }
      }

      // Handle different subdomains with SEO-optimized content
      if (host.includes('finsavvyai.com')) {
        // Main suite platform
        if (host === 'suite.finsavvyai.com' || host === 'app.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'FinSavvy AI Suite - Complete Financial Technology Platform',
            'Unified FinTech platform with AI-powered billing, compliance, intelligence, and risk management. Streamline your financial operations with advanced automation.',
            'Complete Financial Platform'
          );
        }

        // API gateway
        if (host === 'api.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'FinSavvy AI API Gateway | RESTful APIs for Financial Technology',
            'Comprehensive API gateway for billing, compliance, intelligence, and risk management services. Build powerful financial applications with our RESTful APIs.',
            'API Gateway'
          );
        }

        // Service-specific subdomains
        if (host === 'billing.finsavvyai.com' || host === 'invoicing.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Smart Billing & Payment SDK | AI-Powered Invoicing | FinSavvy AI',
            'Advanced billing and payment SDK with AI-powered invoice management, automated payment processing, and intelligent financial analytics. Perfect for modern businesses.',
            'Smart Billing & Payments'
          );
        }

        if (host === 'compliance.finsavvyai.com' || host === 'kyc.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Enterprise Compliance Platform | KYC & AML Compliance | FinSavvy AI',
            'Comprehensive compliance platform with automated KYC/AML screening, sanctions checking, and regulatory reporting for financial institutions. Ensure compliance with confidence.',
            'Enterprise Compliance Platform'
          );
        }

        if (host === 'intelligence.finsavvyai.com' || host === 'ai-finance.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Financial Intelligence System | AI Analytics | FinSavvy AI',
            'AI-powered financial intelligence platform with cash flow analysis, expense categorization, and predictive analytics for smarter financial decisions. Transform your data into insights.',
            'Financial Intelligence System'
          );
        }

        if (host === 'risk.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Risk Investigator Engine | Real-time Risk Assessment | FinSavvy AI',
            'Advanced risk assessment engine with real-time transaction monitoring, fraud detection, and automated risk scoring for financial security. Protect your business with AI-powered risk management.',
            'Risk Investigator Engine'
          );
        }

        // Dashboard and analytics
        if (host === 'dashboard.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Financial Dashboard | Real-time Analytics | FinSavvy AI',
            'Comprehensive financial dashboard with real-time analytics, customizable reports, and AI-powered insights. Monitor your financial health in one centralized platform.',
            'Financial Analytics Dashboard'
          );
        }

        // Enterprise solutions
        if (host === 'enterprise.finsavvyai.com') {
          return generateSEOResponse(
            host,
            'Enterprise FinTech Solutions | Scalable Financial Platform | FinSavvy AI',
            'Enterprise-grade financial technology solutions designed for large-scale operations. Advanced compliance, security, and scalability for modern financial institutions.',
            'Enterprise FinTech Solutions'
          );
        }
      }

      // Default JSON response for other hosts
      return Response.json({
        message: 'FinSavvy AI Suite',
        version: '1.0.0',
        environment: env.ENVIRONMENT,
        services: {
          billing: 'https://billing.finsavvyai.com',
          compliance: 'https://compliance.finsavvyai.com',
          intelligence: 'https://intelligence.finsavvyai.com',
          risk: 'https://risk.finsavvyai.com',
          api: 'https://api.finsavvyai.com',
        },
        endpoints: {
          health: '/health',
          status: '/api/status',
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return Response.json({
        error: 'Internal server error',
        message: error.message,
      }, { status: 500 });
    }
  },
};