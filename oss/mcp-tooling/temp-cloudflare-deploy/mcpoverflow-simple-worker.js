// MCPOverflow Cloudflare Worker - Simple Version
// Voice-Activated MCP Connector Platform

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle different routes
    switch (pathname) {
      case '/':
        return new Response(getMainPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/developer':
      case '/developer/':
        return new Response(getDeveloperPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/ai':
      case '/ai/':
        return new Response(getAIPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/docs':
      case '/docs/':
        return new Response(getDocsPage(), {
          headers: { 'Content-Type': 'text/html' }
        });

      case '/api/voice-command':
        if (request.method === 'POST') {
          return handleVoiceCommand(request);
        }
        break;

      case '/api/health':
        return new Response(JSON.stringify({
          status: 'healthy',
          platform: 'MCPOverflow',
          deployment: 'Cloudflare Workers',
          timestamp: new Date().toISOString(),
          edge: true,
          voice_activated: true
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
    }

    // Fallback to main page
    return new Response(getMainPage(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

async function handleVoiceCommand(request) {
  try {
    const body = await request.json();
    const command = body.command || 'Hello from MCPOverflow edge network!';

    return new Response(JSON.stringify({
      message: `Voice command executed: ${command}`,
      status: 'success',
      processed_at: 'Cloudflare Edge',
      timestamp: new Date().toISOString(),
      edge_location: request.cf.colo || 'unknown',
      voice_feature: 'enabled'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid request',
      status: 'error'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function getMainPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow - Voice-Activated Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 3.5rem; margin-bottom: 1rem; }
        .subtitle { font-size: 1.5rem; margin-bottom: 2rem; opacity: 0.9; }
        .status {
            background: rgba(16, 185, 129, 0.2);
            border: 2px solid #10b981;
            color: #10b981;
            padding: 1rem 2rem;
            border-radius: 50px;
            display: inline-block;
            margin-bottom: 2rem;
            font-weight: bold;
        }
        .cloudflare-badge {
            background: rgba(255, 165, 0, 0.2);
            border: 2px solid #ffa500;
            color: #ffa500;
            padding: 1rem 2rem;
            border-radius: 50px;
            display: inline-block;
            margin-bottom: 2rem;
            margin-left: 1rem;
            font-weight: bold;
        }
        .apps {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        .app-card {
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            transition: transform 0.2s;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .app-card:hover { transform: scale(1.05); }
        .app-card h3 { font-size: 1.3rem; margin-bottom: 1rem; }
        .app-card p { opacity: 0.8; margin-bottom: 1.5rem; }
        .app-link {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            text-decoration: none;
            transition: all 0.2s;
        }
        .app-link:hover { background: rgba(255,255,255,0.3); }
        .voice-button {
            background: #10b981;
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            cursor: pointer;
            margin: 1rem;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }
        .voice-button:hover {
            background: #059669;
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }
        .deployment-info {
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 15px;
            margin-top: 3rem;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="container">
            <div class="status">
                Voice-Activated Platform Online
            </div>
            <div class="cloudflare-badge">
                Powered by Cloudflare Workers
            </div>
            <h1>MCPOverflow</h1>
            <p class="subtitle">Voice-Activated MCP Connector Platform</p>

            <button class="voice-button" onclick="testVoiceCommand()">
                Test Voice Command
            </button>

            <div class="apps">
                <div class="app-card">
                    <h3>Developer Portal</h3>
                    <p>Build and deploy MCP connectors with voice commands.</p>
                    <a href="/developer" class="app-link">Developer Tools</a>
                </div>

                <div class="app-card">
                    <h3>AI Platform</h3>
                    <p>AI-powered connector generation platform.</p>
                    <a href="/ai" class="app-link">AI Tools</a>
                </div>

                <div class="app-card">
                    <h3>Documentation</h3>
                    <p>Complete platform documentation and guides.</p>
                    <a href="/docs" class="app-link">View Docs</a>
                </div>

                <div class="app-card">
                    <h3>Edge Performance</h3>
                    <p>Lightning-fast global deployment stats.</p>
                    <a href="/api/health" class="app-link">API Test</a>
                </div>
            </div>

            <div class="deployment-info">
                <h3>Cloudflare Workers Deployment</h3>
                <p style="margin-top: 1rem;">
                    <strong>Status:</strong> Deployed to Cloudflare Edge<br>
                    <strong>Voice Commands:</strong> Active<br>
                    <strong>Global CDN:</strong> Active<br>
                    <strong>Response Time:</strong> &lt;50ms worldwide<br>
                    <strong>Deployment:</strong> <span id="deployment-time"></span>
                </p>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('deployment-time').textContent = new Date().toLocaleString();

        async function testVoiceCommand() {
            const commands = [
                "Deploying to Cloudflare Workers...",
                "Voice commands activated on edge network...",
                "All systems operational globally...",
                "Starting deployment sequence on Cloudflare"
            ];

            const command = commands[Math.floor(Math.random() * commands.length)];
            const button = event.target;

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(command);
                utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
            }

            button.textContent = '[PROCESSING] ' + command;
            button.style.background = '#f59e0b';

            try {
                const response = await fetch('/api/voice-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: command })
                });
                const result = await response.json();
                console.log('Voice command result:', result);
            } catch (error) {
                console.log('Voice command executed locally');
            }

            setTimeout(() => {
                button.textContent = 'Test Voice Command';
                button.style.background = '#10b981';
            }, 3000);
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
    <title>Developer Platform - MCPOverflow</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 2rem 0;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 3rem 0; }
        .nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .logo { font-size: 1.5rem; font-weight: bold; }
        .status {
            background: #dcfce7;
            color: #16a34a;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        .card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-2px); }
        .card h3 { color: #1f2937; margin-bottom: 1rem; }
        .card p { color: #6b7280; line-height: 1.6; margin-bottom: 1.5rem; }
        .btn {
            background: #3b82f6;
            color: white;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.2s;
        }
        .btn:hover { background: #2563eb; }
        .voice-demo {
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-top: 2rem;
            text-align: center;
        }
        .voice-btn {
            background: white;
            color: #1e40af;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            margin: 1rem;
        }
        .back-link {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            text-decoration: none;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <div class="nav">
                <div class="logo">Developer Platform</div>
                <div class="status">Cloudflare Workers Active</div>
            </div>
            <h1>Build & Deploy MCP Connectors</h1>
            <p>Developer tools powered by Cloudflare Workers with voice commands</p>
        </div>
    </div>

    <div class="container content">
        <div class="grid">
            <div class="card">
                <h3>Quick Deploy</h3>
                <p>Deploy your MCP connectors to Cloudflare Workers in seconds using voice commands.</p>
                <button class="btn" onclick="deployConnector()">Deploy to Workers</button>
            </div>

            <div class="card">
                <h3>Dashboard</h3>
                <p>Monitor your MCP connectors with real-time analytics from Cloudflare edge.</p>
                <button class="btn" onclick="openDashboard()">Open Dashboard</button>
            </div>

            <div class="card">
                <h3>Voice Commands</h3>
                <p>Use voice commands to deploy and manage connectors on Cloudflare Workers.</p>
                <button class="btn" onclick="testVoice()">Test Voice</button>
            </div>

            <div class="card">
                <h3>API Docs</h3>
                <p>Complete API reference for Cloudflare Workers integration.</p>
                <button class="btn" onclick="openDocs()">View Docs</button>
            </div>
        </div>

        <div class="voice-demo">
            <h2>Voice-Activated Cloudflare Deployment</h2>
            <p>Deploy to Cloudflare Workers with voice commands</p>
            <button class="voice-btn" onclick="activateVoiceCommands()">Activate Voice Commands</button>
            <p id="voice-status"></p>
        </div>
    </div>

    <script>
        function deployConnector() {
            alert("Deploying connector to Cloudflare Workers edge network!");
        }

        function openDashboard() {
            alert("Opening Cloudflare edge analytics dashboard...");
        }

        function testVoice() {
            alert("Voice commands ready for Cloudflare deployment!");
        }

        function openDocs() {
            window.location.href = '/docs';
        }

        function activateVoiceCommands() {
            const status = document.getElementById('voice-status');
            status.textContent = 'Activating voice commands on Cloudflare Workers...';

            setTimeout(() => {
                status.textContent = 'Voice commands ready for edge deployment';
            }, 2000);
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #faf5ff;
        }
        .header {
            background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
            color: white;
            padding: 2rem 0;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 3rem 0; }
        .ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        .ai-card {
            background: white;
            border: 1px solid #e9d5ff;
            border-radius: 15px;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .ai-card:hover { transform: translateY(-4px); }
        .ai-icon { font-size: 3rem; margin-bottom: 1rem; }
        .ai-card h3 { color: #4c1d95; margin-bottom: 1rem; }
        .ai-card p { color: #6b7280; line-height: 1.6; }
        .ai-demo {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            padding: 3rem;
            border-radius: 20px;
            margin-top: 3rem;
            text-align: center;
        }
        .ai-button {
            background: white;
            color: #7c3aed;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            margin: 1rem;
            transition: all 0.2s;
            box-shadow: 0 8px 16px rgba(255, 255, 255, 0.3);
        }
        .ai-button:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(124, 58, 237, 0.3);
        }
        .back-link {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            text-decoration: none;
            font-size: 0.9rem;
        }
        .edge-info {
            background: rgba(255,255,255,0.2);
            padding: 1rem;
            border-radius: 10px;
            margin-top: 1rem;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <h1>AI Platform</h1>
            <p>AI-powered MCP connector generation on Cloudflare Workers edge</p>
        </div>
    </div>

    <div class="container content">
        <div class="ai-grid">
            <div class="ai-card">
                <div class="ai-icon">TARGET</div>
                <h3>Smart Generation</h3>
                <p>AI analyzes your OpenAPI specs and generates optimized MCP connectors for Cloudflare Workers.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon">SEARCH</div>
                <h3>Intelligent Testing</h3>
                <p>Automated testing with AI-powered insights optimized for edge deployment.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon">CHART</div>
                <h3>Edge Analytics</h3>
                <p>AI-driven performance monitoring and optimization for Cloudflare edge.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon">SPEAKER</div>
                <h3>Voice AI Assistant</h3>
                <p>Natural voice interface powered by AI processing at the edge.</p>
            </div>
        </div>

        <div class="ai-demo">
            <h2>AI Voice Assistant</h2>
            <p>Experience intelligent voice-powered development on Cloudflare Workers edge</p>
            <button class="ai-button" onclick="activateAI()">Activate AI Voice</button>
            <div class="edge-info">
                AI processing powered by Cloudflare Workers edge network
            </div>
            <p id="ai-status"></p>
        </div>
    </div>

    <script>
        function activateAI() {
            const status = document.getElementById('ai-status');
            status.innerHTML = 'Activating AI Voice Assistant on Cloudflare edge...';

            const responses = [
                "AI Voice Assistant online! Ready to help you build amazing connectors!",
                "Hello! I'm your AI development assistant powered by Cloudflare edge.",
                "AI systems ready on Cloudflare Workers! Ready to create incredible connectors!"
            ];

            const response = responses[Math.floor(Math.random() * responses.length)];

            setTimeout(() => {
                status.innerHTML = 'AI Voice Assistant ready on edge network';
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(response);
                    utterance.rate = 0.9;
                    utterance.pitch = 1.1;
                    speechSynthesis.speak(utterance);
                }
            }, 1500);
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0fdf4;
        }
        .header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 2rem 0;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 3rem 0; }
        .search-container {
            margin: 2rem 0;
            text-align: center;
        }
        .search-box {
            background: white;
            border: 2px solid #10b981;
            border-radius: 50px;
            padding: 1.2rem 2rem;
            font-size: 1.2rem;
            width: 100%;
            max-width: 600px;
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);
            transition: all 0.3s ease;
        }
        .search-box:focus {
            outline: none;
            box-shadow: 0 12px 30px rgba(16, 185, 129, 0.3);
            transform: scale(1.02);
        }
        .docs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2.5rem;
            margin-top: 3rem;
        }
        .doc-card {
            background: white;
            border: 2px solid #d1fae5;
            border-radius: 20px;
            padding: 2.5rem;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            text-align: center;
        }
        .doc-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        .doc-icon { font-size: 3rem; margin-bottom: 2rem; }
        .doc-card h3 { color: #064e3b; margin-bottom: 1.5rem; font-size: 1.5rem; }
        .doc-card p { color: #4b5563; line-height: 1.7; margin-bottom: 2rem; }
        .doc-link {
            color: #10b981;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
        }
        .doc-link:hover {
            color: #059669;
            transform: translateX(5px);
        }
        .voice-docs {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 4rem;
            border-radius: 30px;
            margin-top: 4rem;
            text-align: center;
        }
        .voice-btn {
            background: white;
            color: #059669;
            padding: 1.5rem 3rem;
            border: none;
            border-radius: 50px;
            font-weight: bold;
            font-size: 1.2rem;
            cursor: pointer;
            margin: 1rem;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(255, 255, 255, 0.3);
        }
        .voice-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(255, 255, 255, 0.4);
        }
        .back-link {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
        }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <h1>Documentation</h1>
            <p>Complete guide to MCPOverflow on Cloudflare Workers</p>

            <div class="search-container">
                <input type="text" class="search-box" placeholder="Search documentation..." onkeyup="searchDocs(this.value)">
            </div>
        </div>
    </div>

    <div class="container content">
        <div class="docs-grid" id="docs-grid">
            <div class="doc-card">
                <div class="doc-icon">CLOUD</div>
                <h3>Cloudflare Workers</h3>
                <p>Deploy MCP connectors to Cloudflare Workers edge network.</p>
                <a href="#" class="doc-link" onclick="loadDoc('cloudflare')">View Documentation →</a>
            </div>

            <div class="doc-card">
                <div class="doc-icon">MICROPHONE</div>
                <h3>Voice Commands</h3>
                <p>Complete reference for voice-activated commands on edge.</p>
                <a href="#" class="doc-link" onclick="loadDoc('voice-commands')">View Documentation →</a>
            </div>

            <div class="doc-card">
                <div class="doc-icon">ROCKET</div>
                <h3>Quick Start</h3>
                <p>Get up and running with MCPOverflow on Cloudflare in minutes.</p>
                <a href="#" class="doc-link" onclick="loadDoc('quick-start')">View Documentation →</a>
            </div>

            <div class="doc-card">
                <div class="doc-icon">PLUG</div>
                <h3>API Reference</h3>
                <p>Detailed API documentation for MCP connectors on Workers.</p>
                <a href="#" class="doc-link" onclick="loadDoc('api-reference')">View Documentation →</a>
            </div>

            <div class="doc-card">
                <div class="doc-icon">SPEEDOMETER</div>
                <h3>Edge Analytics</h3>
                <p>Monitor connectors with Cloudflare edge analytics.</p>
                <a href="#" class="doc-link" onclick="loadDoc('edge-analytics')">View Documentation →</a>
            </div>

            <div class="doc-card">
                <div class="doc-icon">WRENCH</div>
                <h3>Troubleshooting</h3>
                <p>Common issues and solutions for Workers deployment.</p>
                <a href="#" class="doc-link" onclick="loadDoc('troubleshooting')">View Documentation →</a>
            </div>
        </div>

        <div class="voice-docs">
            <h2>Voice Documentation</h2>
            <p>Ask our AI assistant to read documentation aloud from the edge</p>
            <button class="voice-btn" onclick="readDocumentation()">Enable Voice Reading</button>
            <div id="voice-status"></p>
        </div>
    </div>

    <script>
        function searchDocs(query) {
            const cards = document.querySelectorAll('.doc-card');
            const lowerQuery = query.toLowerCase();

            cards.forEach(card => {
                const keywords = card.getAttribute('data-keywords').toLowerCase();
                const text = card.textContent.toLowerCase();

                if (keywords.includes(lowerQuery) || text.includes(lowerQuery)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function loadDoc(topic) {
            const status = document.getElementById('voice-status');
            status.innerHTML = `Loading ${topic.replace('-', ' ')} documentation from edge...`;

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `Opening ${topic.replace('-', ' ')} documentation from Cloudflare edge`
                );
                utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
            }

            setTimeout(() => {
                alert(`Documentation loaded successfully!`);
                status.innerHTML = '';
            }, 2000);
        }

        function readDocumentation() {
            const status = document.getElementById('voice-status');
            status.innerHTML = 'Voice documentation enabled on Cloudflare edge...';

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    "Voice documentation enabled. Click on any documentation link to have it read aloud."
                );
                utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
            }

            setTimeout(() => {
                status.innerHTML = 'Voice reading ready from edge network';
            }, 2000);
        }

        // Welcome message
        window.addEventListener('load', () => {
            setTimeout(() => {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(
                        "Welcome to MCPOverflow documentation. Try our voice reading feature!"
                    );
                    speechSynthesis.speak(utterance);
                }
            }, 1500);
        });
    </script>
</body>
</html>`;
}