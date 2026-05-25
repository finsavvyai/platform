export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Local cluster endpoints
    const CLUSTER_MASTER = 'http://localhost:8000';
    const AI_WORKER = 'http://localhost:8001';

    try {
      // Route requests to appropriate endpoint
      if (url.pathname === '/health' || url.pathname === '/cluster/status') {
        const response = await fetch(`${CLUSTER_MASTER}${url.pathname}`);
        return addCORSHeaders(response);
      }

      if (url.pathname === '/v1/chat/completions') {
        const response = await fetch(`${AI_WORKER}${url.pathname}`, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        return addCORSHeaders(response);
      }

      if (url.pathname === '/v1/models') {
        const response = await fetch(`${AI_WORKER}${url.pathname}`);
        return addCORSHeaders(response);
      }

      // Root endpoint with API info
      if (url.pathname === '/') {
        return new Response(getRootHTML(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      // API info endpoint
      if (url.pathname === '/info') {
        return new Response(JSON.stringify({
          service: 'FinSavvyAI Cloudflare Proxy',
          version: '1.0.0',
          status: 'online',
          endpoints: {
            'chat_completions': '/v1/chat/completions',
            'models': '/v1/models',
            'cluster_status': '/cluster/status',
            'health_check': '/health'
          },
          api_key: 'finsavvy-5d19b8e7c71d4679',
          documentation: 'https://docs.finsavvyai.com'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response('Endpoint not found', { status: 404 });

    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Local cluster is not running'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    function addCORSHeaders(response) {
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    function getRootHTML() {
      return `
<!DOCTYPE html>
<html>
<head>
    <title>FinSavvyAI - Cloudflare Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .endpoint { background: #f0f0f0; padding: 10px; margin: 5px 0; border-radius: 3px; }
        .api-key { background: #ffeaa7; padding: 10px; border-radius: 5px; font-family: monospace; }
        .warning { background: #fff3cd; padding: 10px; border-radius: 5px; border: 1px solid #ffeaa7; }
    </style>
</head>
<body>
    <h1>🤖 FinSavvyAI Cloudflare Proxy</h1>
    <div class="status">
        <h2>✅ Service Status: Online</h2>
        <p><strong>Domain:</strong> llm.finsavvyai.com</p>
        <p><strong>Backend:</strong> Local Cluster Proxy</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="warning">
        <strong>⚠️ Note:</strong> This proxy connects to your local FinSavvyAI cluster. Make sure your cluster is running on localhost:8000 and localhost:8001.
    </div>

    <h2>🔑 API Information</h2>
    <div class="api-key">
        API Key: finsavvy-5d19b8e7c71d4679
    </div>

    <h2>🔗 Endpoints</h2>
    <div class="endpoint">
        <strong>Chat Completion:</strong> POST /v1/chat/completions
    </div>
    <div class="endpoint">
        <strong>Models:</strong> GET /v1/models
    </div>
    <div class="endpoint">
        <strong>Cluster Status:</strong> GET /cluster/status
    </div>
    <div class="endpoint">
        <strong>Health Check:</strong> GET /health
    </div>

    <h2>📱 Mobile App Setup</h2>
    <p>Use these settings in any OpenAI-compatible app:</p>
    <ul>
        <li><strong>Base URL:</strong> https://llm.finsavvyai.com</li>
        <li><strong>API Key:</strong> finsavvy-5d19b8e7c71d4679</li>
        <li><strong>Models:</strong> Available from your local cluster</li>
    </ul>

    <h2>🧪 Test Examples</h2>
    <details>
        <summary>Click to see curl examples</summary>
        <pre>
# Check cluster status
curl https://llm.finsavvyai.com/cluster/status

# Send chat request
curl -X POST https://llm.finsavvyai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-3.5-turbo-sim", "messages": [{"role": "user", "content": "Hello!"}]}'

# List available models
curl https://llm.finsavvyai.com/v1/models
        </pre>
    </details>
</body>
</html>`;
    }
  }
};
