export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Developer Platform HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Overflow - Developer Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero { text-align: center; margin-bottom: 4rem; }
        .hero h1 { font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.5rem; opacity: 0.9; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 4rem; }
        .feature {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .feature:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .feature h3 { font-size: 1.5rem; margin-bottom: 1rem; }
        .feature p { opacity: 0.8; line-height: 1.6; }
        .cta {
            background: #4CAF50;
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.2rem;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            margin: 0.5rem;
        }
        .cta:hover {
            background: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(76,175,80,0.3);
        }
        .voice-btn {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #FF6B6B;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 1.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255,107,107,0.4);
        }
        .voice-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(255,107,107,0.6);
        }
        .voice-btn.active {
            background: #4CAF50;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(76,175,80,0.7); }
            70% { box-shadow: 0 0 0 20px rgba(76,175,80,0); }
            100% { box-shadow: 0 0 0 0 rgba(76,175,80,0); }
        }
        .terminal {
            background: #1a1a1a;
            border-radius: 10px;
            padding: 1.5rem;
            margin: 2rem 0;
            font-family: 'Courier New', monospace;
            border: 1px solid #333;
        }
        .terminal-header {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #333;
        }
        .terminal-dots {
            display: flex;
            gap: 0.5rem;
        }
        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .dot.red { background: #ff5f56; }
        .dot.yellow { background: #ffbd2e; }
        .dot.green { background: #27c93f; }
        .terminal-content {
            color: #0f0;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        .status { color: #4CAF50; }
        .error { color: #ff6b6b; }
        .info { color: #2196F3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🚀 MCP Overflow</h1>
            <p>Developer Platform - Build, Deploy, and Manage MCP Connectors</p>
            <div style="margin-top: 2rem;">
                <button class="cta" onclick="startDevelopment()">Start Building</button>
                <button class="cta" onclick="deployConnector()">Deploy Now</button>
                <button class="cta" onclick="openDocs()">Documentation</button>
            </div>
        </div>

        <div class="features">
            <div class="feature">
                <h3>⚡ Quick Deploy</h3>
                <p>Deploy your MCP connectors to Cloudflare Workers with a single command. Experience lightning-fast global deployment.</p>
                <button class="cta" onclick="quickDeploy()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Deploy Now</button>
            </div>
            <div class="feature">
                <h3>🧪 Test Suite</h3>
                <p>Comprehensive testing tools to ensure your connectors work perfectly. Run automated tests and get detailed reports.</p>
                <button class="cta" onclick="runTests()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Run Tests</button>
            </div>
            <div class="feature">
                <h3>📊 Analytics</h3>
                <p>Monitor usage, performance, and errors with real-time analytics. Optimize your connectors based on insights.</p>
                <button class="cta" onclick="viewAnalytics()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">View Analytics</button>
            </div>
            <div class="feature">
                <h3>🔧 CLI Tools</h3>
                <p>Powerful command-line tools for local development and deployment. Integrate with your existing workflow.</p>
                <button class="cta" onclick="installCLI()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Install CLI</button>
            </div>
            <div class="feature">
                <h3>🌐 Multi-Region</h3>
                <p>Deploy your connectors across multiple regions for optimal performance. Ensure low latency for global users.</p>
                <button class="cta" onclick="configureRegions()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Configure</button>
            </div>
            <div class="feature">
                <h3>🔒 Security</h3>
                <p>Enterprise-grade security with API key management, rate limiting, and encrypted data transmission.</p>
                <button class="cta" onclick="configureSecurity()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Security Settings</button>
            </div>
        </div>

        <div class="terminal">
            <div class="terminal-header">
                <div class="terminal-dots">
                    <div class="dot red"></div>
                    <div class="dot yellow"></div>
                    <div class="dot green"></div>
                </div>
                <span style="margin-left: 1rem; color: #666;">Terminal - MCP Development</span>
            </div>
            <div class="terminal-content" id="terminal">
                <div><span class="info">$</span> Welcome to MCP Overflow Developer Platform</div>
                <div><span class="status">✓</span> Cloudflare Workers runtime detected</div>
                <div><span class="status">✓</span> Development environment ready</div>
                <div><span class="info">$</span> Ready for your commands...</div>
            </div>
        </div>
    </div>

    <button class="voice-btn" onclick="toggleVoice()" id="voiceBtn">🎤</button>

    <script>
        let isVoiceActive = false;
        let recognition;

        function toggleVoice() {
            const btn = document.getElementById('voiceBtn');
            isVoiceActive = !isVoiceActive;

            if (isVoiceActive) {
                btn.classList.add('active');
                startVoiceRecognition();
                speak("Voice commands activated. Try saying 'deploy connector' or 'run tests'");
            } else {
                btn.classList.remove('active');
                stopVoiceRecognition();
            }
        }

        function startVoiceRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;

                recognition.onresult = function(event) {
                    const last = event.results.length - 1;
                    const command = event.results[last][0].transcript.toLowerCase();

                    if (event.results[last].isFinal) {
                        processVoiceCommand(command);
                    }
                };

                recognition.onerror = function(event) {
                    console.error('Speech recognition error:', event.error);
                };

                recognition.start();
            }
        }

        function stopVoiceRecognition() {
            if (recognition) {
                recognition.stop();
            }
        }

        function processVoiceCommand(command) {
            addTerminalOutput(\`🎤 Voice command: "\${command}"\`);

            if (command.includes('deploy')) {
                quickDeploy();
            } else if (command.includes('test')) {
                runTests();
            } else if (command.includes('analytics')) {
                viewAnalytics();
            } else if (command.includes('docs')) {
                openDocs();
            } else if (command.includes('build') || command.includes('develop')) {
                startDevelopment();
            } else {
                speak("I didn't understand that command. Try 'deploy', 'test', or 'docs'.");
                addTerminalOutput('<span class="error">Unknown command:</span> ' + command);
            }
        }

        function speak(text) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.1;
                utterance.pitch = 1.0;
                speechSynthesis.speak(utterance);
            }
        }

        function addTerminalOutput(text) {
            const terminal = document.getElementById('terminal');
            const line = document.createElement('div');
            line.innerHTML = text;
            terminal.appendChild(line);
            terminal.scrollTop = terminal.scrollHeight;
        }

        function startDevelopment() {
            addTerminalOutput('<span class="info">$</span> Starting development environment...');
            setTimeout(() => {
                addTerminalOutput('<span class="status">✓</span> Development server started on port 3000');
                addTerminalOutput('<span class="status">✓</span> Hot reload enabled');
                addTerminalOutput('<span class="info">$</span> Ready for development');
                speak("Development environment ready");
            }, 2000);
        }

        function deployConnector() {
            addTerminalOutput('<span class="info">$</span> Starting deployment to Cloudflare Workers...');
            setTimeout(() => {
                addTerminalOutput('<span class="status">✓</span> Building connector...');
                addTerminalOutput('<span class="status">✓</span> Running tests...');
                addTerminalOutput('<span class="status">✓</span> Deploying to global network...');
                addTerminalOutput('<span class="status">✓</span> Deployment completed successfully!');
                addTerminalOutput('<span class="info">$</span> Connector live at: https://your-worker.workers.dev');
                speak("Deployment completed successfully!");
            }, 3000);
        }

        function quickDeploy() {
            addTerminalOutput('<span class="info">$</span> Quick deploy activated...');
            setTimeout(() => {
                addTerminalOutput('<span class="status">✓</span> Using cached build...');
                addTerminalOutput('<span class="status">✓</span> Skipping tests (quick mode)...');
                addTerminalOutput('<span class="status">✓</span> Deploying to edge locations...');
                addTerminalOutput('<span class="status">✓</span> Quick deploy completed!');
                speak("Quick deploy completed successfully!");
            }, 1500);
        }

        function runTests() {
            addTerminalOutput('<span class="info">$</span> Running connector tests...');
            setTimeout(() => {
                addTerminalOutput('<span class="status">✓</span> API endpoint tests passed');
                addTerminalOutput('<span class="status">✓</span> Authentication tests passed');
                addTerminalOutput('<span class="status">✓</span> Performance tests passed');
                addTerminalOutput('<span class="status">✓</span> All tests passed successfully!');
                speak("All tests passed successfully!");
            }, 2500);
        }

        function viewAnalytics() {
            addTerminalOutput('<span class="info">$</span> Fetching analytics data...');
            setTimeout(() => {
                addTerminalOutput('<span class="info">📊</span> Requests today: 1,234');
                addTerminalOutput('<span class="info">📈</span> Success rate: 99.8%');
                addTerminalOutput('<span class="info">⚡</span> Avg response time: 45ms');
                addTerminalOutput('<span class="info">🌍</span> Top regions: US, EU, APAC');
                speak("Analytics dashboard ready");
            }, 1500);
        }

        function openDocs() {
            window.open('https://mcpoverflow.dev', '_blank');
            speak("Opening documentation in new tab");
        }

        function installCLI() {
            addTerminalOutput('<span class="info">$</span> Installing MCP CLI...');
            setTimeout(() => {
                addTerminalOutput('<span class="status">✓</span> Downloading mcp-cli...');
                addTerminalOutput('<span class="status">✓</span> Installing global commands...');
                addTerminalOutput('<span class="status">✓</span> CLI installed successfully!');
                addTerminalOutput('<span class="info">$</span> Run: mcp --help to get started');
                speak("CLI tools installed successfully");
            }, 2000);
        }

        function configureRegions() {
            addTerminalOutput('<span class="info">$</span> Opening region configuration...');
            speak("Region configuration opened");
        }

        function configureSecurity() {
            addTerminalOutput('<span class="info">$</span> Opening security settings...');
            speak("Security settings opened");
        }

        // Welcome message
        setTimeout(() => {
            speak("Welcome to MCP Overflow Developer Platform. Try our voice commands by clicking the microphone button.");
        }, 1000);
    </script>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders,
      },
    })
  },
}
