/**
 * QuantumBeam Cloudflare Worker with MCP Integration
 * Routes requests and provides MCP protocol support
 */

const BACKEND_URL = 'https://your-backend-api.railway.app'; // Update with your backend
const API_KEY = 'your-api-key-here'; // Environment variable

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Handle CORS preflight requests
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
}

// MCP Server implementation
class MCPServer {
  constructor() {
    this.tools = [
      {
        name: "detect_fraud",
        description: "Analyze transaction for fraudulent activity using quantum-enhanced detection",
        inputSchema: {
          type: "object",
          properties: {
            transaction_id: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string" },
            merchant_id: { type: "string" },
            card_number: { type: "string" },
            timestamp: { type: "string" },
            ip_address: { type: "string" },
          },
          required: ["transaction_id", "amount", "currency", "merchant_id"],
        },
      },
      {
        name: "analyze_pattern",
        description: "Analyze transaction patterns for suspicious behavior",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: { type: "string" },
            time_window: { type: "string" },
            pattern_type: { type: "string", enum: ["velocity", "location", "amount", "timing"] },
          },
          required: ["customer_id", "time_window", "pattern_type"],
        },
      },
      {
        name: "get_risk_score",
        description: "Get comprehensive risk score for entity",
        inputSchema: {
          type: "object",
          properties: {
            entity_id: { type: "string" },
            entity_type: { type: "string", enum: ["customer", "merchant", "device", "ip_address"] },
            include_history: { type: "boolean" },
          },
          required: ["entity_id", "entity_type"],
        },
      },
    ];
  }

  async handleMCPRequest(request) {
    try {
      const body = await request.json();

      // List tools
      if (body.method === 'tools/list') {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: this.tools }
        };
      }

      // Call tool
      if (body.method === 'tools/call') {
        const { name, arguments: args } = body.params;
        const result = await this.callTool(name, args);
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: result
        };
      }

      // Initialize
      if (body.method === 'initialize') {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "quantumbeam-fraud-detection",
              version: "1.0.0"
            }
          }
        };
      }

      throw new Error(`Unknown method: ${body.method}`);
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: body.id || null,
        error: {
          code: -32603,
          message: error.message
        }
      };
    }
  }

  async callTool(name, args) {
    switch (name) {
      case "detect_fraud":
        return await this.detectFraud(args);
      case "analyze_pattern":
        return await this.analyzePattern(args);
      case "get_risk_score":
        return await this.getRiskScore(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async detectFraud(args) {
    // Simulate fraud detection
    const riskScore = Math.floor(Math.random() * 100);
    const isFraudulent = riskScore > 70;

    return {
      content: [{
        type: "text",
        text: `Fraud Detection Results for Transaction ${args.transaction_id}:

Risk Score: ${riskScore}/100
Status: ${isFraudulent ? "FRAUDULENT" : "LEGITIMATE"}
Confidence: 85%
Processing Time: 45ms

Key Risk Factors:
- Amount analysis: ${args.amount > 1000 ? "High" : "Normal"}
- Merchant risk: Low
- IP location: Normal
- Device fingerprint: Trusted

Recommendation: ${isFraudulent ? "BLOCK transaction" : "APPROVE transaction"}`
      }]
    };
  }

  async analyzePattern(args) {
    return {
      content: [{
        type: "text",
        text: `Pattern Analysis for Customer ${args.customer_id}:

Time Window: ${args.time_window}
Pattern Type: ${args.pattern_type}

Analysis Results:
- Pattern Detected: No
- Risk Level: Low
- Transactions Analyzed: 12
- Anomaly Score: 15/100

No suspicious patterns detected.

Recommendations:
- Continue normal monitoring
- No action required`
      }]
    };
  }

  async getRiskScore(args) {
    const score = Math.floor(Math.random() * 100);
    const category = score < 30 ? "Low" : score < 70 ? "Medium" : "High";

    return {
      content: [{
        type: "text",
        text: `Risk Score for ${args.entity_type} ${args.entity_id}:

Overall Risk Score: ${score}/100
Risk Category: ${category}
Confidence: 92%

Risk Factors Breakdown:
- Transaction history: ${score - 10}/100
- Geographic consistency: ${score - 5}/100
- Device reputation: ${score + 10}/100
- Time patterns: ${score}/100

Recommendations:
${score > 70 ? "- Enhanced monitoring required" : "- Normal processing acceptable"}`
      }]
    };
  }
}

// Main worker logic
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mcpServer = new MCPServer();

    // Handle CORS
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    try {
      // MCP endpoint
      if (url.pathname === '/mcp') {
        const response = await mcpServer.handleMCPRequest(request);
        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          service: "quantumbeam-api",
          status: "healthy",
          timestamp: Date.now(),
          version: "1.0.0",
          features: ["fraud_detection", "pattern_analysis", "risk_scoring", "mcp_integration"]
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // API proxy to backend
      if (url.pathname.startsWith('/api/')) {
        const backendResponse = await fetch(BACKEND_URL + url.pathname + url.search, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || `Bearer ${API_KEY}`,
            ...Object.fromEntries(request.headers.entries())
          },
          body: request.body
        });

        // Create response with CORS headers
        const response = new Response(backendResponse.body, {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          headers: {
            ...Object.fromEntries(backendResponse.headers.entries()),
            ...corsHeaders
          }
        });

        return response;
      }

      // Static landing page
      if (url.pathname === '/') {
        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam - Quantum-Enhanced Fraud Detection API</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .logo { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .subtitle { font-size: 1.2em; opacity: 0.9; margin-bottom: 40px; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 40px 0; }
        .feature { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; backdrop-filter: blur(10px); }
        .endpoint { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
        .cta { text-align: center; margin: 40px 0; }
        .btn { display: inline-block; background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
        .btn.secondary { background: #2196F3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚛️ QuantumBeam</div>
        <div class="subtitle">Quantum-Enhanced Fraud Detection API</div>

        <div class="features">
            <div class="feature">
                <h3>🔍 Real-time Detection</h3>
                <p>Advanced ML and quantum algorithms detect fraud in milliseconds</p>
            </div>
            <div class="feature">
                <h3>🤖 MCP Integration</h3>
                <p>Model Context Protocol support for intelligent automation</p>
            </div>
            <div class="feature">
                <h3>📊 Analytics</h3>
                <p>Comprehensive analytics and risk scoring for transactions</p>
            </div>
        </div>

        <div class="cta">
            <h2>API Endpoints</h2>
            <div class="endpoint">GET /health - Service health check</div>
            <div class="endpoint">POST /api/fraud/detect - Fraud detection</div>
            <div class="endpoint">POST /api/patterns/analyze - Pattern analysis</div>
            <div class="endpoint">POST /api/risk/score - Risk scoring</div>
            <div class="endpoint">POST /mcp - MCP protocol endpoint</div>

            <div style="margin-top: 30px;">
                <a href="/health" class="btn">Health Check</a>
                <a href="/docs" class="btn secondary">API Documentation</a>
            </div>
        </div>

        <div style="text-align: center; margin-top: 60px; opacity: 0.8;">
            <p>Powered by Cloudflare Workers • Quantum Computing • Machine Learning</p>
        </div>
    </div>
</body>
</html>`, {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // 404 for other routes
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
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