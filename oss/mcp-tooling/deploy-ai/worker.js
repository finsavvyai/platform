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

    // AI Platform HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Overflow - AI Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .hero { text-align: center; margin-bottom: 4rem; }
        .hero h1 { font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .hero p { font-size: 1.5rem; opacity: 0.9; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; margin-bottom: 4rem; }
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
        .chat-container {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 1.5rem;
            margin: 2rem 0;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .chat-messages {
            height: 400px;
            overflow-y: auto;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 1rem;
        }
        .message {
            margin-bottom: 1rem;
            padding: 0.8rem;
            border-radius: 10px;
            max-width: 80%;
        }
        .message.user {
            background: #4CAF50;
            margin-left: auto;
            text-align: right;
        }
        .message.ai {
            background: #2196F3;
            margin-right: auto;
        }
        .chat-input {
            display: flex;
            gap: 1rem;
        }
        .chat-input input {
            flex: 1;
            padding: 1rem;
            border: none;
            border-radius: 50px;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 1rem;
        }
        .chat-input input::placeholder { color: rgba(255,255,255,0.7); }
        .chat-input button {
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            background: #4CAF50;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .chat-input button:hover { background: #45a049; }
        .btn {
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
        .btn:hover {
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
        .ai-assistant {
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            padding: 1rem;
            margin: 1rem 0;
            border-left: 4px solid #4CAF50;
        }
        .ai-name {
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🤖 MCP Overflow</h1>
            <p>AI Platform - Intelligent MCP Connector Development</p>
            <div style="margin-top: 2rem;">
                <button class="btn" onclick="startChat()">Start AI Chat</button>
                <button class="btn" onclick="generateConnector()">Generate with AI</button>
                <button class="btn" onclick="optimizeConnectors()">Optimize Connectors</button>
            </div>
        </div>

        <div class="features">
            <div class="feature">
                <h3>🧠 AI Assistant</h3>
                <p>Get intelligent help with MCP connector development. Our AI can analyze your requirements and suggest optimal implementations.</p>
                <div class="ai-assistant">
                    <div class="ai-name">Alex - MCP Expert</div>
                    <div>"I can help you design efficient MCP connectors, optimize performance, and troubleshoot issues."</div>
                </div>
                <button class="btn" onclick="chatWithAssistant('Alex')" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Chat with Alex</button>
            </div>

            <div class="feature">
                <h3>⚡ Smart Generation</h3>
                <p>AI-powered OpenAPI analysis and MCP connector generation. Automatically detect authentication schemes and optimize API calls.</p>
                <button class="btn" onclick="smartGenerate()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Smart Generate</button>
            </div>

            <div class="feature">
                <h3>🔍 Code Analysis</h3>
                <p>Advanced code analysis to identify optimization opportunities, security vulnerabilities, and performance improvements.</p>
                <button class="btn" onclick="analyzeCode()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Analyze Code</button>
            </div>

            <div class="feature">
                <h3>🎯 Performance Optimization</h3>
                <p>AI-driven performance optimization for your MCP connectors. Get actionable insights to improve response times and resource usage.</p>
                <button class="btn" onclick="optimizePerformance()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Optimize Now</button>
            </div>

            <div class="feature">
                <h3>🛡️ Security Scanner</h3>
                <p>AI-powered security analysis to identify vulnerabilities and suggest fixes for authentication, authorization, and data protection.</p>
                <button class="btn" onclick="securityScan()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Security Scan</button>
            </div>

            <div class="feature">
                <h3>📚 Learning Hub</h3>
                <p>AI-curated learning resources and tutorials personalized to your skill level and development goals.</p>
                <button class="btn" onclick="openLearning()" style="margin-top: 1rem; padding: 0.8rem 1.5rem; font-size: 1rem;">Start Learning</button>
            </div>
        </div>

        <div class="chat-container" id="chatContainer" style="display: none;">
            <h3>AI Assistant Chat</h3>
            <div class="chat-messages" id="chatMessages">
                <div class="message ai">
                    👋 Hello! I'm your AI assistant for MCP connector development. How can I help you today?
                </div>
            </div>
            <div class="chat-input">
                <input type="text" id="chatInput" placeholder="Ask me anything about MCP connectors..." onkeypress="handleChatInput(event)">
                <button onclick="sendMessage()">Send</button>
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
                speak("AI assistant activated! I'm here to help you with MCP connector development.");
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
            if (command.includes('chat') || command.includes('talk')) {
                startChat();
            } else if (command.includes('generate')) {
                generateConnector();
            } else if (command.includes('optimize')) {
                optimizeConnectors();
            } else if (command.includes('analyze')) {
                analyzeCode();
            } else if (command.includes('security')) {
                securityScan();
            } else {
                const messages = document.getElementById('chatMessages');
                addMessage('ai', "I heard: " + command + ". You can ask me to generate connectors, optimize code, or start a chat!");
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

        function startChat() {
            document.getElementById('chatContainer').style.display = 'block';
            document.getElementById('chatInput').focus();
        }

        function generateConnector() {
            startChat();
            addMessage('ai', "I'll help you generate an MCP connector! Please provide your OpenAPI specification URL or upload the file, and I'll analyze it and create the optimal MCP connector for you.");
        }

        function optimizeConnectors() {
            startChat();
            addMessage('ai', "Connector optimization is one of my specialties! Share your connector code, and I'll analyze it for performance improvements, security enhancements, and best practices.");
        }

        function smartGenerate() {
            startChat();
            addMessage('ai', "Smart generation activated! I'll use advanced AI to analyze your requirements and generate the most efficient MCP connector possible. What's your target API?");
        }

        function analyzeCode() {
            startChat();
            addMessage('ai', "I'll perform a comprehensive code analysis. Paste your MCP connector code, and I'll identify optimization opportunities, potential issues, and improvement suggestions.");
        }

        function optimizePerformance() {
            startChat();
            addMessage('ai', "Performance optimization ready! I can analyze your connector's bottlenecks, caching strategies, and resource usage to recommend specific improvements.");
        }

        function securityScan() {
            startChat();
            addMessage('ai', "Security scanner activated! I'll check for authentication vulnerabilities, authorization issues, data exposure risks, and security best practices in your MCP connector.");
        }

        function openLearning() {
            window.open('https://mcpoverflow.dev', '_blank');
            speak("Opening learning resources for you");
        }

        function chatWithAssistant(assistantName) {
            startChat();
            addMessage('ai', \`Hello! I'm \${assistantName}, your MCP development assistant. I'm here to help you create amazing connectors. What would you like to work on today?\`);
        }

        function handleChatInput(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }

        function sendMessage() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();

            if (message) {
                addMessage('user', message);
                input.value = '';

                // Simulate AI response
                setTimeout(() => {
                    const response = generateAIResponse(message);
                    addMessage('ai', response);
                    speak(response);
                }, 1000);
            }
        }

        function addMessage(sender, text) {
            const messages = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;
            messageDiv.textContent = text;
            messages.appendChild(messageDiv);
            messages.scrollTop = messages.scrollHeight;
        }

        function generateAIResponse(userMessage) {
            const responses = [
                "That's a great question! Based on your requirements, I recommend using TypeScript for better type safety in your MCP connector.",
                "I can help you optimize that! Consider implementing caching for frequently accessed data to improve performance.",
                "For authentication, I suggest using OAuth 2.0 with JWT tokens for secure API access.",
                "Have you considered using Cloudflare Workers for global deployment? It would provide excellent performance.",
                "Let me analyze that pattern. I think a factory pattern would work well for your connector generation.",
                "Security is crucial! Make sure to implement proper rate limiting and input validation.",
                "For error handling, I recommend using structured error responses with proper HTTP status codes."
            ];

            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Welcome message
        setTimeout(() => {
            speak("Welcome to MCP Overflow AI Platform. Our AI assistants are ready to help you build intelligent connectors.");
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
