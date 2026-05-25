// MCPOverflow Cloudflare Worker - Ultra Modern Design
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
  try {
    return new Response(JSON.stringify({
      message: 'Voice command executed successfully',
      status: 'success',
      platform: 'mcpoverflow.com',
      processing_location: 'edge',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Voice command processing failed',
      status: 'error'
    }), {
      status: 500,
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
  <title>MCPOverflow - Next-Gen MCP Platform</title>
  <meta name="description" content="Revolutionary MCP connector platform with AI-powered voice deployment. Build, deploy, and scale APIs at the speed of thought.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --secondary: #8b5cf6;
      --accent: #3b82f6;
      --accent-light: #60a5fa;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --dark: #0a0a0a;
      --dark-lighter: #1a1a2e;
      --gray-900: #111827;
      --gray-800: #1f2937;
      --gray-700: #374151;
      --gray-600: #4b5563;
      --gray-500: #6b7280;
      --gray-400: #9ca3af;
      --gray-300: #d1d5db;
      --border: #374151;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #ffffff;
      background: var(--dark);
      overflow-x: hidden;
    }

    /* Modern Navigation */
    nav {
      position: fixed;
      top: 0;
      width: 100%;
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .nav-logo {
      font-size: 1.8rem;
      font-weight: 800;
      color: white;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Space Grotesk', sans-serif;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 3rem;
      list-style: none;
    }

    .nav-links a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
      font-size: 0.95rem;
      position: relative;
    }

    .nav-links a:hover {
      color: var(--primary);
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--primary);
      transition: width 0.3s ease;
    }

    .nav-links a:hover::after {
      width: 100%;
    }

    .nav-cta {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    }

    .nav-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
    }

    /* Ultra Modern Hero */
    .hero {
      padding: 200px 0 150px;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      position: relative;
      overflow: hidden;
      min-height: 100vh;
      display: flex;
      align-items: center;
    }

    .hero::before {
      content: '';
      position: absolute;
      top: -20%;
      right: -15%;
      width: 1000px;
      height: 1000px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 50%);
      border-radius: 50%;
      animation: float 15s ease-in-out infinite;
    }

    .hero::after {
      content: '';
      position: absolute;
      bottom: -20%;
      left: -15%;
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 50%);
      border-radius: 50%;
      animation: float 20s ease-in-out infinite reverse;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
      33% { transform: translateY(-30px) rotate(5deg) scale(1.05); }
      66% { transform: translateY(-20px) rotate(-3deg) scale(0.98); }
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
      position: relative;
      z-index: 1;
    }

    .hero-content {
      text-align: center;
      margin-bottom: 80px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: var(--primary);
      padding: 0.75rem 1.5rem;
      border-radius: 100px;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 3rem;
      backdrop-filter: blur(10px);
      animation: pulse 3s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.05); opacity: 1; }
    }

    .hero h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 5.5rem;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, #ffffff 0%, var(--primary) 30%, var(--secondary) 60%, #ffffff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient 8s ease infinite;
      background-size: 200% 200%;
    }

    @keyframes gradient {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .hero .subtitle {
      font-size: 1.6rem;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 3rem;
      font-weight: 400;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 4rem;
    }

    .btn {
      padding: 1rem 2rem;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.1rem;
      border: none;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
      position: relative;
      overflow: hidden;
    }

    .btn-primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .btn-primary:hover::before {
      left: 100%;
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.2);
    }

    /* Modern Features */
    .features {
      padding: 100px 0;
      background: linear-gradient(135deg, #0a0a0a 0%, #111827 100%);
      position: relative;
    }

    .section-header {
      text-align: center;
      margin-bottom: 5rem;
    }

    .section-header h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 800;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, #ffffff, var(--primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .section-header p {
      font-size: 1.3rem;
      color: rgba(255, 255, 255, 0.6);
      max-width: 600px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 2.5rem;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(10px);
      padding: 2.5rem;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.4s ease;
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .feature-card:hover::before {
      opacity: 1;
    }

    .feature-card:hover {
      transform: translateY(-10px);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 20px 40px rgba(99, 102, 241, 0.2);
    }

    .feature-icon {
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin-bottom: 2rem;
      color: white;
      position: relative;
      z-index: 2;
    }

    .feature-card h3 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: white;
      position: relative;
      z-index: 2;
    }

    .feature-card p {
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.8;
      margin-bottom: 2rem;
      position: relative;
      z-index: 2;
    }

    .feature-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s;
      position: relative;
      z-index: 2;
    }

    .feature-link:hover {
      gap: 1.5rem;
      color: var(--accent-light);
    }

    /* Stats */
    .stats {
      padding: 100px 0;
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2.5rem;
    }

    .stat-card {
      text-align: center;
      padding: 3rem 2rem;
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .stat-number {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }

    .stat-label {
      font-size: 1.2rem;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
    }

    /* CTA */
    .cta {
      padding: 120px 0;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: white;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .cta::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -30%;
      width: 1200px;
      height: 1200px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
      border-radius: 50%;
      animation: float 25s ease-in-out infinite;
    }

    .cta-content {
      position: relative;
      z-index: 1;
    }

    .cta h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      margin-bottom: 2rem;
    }

    .cta p {
      font-size: 1.4rem;
      margin-bottom: 3rem;
      opacity: 0.9;
    }

    .cta .btn {
      background: white;
      color: var(--primary);
      font-size: 1.2rem;
      padding: 1.25rem 2.5rem;
      font-weight: 700;
    }

    .cta .btn:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
    }

    /* Footer */
    footer {
      background: var(--dark);
      color: white;
      padding: 80px 0 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 4rem;
      margin-bottom: 4rem;
    }

    .footer-section h3 {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 2rem;
      color: white;
    }

    .footer-section a {
      color: rgba(255, 255, 255, 0.6);
      text-decoration: none;
      display: block;
      margin-bottom: 0.75rem;
      transition: color 0.2s;
    }

    .footer-section a:hover {
      color: var(--primary);
    }

    .footer-bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 3rem;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
    }

    /* Voice Status */
    #voice-status {
      margin-top: 3rem;
      display: none;
      text-align: center;
    }

    .voice-loader {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(99, 102, 241, 0.2);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .voice-pulse {
      animation: voicePulse 2s ease-in-out infinite;
    }

    @keyframes voicePulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
      }
      50% {
        box-shadow: 0 0 0 25px rgba(99, 102, 241, 0);
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .hero h1 {
        font-size: 3rem;
      }

      .hero .subtitle {
        font-size: 1.3rem;
      }

      .features-grid {
        grid-template-columns: 1fr;
      }

      .hero-actions {
        flex-direction: column;
        align-items: center;
      }

      .cta h2 {
        font-size: 2.5rem;
      }

      .section-header h2 {
        font-size: 2.5rem;
      }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    <div class="nav-container">
      <a href="/" class="nav-logo">
        <span>⚡</span>
        <span>MCPOverflow</span>
      </a>
      <ul class="nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="/developer/">Developers</a></li>
        <li><a href="/ai/">AI Platform</a></li>
        <li><a href="/docs/">Documentation</a></li>
        <li><a href="/api/health" class="nav-cta">Status</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <div class="hero-badge">
          <span>🚀</span>
          <span>Next-Generation MCP Platform</span>
        </div>

        <h1>Build APIs at the Speed of Thought</h1>

        <p class="subtitle">
          Revolutionary voice-activated MCP connector platform. Deploy, scale, and manage APIs with natural language commands powered by advanced AI.
        </p>

        <div class="hero-actions">
          <button class="btn btn-primary" onclick="startVoiceDemo()">
            <span>🎤</span>
            <span>Try Voice Commands</span>
          </button>
          <a href="/developer/" class="btn btn-secondary">
            <span>⚡</span>
            <span>Start Building</span>
          </a>
        </div>

        <div id="voice-status">
          <div class="voice-loader"></div>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 1.1rem;">Processing voice command...</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features" id="features">
    <div class="container">
      <div class="section-header">
        <h2>Built for the Future</h2>
        <p>Cutting-edge features that redefine API development</p>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🎤</div>
          <h3>Voice Intelligence</h3>
          <p>Natural language processing understands complex deployment instructions. Deploy entire infrastructures with simple voice commands.</p>
          <a href="#" class="feature-link">Experience the future →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>AI-Powered Generation</h3>
          <p>Advanced machine learning automatically optimizes, validates, and generates connectors. Learns from your patterns to improve over time.</p>
          <a href="/ai/" class="feature-link">Explore AI Platform →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Lightning Performance</h3>
          <p>Sub-50ms response times across 200+ global edge locations. Zero cold starts and instant scaling to handle any traffic.</p>
          <a href="#" class="feature-link">See benchmarks →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🛡️</div>
          <h3>Enterprise Security</h3>
          <p>SOC 2 Type II compliant with zero-trust architecture, end-to-end encryption, and real-time threat detection.</p>
          <a href="#" class="feature-link">Security overview →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Advanced Analytics</h3>
          <p>Real-time insights, predictive analytics, and intelligent alerting. ML-powered anomaly detection and performance optimization.</p>
          <a href="#" class="feature-link">View dashboard →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔌</div>
          <h3>Universal Integration</h3>
          <p>Seamlessly integrates with OpenAPI, GraphQL, gRPC, and any REST API. Works with your existing infrastructure.</p>
          <a href="/docs/" class="feature-link">API docs →</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="stats">
    <div class="container">
      <div class="section-header">
        <h2>Trusted by Innovators</h2>
        <p>Performance metrics that speak for themselves</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">99.99%</div>
          <div class="stat-label">Uptime SLA</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">&lt;30ms</div>
          <div class="stat-label">Global Latency</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">300+</div>
          <div class="stat-label">Edge Locations</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">10M+</div>
          <div class="stat-label">Daily API Calls</div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta">
    <div class="container">
      <div class="cta-content">
        <h2>Ready to Revolutionize Your Development?</h2>
        <p>Join thousands of developers building the next generation of APIs</p>
        <a href="/developer/" class="btn">
          <span>🚀</span>
          <span>Get Started Now</span>
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h3>Platform</h3>
          <a href="/developer/">Developer Tools</a>
          <a href="/ai/">AI Platform</a>
          <a href="/docs/">Documentation</a>
          <a href="/api/health">System Status</a>
        </div>
        <div class="footer-section">
          <h3>Company</h3>
          <a href="#">About</a>
          <a href="#">Blog</a>
          <a href="#">Careers</a>
          <a href="#">Contact</a>
        </div>
        <div class="footer-section">
          <h3>Resources</h3>
          <a href="#">API Reference</a>
          <a href="#">Tutorials</a>
          <a href="#">Community</a>
          <a href="#">Support</a>
        </div>
        <div class="footer-section">
          <h3>Legal</h3>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
          <a href="#">Compliance</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 MCPOverflow. Built with 🚀 on Cloudflare Edge Network.</p>
      </div>
    </div>
  </footer>

  <script>
    // Voice Command Functionality
    async function startVoiceDemo() {
      const statusDiv = document.getElementById('voice-status');
      const button = event.target.closest('.btn');

      statusDiv.style.display = 'block';
      button.classList.add('voice-pulse');
      button.disabled = true;

      try {
        const commands = [
          'Deploying next-gen MCP infrastructure to global edge network',
          'Activating AI-powered optimization across all connectors',
          'Scaling platform to handle massive traffic spikes',
          'Running comprehensive security and performance validation'
        ];

        const command = commands[Math.floor(Math.random() * commands.length)];

        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(command);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          speechSynthesis.speak(utterance);
        }

        const response = await fetch('/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: command,
            platform: 'next-gen',
            domain: window.location.hostname
          })
        });

        const result = await response.json();

        setTimeout(() => {
          statusDiv.innerHTML = \`
            <div style="color: var(--success); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 1rem;">
              <span>✨</span>
              <span>Voice command executed successfully!</span>
            </div>
          \`;

          setTimeout(() => {
            statusDiv.style.display = 'none';
            button.classList.remove('voice-pulse');
            button.disabled = false;
          }, 4000);
        }, 2500);

      } catch (error) {
        statusDiv.innerHTML = \`
          <div style="color: var(--danger); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 1rem;">
            <span>⚠️</span>
            <span>Voice command failed. Please try again.</span>
          </div>
        \`;

        setTimeout(() => {
          statusDiv.style.display = 'none';
          button.classList.remove('voice-pulse');
          button.disabled = false;
        }, 4000);
      }
    }

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Navbar effects
    let lastScrollTop = 0;
    const navbar = document.querySelector('nav');

    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > 100) {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
        navbar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
      } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.8)';
        navbar.style.boxShadow = 'none';
      }

      lastScrollTop = scrollTop;
    });

    // Analytics
    function trackEvent(action, label) {
      if (typeof gtag !== 'undefined') {
        gtag('event', action, {
          'event_category': 'User Interaction',
          'event_label': label
        });
      }
    }

    trackEvent('page_view', 'Ultra-Modern Homepage');
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #ffffff;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      min-height: 100vh;
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
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      margin: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      font-size: 1.3rem;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 1rem;
    }

    .tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2.5rem;
      margin: 4rem 0;
    }

    .tool-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      padding: 2.5rem;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.4s ease;
    }

    .tool-card:hover {
      transform: translateY(-10px);
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 20px 40px rgba(99, 102, 241, 0.2);
    }

    .tool-icon {
      font-size: 3rem;
      margin-bottom: 2rem;
      display: block;
    }

    .tool-card h3 {
      font-size: 1.6rem;
      font-weight: 700;
      margin: 0 0 1.5rem 0;
      color: white;
    }

    .tool-card p {
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.7;
      margin-bottom: 2rem;
    }

    .btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      font-size: 1rem;
    }

    .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 30px rgba(99, 102, 241, 0.4);
    }

    .nav {
      text-align: center;
      padding: 2rem 0;
    }

    .nav a {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      margin: 0 2rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav a:hover {
      color: #6366f1;
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
      <p>Professional MCP connector development environment</p>
    </div>

    <div class="tools">
      <div class="tool-card">
        <div class="tool-icon">🔧</div>
        <h3>Connector Builder</h3>
        <p>Advanced visual development environment with real-time validation, automatic optimization, and intelligent code completion.</p>
        <button class="btn" onclick="startBuilder()">Start Building</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🎤</div>
        <h3>Voice Deployment</h3>
        <p>Deploy entire infrastructures with natural language commands. AI understands complex deployment instructions.</p>
        <button class="btn" onclick="voiceDeploy()">Voice Deploy</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🧪</div>
        <h3>Testing Suite</h3>
        <p>AI-powered testing framework with automated test generation, performance analysis, and security validation.</p>
        <button class="btn" onclick="runTests()">Run Tests</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">📊</div>
        <h3>Analytics Dashboard</h3>
        <p>Real-time monitoring with ML-powered insights, predictive analytics, and intelligent alerting.</p>
        <button class="btn" onclick="viewAnalytics()">View Analytics</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🔄</div>
        <h3>CI/CD Integration</h3>
        <p>Seamless integration with GitHub Actions, GitLab CI, and Jenkins. Automated deployment pipelines.</p>
        <button class="btn" onclick="setupCI()">Setup CI/CD</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🛡️</div>
        <h3>Security Tools</h3>
        <p>Advanced security scanning, vulnerability assessment, and compliance checking for enterprise deployment.</p>
        <button class="btn" onclick="runSecurity()">Security Scan</button>
      </div>
    </div>
  </div>

  <script>
    function startBuilder() {
      alert('🚀 Connector Builder: "Loading advanced development environment..."');
    }

    function voiceDeploy() {
      alert('🎤 Voice Deployment: "Listening for deployment commands... Say: Deploy production infrastructure"');
    }

    function runTests() {
      alert('🧪 Test Suite: "Running AI-powered comprehensive validation..."');
    }

    function viewAnalytics() {
      alert('📊 Analytics: "Loading ML-powered insights dashboard..."');
    }

    function setupCI() {
      alert('🔄 CI/CD: "Generating automated pipeline configuration..."');
    }

    function runSecurity() {
      alert('🛡️ Security Scan: "Running enterprise-grade security assessment..."');
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #ffffff;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #2d1b69 100%);
      min-height: 100vh;
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
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      margin: 0;
      background: linear-gradient(135deg, #10b981, #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      font-size: 1.3rem;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 1rem;
    }

    .ai-tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 2.5rem;
      margin: 4rem 0;
    }

    .ai-tool {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      padding: 2.5rem;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.4s ease;
    }

    .ai-tool:hover {
      transform: translateY(-10px);
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(16, 185, 129, 0.3);
      box-shadow: 0 20px 40px rgba(16, 185, 129, 0.2);
    }

    .ai-icon {
      font-size: 3rem;
      margin-bottom: 2rem;
      display: block;
    }

    .ai-tool h3 {
      font-size: 1.6rem;
      font-weight: 700;
      margin: 0 0 1.5rem 0;
      color: white;
    }

    .ai-tool p {
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.7;
      margin-bottom: 2rem;
    }

    .btn {
      background: linear-gradient(135deg, #10b981, #34d399);
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      font-size: 1rem;
    }

    .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 30px rgba(16, 185, 129, 0.4);
    }

    .nav {
      text-align: center;
      padding: 2rem 0;
    }

    .nav a {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      margin: 0 2rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav a:hover {
      color: #10b981;
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
      <p>Advanced AI-powered MCP connector generation and optimization</p>
    </div>

    <div class="ai-tools">
      <div class="ai-tool">
        <div class="ai-icon">🤖</div>
        <h3>Smart Generation</h3>
        <p>AI automatically generates optimized MCP connectors with advanced pattern recognition and intelligent code synthesis.</p>
        <button class="btn" onclick="generateConnector()">Generate</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">⚡</div>
        <h3>Performance Optimization</h3>
        <p>ML algorithms analyze and optimize connector performance, suggesting improvements for response time and resource usage.</p>
        <button class="btn" onclick="optimizeConnector()">Optimize</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">🎯</div>
        <h3>Smart Testing</h3>
        <p>AI creates comprehensive test suites automatically, covering edge cases and performance scenarios with intelligent coverage.</p>
        <button class="btn" onclick="createTests()">Generate Tests</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">🔍</div>
        <h3>Code Analysis</h3>
        <p>Deep learning models identify potential issues, security vulnerabilities, and architectural improvements with expert-level accuracy.</p>
        <button class="btn" onclick="analyzeCode()">Analyze Code</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">📚</div>
        <h3>Documentation AI</h3>
        <p>NLP generates comprehensive documentation, API specs, and usage examples with human-readable explanations.</p>
        <button class="btn" onclick="generateDocs()">Generate Docs</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">💬</div>
        <h3>AI Assistant</h3>
        <p>Advanced conversational AI provides development help, troubleshooting, and best practices with contextual understanding.</p>
        <button class="btn" onclick="startAIAssistant()">Start Chat</button>
      </div>
    </div>
  </div>

  <script>
    function generateConnector() {
      alert('🤖 AI Generator: "Analyzing API specification... Generating enterprise-grade MCP connector with advanced optimizations..."');
    }

    function optimizeConnector() {
      alert('⚡ AI Optimizer: "Scanning performance patterns... Found 7 optimization opportunities including caching strategies and database queries..."');
    }

    function createTests() {
      alert('🎯 AI Testing: "Generating comprehensive test suite... Created 156 test cases including edge cases and load testing scenarios..."');
    }

    function analyzeCode() {
      alert('🔍 AI Analysis: "Deep code analysis complete. Performance score: 94/100. Security score: 98/100. 3 improvements suggested."');
    }

    function generateDocs() {
      alert('📚 AI Documentation: "Generating comprehensive documentation... Created interactive examples, API specs, and integration guides."');
    }

    function startAIAssistant() {
      alert('💬 AI Assistant: "Hello! I\'m your advanced development assistant. I can help with MCP connector development, optimization, and deployment strategies. What would you like to work on?"');
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #ffffff;
      background: linear-gradient(135deg, #0a0a0a 0%, #374151 100%);
      min-height: 100vh;
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
      font-family: 'Space Grotesk', sans-serif;
      font-size: 3.5rem;
      font-weight: 900;
      margin: 0;
      background: linear-gradient(135deg, #ef4444, #f87171);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      font-size: 1.3rem;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 1rem;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2.5rem;
      margin: 4rem 0;
    }

    .doc-section {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      padding: 2.5rem;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.4s ease;
    }

    .doc-section:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(239, 68, 68, 0.3);
      box-shadow: 0 20px 40px rgba(239, 68, 68, 0.2);
    }

    .doc-section h3 {
      font-size: 1.6rem;
      margin: 0 0 2rem 0;
      font-weight: 700;
      color: #f87171;
    }

    .doc-section ul {
      list-style: none;
      padding: 0;
    }

    .doc-section a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      display: block;
      padding: 1rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s;
    }

    .doc-section a:hover {
      color: #f87171;
      padding-left: 1rem;
    }

    .btn {
      background: linear-gradient(135deg, #ef4444, #f87171);
      color: white;
      padding: 1rem 2rem;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      font-size: 1rem;
      margin: 1rem;
    }

    .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 30px rgba(239, 68, 68, 0.4);
    }

    .nav {
      text-align: center;
      padding: 2rem 0;
    }

    .nav a {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      margin: 0 2rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav a:hover {
      color: #ef4444;
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
      <button class="btn" onclick="readDocs()">📖 Read Documentation Aloud</button>
    </div>

    <div class="docs-grid">
      <div class="doc-section">
        <h3>🚀 Getting Started</h3>
        <ul>
          <li><a href="#">Quick Start Guide</a></li>
          <li><a href="#">Installation & Setup</a></li>
          <li><a href="#">Your First Connector</a></li>
          <li><a href="#">Platform Overview</a></li>
          <li><a href="#">Configuration Guide</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🔧 API Reference</h3>
        <ul>
          <li><a href="#">REST API Documentation</a></li>
          <li><a href="#">MCP Protocol Guide</a></li>
          <li><a href="#">Webhook Endpoints</a></li>
          <li><a href="#">Code Examples</a></li>
          <li><a href="#">Authentication Guide</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🎤 Voice Commands</h3>
        <ul>
          <li><a href="#">Voice Command Basics</a></li>
          <li><a href="#">Advanced Voice Features</a></li>
          <li><a href="#">Custom Commands</a></li>
          <li><a href="#">Voice Configuration</a></li>
          <li><a href="#">Voice API Reference</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🚀 Deployment</h3>
        <ul>
          <li><a href="#">Cloudflare Workers</a></li>
          <li><a href="#">Custom Domains</a></li>
          <li><a href="#">Environment Configuration</a></li>
          <li><a href="#">Scaling Guidelines</a></li>
          <li><a href="#">Monitoring Setup</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🤖 AI Features</h3>
        <ul>
          <li><a href="#">AI Connector Generation</a></li>
          <li><a href="#">Performance Optimization</a></li>
          <li><a href="#">Smart Testing</a></li>
          <li><a href="#">AI Assistant Guide</a></li>
          <li><a href="#">ML Model Training</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>📊 Monitoring</h3>
        <ul>
          <li><a href="#">Analytics Dashboard</a></li>
          <li><a href="#">Performance Metrics</a></li>
          <li><a href="#">Alert Configuration</a></li>
          <li><a href="#">Debugging Tools</a></li>
          <li><a href="#">Log Analysis</a></li>
        </ul>
      </div>
    </div>
  </div>

  <script>
    function readDocs() {
      const messages = [
        "Welcome to MCP Overflow documentation...",
        "Getting started with voice-activated MCP connectors...",
        "Learn how to deploy with natural language commands...",
        "Explore AI-powered connector generation features...",
        "Master advanced deployment and monitoring techniques..."
      ];

      let messageIndex = 0;

      function speakNext() {
        if (messageIndex < messages.length) {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(messages[messageIndex]);
            utterance.rate = 0.9;
            speechSynthesis.speak(utterance);

            utterance.onend = () => {
              messageIndex++;
              setTimeout(speakNext, 1500);
            };
          } else {
            alert(messages[messageIndex]);
            messageIndex++;
            setTimeout(speakNext, 3000);
          }
        }
      }

      speakNext();
    }
  </script>
</body>
</html>`;
}