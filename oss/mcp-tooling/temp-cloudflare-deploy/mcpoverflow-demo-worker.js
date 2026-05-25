// MCPOverflow Demo Cloudflare Worker
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
          edge: true
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
    const command = body.command || 'Hello from MCPOverflow edge!';

    return new Response(JSON.stringify({
      message: `Voice command executed: ${command}`,
      status: 'success',
      processed_at: 'Cloudflare Edge',
      timestamp: new Date().toISOString(),
      edge_location: request.cf.colo || 'unknown'
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
        h1 { font-size: 3.5rem; margin-bottom: 1rem; animation: fadeIn 1s ease-in; }
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
            animation: pulse 2s infinite;
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
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        .app-card {
            background: rgba(255,255,255,0.1);
            padding: 2rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.2);
        }
        .app-card:hover {
            transform: translateY(-10px) scale(1.02);
            background: rgba(255,255,255,0.15);
        }
        .app-card h3 { font-size: 1.5rem; margin-bottom: 1rem; }
        .app-card p { opacity: 0.9; margin-bottom: 1.5rem; line-height: 1.6; }
        .app-link {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            text-decoration: none;
            transition: all 0.3s ease;
            font-weight: 600;
        }
        .app-link:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        .voice-button {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 1.5rem 3rem;
            border: none;
            border-radius: 50px;
            font-size: 1.2rem;
            cursor: pointer;
            margin: 2rem 1rem;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
            position: relative;
            overflow: hidden;
        }
        .voice-button:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(16, 185, 129, 0.5);
        }
        .voice-button:active {
            transform: scale(0.98);
        }
        .voice-button::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255,255,255,0.3);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }
        .voice-button:active::before {
            width: 300px;
            height: 300px;
        }
        .deployment-info {
            background: rgba(255,255,255,0.1);
            padding: 2.5rem;
            border-radius: 20px;
            margin-top: 3rem;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.2);
        }
        .edge-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }
        .stat {
            background: rgba(255,255,255,0.1);
            padding: 1rem;
            border-radius: 15px;
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #10b981;
        }
        .footer {
            margin-top: 3rem;
            opacity: 0.8;
            font-size: 0.9rem;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="container">
            <div class="status">
                🎤 Voice-Activated Platform LIVE
            </div>
            <div class="cloudflare-badge">
                ☁️ Powered by Cloudflare Edge Network
            </div>

            <h1>🚀 MCPOverflow</h1>
            <p class="subtitle">Voice-Activated MCP Connector Platform on Global Edge</p>

            <div style="margin: 2rem 0;">
                <button class="voice-button" onclick="testVoiceCommand()">
                    🎤 Test Voice Command
                </button>
                <button class="voice-button" onclick="testHealthCheck()">
                    🔍 Test Edge Health
                </button>
            </div>

            <div class="apps">
                <div class="app-card">
                    <h3>🔧 Developer Portal</h3>
                    <p>Build and deploy MCP connectors with voice commands on Cloudflare Workers edge network.</p>
                    <a href="/developer" class="app-link">Developer Tools →</a>
                </div>

                <div class="app-card">
                    <h3>🤖 AI Platform</h3>
                    <p>AI-powered connector generation with edge-optimized performance and voice assistance.</p>
                    <a href="/ai" class="app-link">AI Tools →</a>
                </div>

                <div class="app-card">
                    <h3>📚 Documentation</h3>
                    <p>Complete platform documentation with voice reading capabilities and edge optimization.</p>
                    <a href="/docs" class="app-link">View Docs →</a>
                </div>

                <div class="app-card">
                    <h3>⚡ Edge Performance</h3>
                    <p>Real-time monitoring and analytics from Cloudflare's global edge network.</p>
                    <a href="#" onclick="showEdgeStats()" class="app-link">Edge Stats →</a>
                </div>
            </div>

            <div class="deployment-info">
                <h3>🌐 Global Edge Deployment</h3>
                <div class="edge-stats">
                    <div class="stat">
                        <div class="stat-value">200+</div>
                        <div>Edge Locations</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">&lt;50ms</div>
                        <div>Global Latency</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">99.9%</div>
                        <div>Uptime SLA</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="deployment-time">Now</div>
                        <div>Deployed</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>🌍 Deployed to Cloudflare Edge Network | 🚀 Serverless & Voice-Activated | 🎤 AI-Powered Development</p>
                <p>
                    <a href="/api/health" style="color: #10b981; text-decoration: none;">Health API</a> |
                    <a href="/api/voice-command" style="color: #10b981; text-decoration: none;">Voice API</a>
                </p>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('deployment-time').textContent = new Date().toLocaleTimeString();

        async function testVoiceCommand() {
            const commands = [
                "Deploying MCP connectors to Cloudflare edge network...",
                "Voice commands activated on global edge infrastructure...",
                "All systems operational across 200+ edge locations...",
                "Starting edge deployment sequence with voice activation..."
            ];

            const command = commands[Math.floor(Math.random() * commands.length)];
            const button = event.target;

            // Visual feedback
            button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            button.innerHTML = `[SPEAKING] ${command}`;

            // Voice synthesis
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(command);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                speechSynthesis.speak(utterance);
            }

            // Send voice command to API
            try {
                const response = await fetch('/api/voice-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: command })
                });
                const result = await response.json();
                console.log('✅ Voice command processed:', result);
            } catch (error) {
                console.log('🎤 Voice command executed locally');
            }

            // Reset button
            setTimeout(() => {
                button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                button.innerHTML = '🎤 Test Voice Command';
            }, 3000);
        }

        async function testHealthCheck() {
            const button = event.target;
            button.style.background = 'linear-gradient(135deg, #3b82f6, #1e40af)';
            button.innerHTML = '🔍 Checking Edge Health...';

            try {
                const response = await fetch('/api/health');
                const health = await response.json();

                button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                button.innerHTML = '✅ Edge Healthy';

                alert(`🌍 Edge Health Status:
✅ Status: ${health.status}
🌐 Platform: ${health.platform}
☁️ Deployment: ${health.deployment}
📍 Edge: ${health.edge}
⏰ Time: ${health.timestamp}`);
            } catch (error) {
                button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                button.innerHTML = '❌ Health Check Failed';
                console.error('Health check error:', error);
            }

            setTimeout(() => {
                button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                button.innerHTML = '🔍 Test Edge Health';
            }, 3000);
        }

        function showEdgeStats() {
            alert(`📊 Cloudflare Edge Statistics:
🌍 200+ Global Edge Locations
⚡ Sub-50ms Response Times Worldwide
🔥 Millions of Requests per Second
🛡️ DDoS Protection Included
🔒 Automatic SSL Certificates
📱 Mobile-First Optimization
🎤 Voice Processing at Edge
🤖 AI Assistants Available`);
        }

        // Welcome message on load
        window.addEventListener('load', () => {
            setTimeout(() => {
                if ('speechSynthesis' in window) {
                    const welcome = new SpeechSynthesisUtterance(
                        "Welcome to MCP Overflow! Your voice-activated platform is now live on Cloudflare's global edge network."
                    );
                    welcome.rate = 0.9;
                    speechSynthesis.speak(welcome);
                }
            }, 2000);
        });
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
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 3rem 0;
            position: relative;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 4rem 0; }
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
        .back-link:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .subtitle { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
        .status {
            background: rgba(16, 185, 129, 0.2);
            border: 2px solid #10b981;
            color: #10b981;
            padding: 1rem 2rem;
            border-radius: 50px;
            display: inline-block;
            font-weight: bold;
            margin-bottom: 2rem;
        }
        .dev-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2.5rem;
            margin-top: 3rem;
        }
        .dev-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 2.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            text-align: center;
        }
        .dev-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        .dev-icon { font-size: 3rem; margin-bottom: 1.5rem; }
        .dev-card h3 { color: #1f2937; margin-bottom: 1.5rem; font-size: 1.5rem; }
        .dev-card p { color: #6b7280; line-height: 1.7; margin-bottom: 2rem; }
        .dev-btn {
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-size: 1.1rem;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
        }
        .dev-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
        }
        .voice-section {
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            padding: 4rem;
            border-radius: 30px;
            margin-top: 4rem;
            text-align: center;
        }
        .voice-btn {
            background: white;
            color: #1e40af;
            padding: 1.5rem 3rem;
            border: none;
            border-radius: 50px;
            font-size: 1.3rem;
            font-weight: bold;
            cursor: pointer;
            margin: 2rem 1rem;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(255, 255, 255, 0.3);
        }
        .voice-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(255, 255, 255, 0.4);
        }
        .edge-info {
            background: rgba(255,255,255,0.2);
            padding: 2rem;
            border-radius: 20px;
            margin-top: 2rem;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
        .floating { animation: float 3s ease-in-out infinite; }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <div class="status floating">☁️ Cloudflare Workers Active</div>
            <h1>🔧 Developer Platform</h1>
            <p class="subtitle">Build & Deploy MCP Connectors with Voice Commands on Cloudflare Edge Network</p>
        </div>
    </div>

    <div class="container content">
        <div class="dev-grid">
            <div class="dev-card">
                <div class="dev-icon">🚀</div>
                <h3>Quick Deploy</h3>
                <p>Deploy your MCP connectors to Cloudflare Workers edge network in seconds using voice commands. Get global distribution instantly.</p>
                <button class="dev-btn" onclick="deployConnector()">Deploy to Workers</button>
                <div class="edge-info">☁️ 200+ edge locations globally</div>
            </div>

            <div class="dev-card">
                <div class="dev-icon">📊</div>
                <h3>Edge Analytics</h3>
                <p>Monitor your MCP connectors with real-time analytics from Cloudflare's global edge network. Performance metrics from every corner of the world.</p>
                <button class="dev-btn" onclick="openDashboard()">Open Dashboard</button>
                <div class="edge-info">☁️ Real-time edge analytics</div>
            </div>

            <div class="dev-card">
                <div class="dev-icon">🎤</div>
                <h3>Voice Commands</h3>
                <p>Use natural voice commands to deploy and manage connectors on Cloudflare Workers. AI understands your development needs.</p>
                <button class="dev-btn" onclick="testVoice()">Test Voice</button>
                <div class="edge-info">☁️ AI processing at edge</div>
            </div>

            <div class="dev-card">
                <div class="dev-icon">🔌</div>
                <h3>API Development</h3>
                <p>Complete API reference and development tools optimized for Cloudflare Workers edge deployment with voice assistance.</p>
                <button class="dev-btn" onclick="openDocs()">View API Docs</button>
                <div class="edge-info">☁️ Edge-first API design</div>
            </div>
        </div>

        <div class="voice-section">
            <h2>🎤 Voice-Activated Development</h2>
            <p style="font-size: 1.2rem; margin-bottom: 2rem;">
                Deploy to Cloudflare Workers using natural voice commands powered by edge AI
            </p>

            <button class="voice-btn" onclick="activateVoiceCommands()">
                Activate Voice Commands
            </button>

            <div class="edge-info">
                <h3>☁️ Cloudflare Edge Features</h3>
                <p>• Global deployment with 200+ edge locations<br>
                • Sub-second response times worldwide<br>
                • Automatic SSL and DDoS protection<br>
                • Serverless scalability and reliability</p>
            </div>

            <div id="voice-status" style="margin-top: 2rem; font-size: 1.1rem;"></div>
        </div>
    </div>

    <script>
        function deployConnector() {
            speak("Deploying connector to Cloudflare Workers edge network...");
            updateStatus("🚀 Initiating deployment to 200+ edge locations...");

            setTimeout(() => {
                alert("🌍 Connector deploying to Cloudflare global edge network!\n\nFeatures enabled:\n✅ Global CDN distribution\n✅ Edge caching\n✅ Auto SSL\n✅ DDoS protection");
                updateStatus("✅ Deployment successful!");
            }, 2000);
        }

        function openDashboard() {
            speak("Opening Cloudflare edge analytics dashboard...");
            updateStatus("📊 Loading real-time edge analytics from global network...");

            setTimeout(() => {
                alert("📈 Cloudflare Edge Analytics Dashboard\n\nLive metrics:\n🌍 Global request distribution\n⚡ Response times by region\n📊 Error rates and performance\n🎯 Geographic analytics");
                updateStatus("✅ Dashboard loaded!");
            }, 2000);
        }

        function testVoice() {
            speak("Voice commands activated for Cloudflare Workers deployment!");
            updateStatus("🎤 Voice command system online - ready for edge deployment!");

            setTimeout(() => {
                alert("🎤 Voice Commands Ready!\n\nTry these commands:\n• 'Deploy to production'\n• 'Check edge health'\n• 'Show analytics'\n• 'Run tests'\n\nAll processed at the edge!");
                updateStatus("✅ Voice commands ready!");
            }, 1500);
        }

        function openDocs() {
            window.location.href = '/docs';
        }

        function activateVoiceCommands() {
            const status = document.getElementById('voice-status');
            status.innerHTML = '🤖 Activating AI voice commands on Cloudflare Workers edge network...';

            const aiResponses = [
                "AI Voice Assistant online! I'm now processing commands at Cloudflare's edge network. Let's deploy some amazing MCP connectors globally!",
                "Hello! I'm your AI development assistant powered by Cloudflare edge. I can help you build, test, and deploy connectors to 200+ edge locations!",
                "AI systems activated on Cloudflare Workers! Voice processing now happens at the edge for sub-second response times. Ready for global deployment!"
            ];

            const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];

            setTimeout(() => {
                status.innerHTML = '✅ AI Voice Assistant ready on global edge network';
                speak(response);
            }, 1500);
        }

        function updateStatus(message) {
            const status = document.getElementById('voice-status');
            status.innerHTML = message;
        }

        function speak(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                speechSynthesis.speak(utterance);
            }
        }

        // Welcome message
        window.addEventListener('load', () => {
            setTimeout(() => {
                speak("Welcome to the MCP Overflow developer platform. Let's build something amazing with Cloudflare Workers!");
            }, 1000);
        });
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
            padding: 3rem 0;
            position: relative;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 4rem 0; }
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
        .back-link:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .subtitle { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
        .ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 2.5rem;
            margin-top: 3rem;
        }
        .ai-card {
            background: white;
            border: 2px solid #e9d5ff;
            border-radius: 25px;
            padding: 2.5rem;
            text-align: center;
            box-shadow: 0 10px 30px rgba(124, 58, 237, 0.1);
            transition: all 0.3s ease;
        }
        .ai-card:hover {
            transform: translateY(-15px) scale(1.02);
            box-shadow: 0 20px 40px rgba(124, 58, 237, 0.2);
        }
        .ai-icon { font-size: 4rem; margin-bottom: 2rem; }
        .ai-card h3 { color: #4c1d95; margin-bottom: 1.5rem; font-size: 1.6rem; }
        .ai-card p { color: #6b7280; line-height: 1.7; margin-bottom: 2rem; }
        .ai-demo {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            padding: 4rem;
            border-radius: 30px;
            margin-top: 4rem;
            text-align: center;
        }
        .ai-button {
            background: white;
            color: #7c3aed;
            padding: 1.5rem 3rem;
            border: none;
            border-radius: 50px;
            font-size: 1.3rem;
            font-weight: bold;
            cursor: pointer;
            margin: 1rem;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(255, 255, 255, 0.3);
        }
        .ai-button:hover {
            transform: scale(1.05);
            box-shadow: 0 12px 30px rgba(255, 255, 255, 0.4);
        }
        .edge-info {
            background: rgba(255,255,255,0.2);
            padding: 2rem;
            border-radius: 20px;
            margin-top: 2rem;
            font-size: 1.1rem;
        }
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.5); }
            50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.8); }
        }
        .glowing { animation: glow 2s ease-in-out infinite; }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
        }
        .floating { animation: float 3s ease-in-out infinite; }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <h1 class="floating">🤖 AI Platform</h1>
            <p class="subtitle">AI-Powered MCP Connector Generation on Cloudflare Workers Edge Network</p>
        </div>
    </div>

    <div class="container content">
        <div class="ai-grid">
            <div class="ai-card">
                <div class="ai-icon glowing">🎯</div>
                <h3>Smart Generation</h3>
                <p>AI analyzes your OpenAPI specs and generates optimized MCP connectors for Cloudflare Workers deployment with edge optimization.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon glowing">🔍</div>
                <h3>Intelligent Testing</h3>
                <p>Automated testing with AI-powered insights specifically optimized for Cloudflare Workers edge deployment and performance.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon glowing">📈</div>
                <h3>Edge Analytics</h3>
                <p>AI-driven performance monitoring and optimization for Cloudflare edge network with predictive analytics.</p>
            </div>

            <div class="ai-card">
                <div class="ai-icon glowing">🔊</div>
                <h3>Voice AI Assistant</h3>
                <p>Natural voice interface powered by AI processing at Cloudflare's edge network for sub-second responses.</p>
            </div>
        </div>

        <div class="ai-demo">
            <h2>🤖 AI Voice Assistant</h2>
            <p style="font-size: 1.3rem; margin-bottom: 2rem;">
                Experience intelligent voice-powered development powered by Cloudflare Workers edge AI
            </p>

            <button class="ai-button" onclick="activateAI()">
                Activate AI Voice
            </button>

            <div class="edge-info">
                <h3>☁️ Edge AI Processing</h3>
                <p>• AI processing powered by Cloudflare Workers edge network<br>
                • Sub-second response times worldwide<br>
                • Voice commands processed locally at the edge<br>
                • Machine learning models deployed globally</p>
            </div>

            <div id="ai-status" style="margin-top: 2rem; font-size: 1.2rem;"></div>
        </div>
    </div>

    <script>
        function activateAI() {
            const status = document.getElementById('ai-status');
            status.innerHTML = '🤖 Initializing AI Voice Assistant on Cloudflare edge network...';

            const aiResponses = [
                "AI Voice Assistant online! I'm powered by Cloudflare Workers edge network, processing voice commands in under 50ms globally. Let's create some amazing MCP connectors!",
                "Hello! I'm your AI development assistant with edge intelligence. I can help you generate, test, and optimize MCP connectors with cloud-native performance!",
                "AI systems activated on Cloudflare Workers! My voice processing and AI capabilities run at the edge for lightning-fast responses. Ready for intelligent development!"
            ];

            const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];

            setTimeout(() => {
                status.innerHTML = '✅ AI Voice Assistant ready on global edge network';
                speak(response);
            }, 2000);
        }

        function speak(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.1;
                speechSynthesis.speak(utterance);
            }
        }

        // Welcome message
        window.addEventListener('load', () => {
            setTimeout(() => {
                speak("Welcome to the MCP Overflow AI Platform. Our edge AI is ready to help you build intelligent connectors!");
            }, 1000);
        });
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
            padding: 3rem 0;
            position: relative;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .content { padding: 4rem 0; }
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
        .back-link:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .search-container {
            margin: 2rem 0;
            text-align: center;
        }
        .search-box {
            background: white;
            border: 3px solid #10b981;
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
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
        .edge-info {
            background: rgba(255,255,255,0.2);
            padding: 2rem;
            border-radius: 20px;
            margin-top: 2rem;
            font-size: 1.1rem;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .slide-in { animation: slideIn 0.6s ease-out; }
    </style>
</head>
<body>
    <a href="/" class="back-link">← Back to Main</a>

    <div class="header">
        <div class="container">
            <h1>📚 Documentation</h1>
            <p>Complete Guide to MCPOverflow on Cloudflare Workers Edge Network</p>

            <div class="search-container">
                <input type="text" class="search-box" placeholder="🔍 Search documentation..." onkeyup="searchDocs(this.value)">
            </div>
        </div>
    </div>

    <div class="container content">
        <div class="docs-grid" id="docs-grid">
            <div class="doc-card slide-in" data-keywords="cloudflare workers deployment edge">
                <div class="doc-icon">☁️</div>
                <h3>Cloudflare Workers</h3>
                <p>Deploy MCP connectors to Cloudflare Workers edge network with global distribution and sub-second response times.</p>
                <a href="#" class="doc-link" onclick="loadDoc('cloudflare')">View Documentation →</a>
            </div>

            <div class="doc-card slide-in" data-keywords="voice commands deployment ai assistant">
                <div class="doc-icon">🎤</div>
                <h3>Voice Commands</h3>
                <p>Complete reference for voice-activated commands on Cloudflare edge network with AI-powered assistance.</p>
                <a href="#" class="doc-link" onclick="loadDoc('voice-commands')">View Documentation →</a>
            </div>

            <div class="doc-card slide-in" data-keywords="quick start getting started deployment">
                <div class="doc-icon">🚀</div>
                <h3>Quick Start</h3>
                <p>Get up and running with MCPOverflow on Cloudflare Workers edge network in minutes with voice-activated deployment.</p>
                <a href="#" class="doc-link" onclick="loadDoc('quick-start')">View Documentation →</a>
            </div>

            <div class="doc-card slide-in" data-keywords="api reference connectors endpoints">
                <div class="doc-icon">🔌</div>
                <h3>API Reference</h3>
                <p>Detailed API documentation for MCP connectors on Cloudflare Workers with edge-optimized endpoints.</p>
                <a href="#" class="doc-link" onclick="loadDoc('api-reference')">View Documentation →</a>
            </div>

            <div class="doc-card slide-in" data-keywords="monitoring analytics edge performance">
                <div class="doc-icon">📊</div>
                <h3>Edge Analytics</h3>
                <p>Monitor connectors with Cloudflare edge analytics, real-time metrics, and global performance insights.</p>
                <a href="#" class="doc-link" onclick="loadDoc('edge-analytics')">View Documentation →</a>
            </div>

            <div class="doc-card slide-in" data-keywords="troubleshooting help support deployment">
                <div class="doc-icon">🔧</div>
                <h3>Troubleshooting</h3>
                <p>Common issues and solutions for Cloudflare Workers deployment with voice-activated debugging.</p>
                <a href="#" class="doc-link" onclick="loadDoc('troubleshooting')">View Documentation →</a>
            </div>
        </div>

        <div class="voice-docs">
            <h2>🎤 Voice Documentation Reading</h2>
            <p style="font-size: 1.3rem; margin-bottom: 2rem;">
                Ask our AI assistant to read documentation aloud from Cloudflare's edge network
            </p>
            <button class="voice-btn" onclick="readDocumentation()">Enable Voice Reading</button>

            <div class="edge-info">
                <h3>☁️ Edge-Powered Voice Processing</h3>
                <p>• Voice commands processed at Cloudflare edge locations<br>
                • Sub-second response times worldwide<br>
                • AI-powered text-to-speech with natural voices<br>
                • Automatic documentation summarization</p>
            </div>

            <div id="voice-status" style="margin-top: 2rem; font-size: 1.2rem;"></div>
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
                    card.style.animation = 'slideIn 0.6s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function loadDoc(topic) {
            const status = document.getElementById('voice-status');
            status.innerHTML = `📖 Loading ${topic.replace('-', ' ')} documentation from Cloudflare edge...`;

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    `Opening ${topic.replace('-', ' ')} documentation from Cloudflare edge network`
                );
                utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
            }

            setTimeout(() => {
                const docContent = getDocContent(topic);
                alert(docContent);
                status.innerHTML = `✅ ${topic.replace('-', ' ')} documentation loaded from edge`;
            }, 2000);
        }

        function getDocContent(topic) {
            const docs = {
                'cloudflare': '📚 Cloudflare Workers Documentation\n\nDeploy MCP connectors to global edge network:\n\n✅ 200+ edge locations worldwide\n✅ Sub-second response times\n✅ Automatic SSL certificates\n✅ DDoS protection\n✅ Serverless scaling\n\nVoice commands available for deployment!',
                'voice-commands': '🎤 Voice Commands Reference\n\nAvailable voice commands:\n\n• "Deploy to production"\n• "Check edge health"\n• "Show analytics"\n• "Run tests"\n• "Enable monitoring"\n\nAll processed at Cloudflare edge for optimal performance!',
                'quick-start': '🚀 Quick Start Guide\n\nGet started in 3 steps:\n\n1️⃣ Install Wrangler CLI\n2️⃣ Authenticate with Cloudflare\n3️⃣ Deploy with voice commands\n\nVoice-activated deployment makes it easy!',
                'api-reference': '🔌 API Reference\n\nEdge-optimized endpoints:\n\n• GET /api/health - Health check\n• POST /api/voice-command - Voice processing\n• GET /api/stats - Performance metrics\n\nAll responses in <50ms globally!',
                'edge-analytics': '📊 Edge Analytics Guide\n\nMonitor your connectors with:\n\n• Real-time global metrics\n• Geographic distribution\n• Response time analysis\n• Error tracking\n• Performance optimization',
                'troubleshooting': '🔧 Troubleshooting Guide\n\nCommon solutions:\n\n• Check authentication\n• Verify DNS settings\n• Monitor edge performance\n• Test voice commands\n• Review deployment logs'
            };

            return docs[topic] || 'Documentation content loaded successfully!';
        }

        function readDocumentation() {
            const status = document.getElementById('voice-status');
            status.innerHTML = '🎤 Activating voice documentation reading from Cloudflare edge...';

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(
                    "Voice documentation enabled from Cloudflare Workers edge network. Click on any documentation link to have it read aloud with edge processing."
                );
                utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
            }

            setTimeout(() => {
                status.innerHTML = '✅ Voice reading ready from Cloudflare edge network';

                // Demonstrate voice reading
                setTimeout(() => {
                    const demoText = "Welcome to MCPOverflow documentation! I can read any section aloud using Cloudflare's edge AI processing.";
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(demoText);
                        speechSynthesis.speak(utterance);
                    }
                }, 1000);
            }, 2000);
        }

        // Welcome message
        window.addEventListener('load', () => {
            setTimeout(() => {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(
                        "Welcome to MCPOverflow documentation. Try our voice reading feature - just click any document link!"
                    );
                    utterance.rate = 0.9;
                    speechSynthesis.speak(utterance);
                }
            }, 1500);
        });
    </script>
</body>
</html>`;
}