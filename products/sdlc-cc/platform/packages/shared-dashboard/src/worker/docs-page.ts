/**
 * API Documentation Page HTML
 * Generates interactive API docs page with environment-aware base URL
 */

interface DocsPageOptions {
  baseUrl: string;
  apiVersion: string;
  environment: string;
  rateLimitPerMinute: string;
}

export function generateDocsPageHTML(options: DocsPageOptions): string {
  const { baseUrl, apiVersion, environment, rateLimitPerMinute } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoBoot Framework API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            background: #0a0a0a;
            color: #ffffff;
            padding: 40px 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #667eea; }
        h2 { font-size: 1.8rem; margin: 2rem 0 1rem; color: #a0a0ff; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; }
        h3 { font-size: 1.3rem; margin: 1.5rem 0 0.5rem; color: #c0c0ff; }
        p { margin-bottom: 1rem; color: rgba(255, 255, 255, 0.8); }
        .endpoint { background: rgba(255, 255, 255, 0.05); border-left: 4px solid #667eea; padding: 20px; margin: 1rem 0; border-radius: 8px; }
        .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 0.9rem; margin-right: 12px; }
        .get { background: #4ade80; color: #0a0a0a; }
        .post { background: #667eea; color: #ffffff; }
        .put { background: #f59e0b; color: #0a0a0a; }
        .delete { background: #ef4444; color: #ffffff; }
        .path { font-family: 'Monaco', monospace; color: #a0a0ff; font-size: 1.1rem; }
        .description { margin: 12px 0; color: rgba(255, 255, 255, 0.7); }
        .code-block { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; border: 1px solid rgba(255, 255, 255, 0.1); }
        pre { margin: 0; color: #4ade80; }
        .param { margin: 8px 0; }
        .param-name { font-family: 'Monaco', monospace; color: #667eea; }
        .param-type { color: #f59e0b; font-size: 0.9rem; }
        .badge { background: rgba(102, 126, 234, 0.2); color: #667eea; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AutoBoot Framework API</h1>
        <p>Welcome to the AutoBoot Framework API documentation. This API provides shared infrastructure services for authentication, billing, customer management, and more.</p>

        <p><strong>Base URL:</strong> <code>${baseUrl}</code></p>
        <p><strong>Version:</strong> ${apiVersion}</p>
        <p><strong>Environment:</strong> <span class="badge">${environment}</span></p>

        <h2>Authentication</h2>
        <p>Most endpoints require authentication via JWT token or API key.</p>

        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/api/v1/auth/login</span></h3>
            <p class="description">Authenticate user and receive JWT token</p>
            <div class="code-block"><pre>{
  "email": "user@example.com",
  "password": "your-password"
}</pre></div>
            <p><strong>Response:</strong></p>
            <div class="code-block"><pre>{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "123", "email": "user@example.com" }
}</pre></div>
        </div>

        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/api/v1/auth/register</span></h3>
            <p class="description">Create a new user account</p>
        </div>

        <h2>Product Status</h2>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/products/status</span></h3>
            <p class="description">Get real-time status of all products in your ecosystem</p>
            <p><strong>Response:</strong></p>
            <div class="code-block"><pre>{
  "products": [
    { "id": "gateway", "name": "SDLC Gateway", "status": "operational", ... },
    { "id": "rag", "name": "RAG Service", "status": "operational", ... }
  ],
  "summary": {
    "total": 8,
    "operational": 8,
    "degraded": 0,
    "down": 0
  }
}</pre></div>
        </div>

        <h2>Metrics and Analytics</h2>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/metrics/aggregate</span></h3>
            <p class="description">Get aggregated metrics across all products</p>
            <p><strong>Response:</strong></p>
            <div class="code-block"><pre>{
  "totalRequests": 1000000,
  "totalUsers": 50000,
  "totalRevenue": 125000,
  "averageResponseTime": 14,
  "overallUptime": 99.9,
  "activeProducts": 8
}</pre></div>
        </div>

        <h2>Real-Time Updates</h2>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/realtime/:productId</span></h3>
            <p class="description">Get WebSocket connection for real-time updates</p>
            <div class="param">
                <span class="param-name">:productId</span>
                <span class="param-type">(string)</span> -
                Service identifier (e.g., "gateway")
            </div>
        </div>

        <h2>Customer Management</h2>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/customers</span></h3>
            <p class="description">List all customers (requires authentication)</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/customers/:id</span></h3>
            <p class="description">Get customer details including cross-product usage</p>
        </div>

        <h2>Billing and Subscriptions</h2>

        <div class="endpoint">
            <h3><span class="method post">POST</span><span class="path">/api/v1/billing/subscribe</span></h3>
            <p class="description">Create new subscription (LemonSqueezy integration)</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/api/v1/billing/usage/:customerId</span></h3>
            <p class="description">Get usage and billing information for customer</p>
        </div>

        <h2>System Health</h2>

        <div class="endpoint">
            <h3><span class="method get">GET</span><span class="path">/health</span></h3>
            <p class="description">Health check endpoint (public, no auth required)</p>
            <p><strong>Response:</strong></p>
            <div class="code-block"><pre>{
  "status": "healthy",
  "version": "v1",
  "environment": "production",
  "timestamp": "2026-01-02T12:00:00Z"
}</pre></div>
        </div>

        <h2>Integration Examples</h2>

        <h3>JavaScript/TypeScript</h3>
        <div class="code-block"><pre>// Using fetch API
const response = await fetch('${baseUrl}/api/v1/products/status', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});
const data = await response.json();
console.log(data.summary);</pre></div>

        <h3>cURL</h3>
        <div class="code-block"><pre>curl -X GET "${baseUrl}/api/v1/products/status" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"</pre></div>

        <h2>Service Bindings</h2>
        <p>For Cloudflare Workers, you can use service bindings instead of HTTP calls:</p>
        <div class="code-block"><pre>// In your product's Worker
const auth = await env.AUTOBOOT_AUTH.fetch('/validate', {
  headers: { 'Authorization': \`Bearer \${token}\` }
});
const user = await auth.json();</pre></div>

        <h2>Rate Limiting</h2>
        <p>Current rate limits: <strong>${rateLimitPerMinute}</strong> requests per minute</p>
        <p>Exceeding rate limits will return <code>HTTP 429 Too Many Requests</code></p>

        <h2>SDKs</h2>
        <p>Official SDKs available:</p>
        <ul style="color: rgba(255, 255, 255, 0.8); margin-left: 20px;">
            <li><a href="https://github.com/autoboot/sdk-typescript">TypeScript/JavaScript SDK</a></li>
            <li><a href="https://github.com/autoboot/sdk-go">Go SDK</a></li>
            <li><a href="https://github.com/autoboot/sdk-python">Python SDK</a></li>
        </ul>

        <h2>Support</h2>
        <p>Need help? Contact us:</p>
        <ul style="color: rgba(255, 255, 255, 0.8); margin-left: 20px;">
            <li>Email: <a href="mailto:hello@sdlc.cc">hello@sdlc.cc</a></li>
            <li>Documentation: <a href="https://docs.sdlc.cc">docs.sdlc.cc</a></li>
            <li>GitHub: <a href="https://github.com/autoboot/framework">github.com/autoboot/framework</a></li>
        </ul>

        <p style="margin-top: 40px; color: rgba(255, 255, 255, 0.5); font-size: 0.9rem;">
            2026 AutoBoot Framework - <a href="/">Back to Home</a>
        </p>
    </div>
</body>
</html>`;
}
