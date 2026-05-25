// MCPOverflow Cloudflare Worker - Minimal Version
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle different routes
    switch (url.pathname) {
      case '/':
        return new Response(getMainPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/developer/':
        return new Response(getDeveloperPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/ai/':
        return new Response(getAIPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/docs/':
        return new Response(getDocsPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/api/voice-command':
        return handleVoiceCommand(request);

      case '/api/health':
        return new Response(JSON.stringify({
          status: 'healthy',
          voice_processing: 'active',
          edge_locations: 'global',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response('Not found', { status: 404 });
    }
  }
};

function handleVoiceCommand(request) {
  return new Response(JSON.stringify({
    message: 'Voice command processed at edge',
    status: 'success',
    processing_location: 'edge',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function getMainPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCPOverflow - Voice-Activated MCP Platform</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
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
      padding: 4rem 0;
    }
    .header h1 {
      font-size: 4rem;
      margin: 0;
      font-weight: 800;
      background: linear-gradient(45deg, #fff, #e0e7ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header p {
      font-size: 1.5rem;
      margin: 1rem 0;
      opacity: 0.9;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 4rem 0;
    }
    .feature {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 15px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: transform 0.2s;
    }
    .feature:hover {
      transform: translateY(-5px);
    }
    .feature h3 {
      font-size: 1.5rem;
      margin: 0 0 1rem 0;
    }
    .feature p {
      opacity: 0.8;
      line-height: 1.6;
    }
    .cta {
      text-align: center;
      padding: 3rem 0;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 1rem 2rem;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 0.5rem;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #2563eb;
    }
    .voice-demo {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 15px;
      margin: 2rem 0;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .voice-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 1rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      margin: 1rem;
      transition: background 0.2s;
    }
    .voice-btn:hover {
      background: #059669;
    }
    .nav {
      display: flex;
      justify-content: center;
      gap: 2rem;
      padding: 2rem 0;
      flex-wrap: wrap;
    }
    .nav a {
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 5px;
      transition: background 0.2s;
    }
    .nav a:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/developer/">Developer</a>
      <a href="/ai/">AI Platform</a>
      <a href="/docs/">Documentation</a>
    </nav>

    <div class="header">
      <h1>MCPOverflow</h1>
      <p>Voice-Activated MCP Connector Platform on Cloudflare Edge</p>
    </div>

    <div class="voice-demo">
      <h3>Test Voice Command</h3>
      <button class="voice-btn" onclick="testVoiceCommand()">
        Test Voice Deployment
      </button>
      <div id="voice-status"></div>
    </div>

    <div class="features">
      <div class="feature">
        <h3>Lightning Fast</h3>
        <p>Deployed on Cloudflare's edge network with sub-second response times across 200+ global locations.</p>
      </div>
      <div class="feature">
        <h3>Voice Commands</h3>
        <p>Natural language voice interface for deploying and managing MCP connectors with real-time feedback.</p>
      </div>
      <div class="feature">
        <h3>AI-Powered</h3>
        <p>Intelligent AI assistants help you generate, optimize, and deploy MCP connectors automatically.</p>
      </div>
      <div class="feature">
        <h3>Developer Tools</h3>
        <p>Complete development environment with testing, monitoring, and deployment capabilities.</p>
      </div>
    </div>

    <div class="cta">
      <h2>Start Building MCP Connectors</h2>
      <p>Deploy your first MCP connector in seconds with voice commands</p>
      <a href="/developer/" class="btn">Developer Portal</a>
      <a href="/ai/" class="btn">AI Platform</a>
      <a href="/docs/" class="btn">Documentation</a>
    </div>
  </div>

  <script>
    function testVoiceCommand() {
      const status = document.getElementById('voice-status');
      status.innerHTML = 'Processing voice command...';

      // Simulate voice command processing
      fetch('/api/voice-command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command: 'deploy mcp connector'})
      })
      .then(response => response.json())
      .then(data => {
        status.innerHTML = 'Voice command processed successfully!';
        setTimeout(() => { status.innerHTML = ''; }, 3000);
      })
      .catch(error => {
        status.innerHTML = 'Voice command failed. Please try again.';
      });
    }
  </script>
</body>
</html>`;
}

function getDeveloperPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Developer Portal - MCPOverflow</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
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
      padding: 2rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
    }
    .tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }
    .tool {
      background: rgba(255, 255, 255, 0.1);
      padding: 2rem;
      border-radius: 10px;
      text-align: center;
    }
    .btn {
      background: #3b82f6;
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 0.5rem;
    }
    .btn:hover {
      background: #2563eb;
    }
    .nav {
      text-align: center;
      padding: 1rem 0;
    }
    .nav a {
      color: white;
      text-decoration: none;
      margin: 0 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">← Back to Home</a>
    </div>

    <div class="header">
      <h1>Developer Portal</h1>
      <p>Build and deploy MCP connectors with voice commands</p>
    </div>

    <div class="tools">
      <div class="tool">
        <h3>Connector Builder</h3>
        <p>Create MCP connectors from OpenAPI specs</p>
        <button class="btn">Start Building</button>
      </div>
      <div class="tool">
        <h3>Voice Deploy</h3>
        <p>Deploy with voice commands</p>
        <button class="btn" onclick="voiceDeploy()">Voice Deploy</button>
      </div>
      <div class="tool">
        <h3>Testing Tools</h3>
        <p>Test your connectors</p>
        <button class="btn">Run Tests</button>
      </div>
      <div class="tool">
        <h3>Analytics</h3>
        <p>Monitor performance</p>
        <button class="btn">View Analytics</button>
      </div>
    </div>
  </div>

  <script>
    function voiceDeploy() {
      alert('Voice deployment: "Deploying MCP connector to Cloudflare Workers..."');
    }
  </script>
</body>
</html>`;
}

function getAIPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Platform - MCPOverflow</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
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
      padding: 2rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
    }
    .ai-tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }
    .ai-tool {
      background: rgba(255, 255, 255, 0.1);
      padding: 2rem;
      border-radius: 15px;
      text-align: center;
    }
    .btn {
      background: #10b981;
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 0.5rem;
    }
    .btn:hover {
      background: #059669;
    }
    .nav {
      text-align: center;
      padding: 1rem 0;
    }
    .nav a {
      color: white;
      text-decoration: none;
      margin: 0 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">← Back to Home</a>
    </div>

    <div class="header">
      <h1>AI Platform</h1>
      <p>AI-powered MCP connector generation and optimization</p>
    </div>

    <div class="ai-tools">
      <div class="ai-tool">
        <h3>Smart Generation</h3>
        <p>AI generates MCP connectors from descriptions</p>
        <button class="btn" onclick="generateConnector()">Generate</button>
      </div>
      <div class="ai-tool">
        <h3>Code Optimization</h3>
        <p>AI optimizes your connector performance</p>
        <button class="btn">Optimize</button>
      </div>
      <div class="ai-tool">
        <h3>Voice AI Assistant</h3>
        <p>AI helper for development</p>
        <button class="btn" onclick="startAIAssistant()">Start AI</button>
      </div>
      <div class="ai-tool">
        <h3>Smart Testing</h3>
        <p>AI creates comprehensive tests</p>
        <button class="btn">Test with AI</button>
      </div>
    </div>
  </div>

  <script>
    function generateConnector() {
      alert('AI is generating your MCP connector...');
    }

    function startAIAssistant() {
      alert('AI Assistant: "Hello! I can help you build MCP connectors. What would you like to create?"');
    }
  </script>
</body>
</html>`;
}

function getDocsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation - MCPOverflow</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
      min-height: 100vh;
      color: white;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem;
    }
    .header {
      text-align: center;
      padding: 2rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
    }
    .docs-nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .doc-section {
      background: rgba(255, 255, 255, 0.1);
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1rem 0;
    }
    .doc-section h3 {
      margin: 0 0 1rem 0;
    }
    .doc-section ul {
      list-style: none;
      padding: 0;
    }
    .doc-section a {
      color: #60a5fa;
      text-decoration: none;
      display: block;
      padding: 0.5rem 0;
    }
    .doc-section a:hover {
      text-decoration: underline;
    }
    .btn {
      background: #ef4444;
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin: 1rem;
    }
    .btn:hover {
      background: #dc2626;
    }
    .nav {
      text-align: center;
      padding: 1rem 0;
    }
    .nav a {
      color: white;
      text-decoration: none;
      margin: 0 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav">
      <a href="/">← Back to Home</a>
    </div>

    <div class="header">
      <h1>Documentation</h1>
      <p>Complete guide to MCP Overflow platform</p>
      <button class="btn" onclick="readDocs()">Read Documentation Aloud</button>
    </div>

    <div class="docs-nav">
      <div class="doc-section">
        <h3>Getting Started</h3>
        <ul>
          <li><a href="#quickstart">Quick Start</a></li>
          <li><a href="#installation">Installation</a></li>
          <li><a href="#first-connector">First Connector</a></li>
        </ul>
      </div>
      <div class="doc-section">
        <h3>API Reference</h3>
        <ul>
          <li><a href="#rest-api">REST API</a></li>
          <li><a href="#mcp-protocol">MCP Protocol</a></li>
          <li><a href="#examples">Examples</a></li>
        </ul>
      </div>
      <div class="doc-section">
        <h3>Deployment</h3>
        <ul>
          <li><a href="#cloudflare">Cloudflare Workers</a></li>
          <li><a href="#monitoring">Monitoring</a></li>
          <li><a href="#scaling">Scaling</a></li>
        </ul>
      </div>
      <div class="doc-section">
        <h3>Voice Commands</h3>
        <ul>
          <li><a href="#voice-basics">Voice Basics</a></li>
          <li><a href="#advanced-voice">Advanced Voice</a></li>
          <li><a href="#custom-commands">Custom Commands</a></li>
        </ul>
      </div>
    </div>
  </div>

  <script>
    function readDocs() {
      alert('Reading documentation: "Welcome to MCP Overflow docs. This platform helps you build and deploy MCP connectors..."');
    }
  </script>
</body>
</html>`;
}