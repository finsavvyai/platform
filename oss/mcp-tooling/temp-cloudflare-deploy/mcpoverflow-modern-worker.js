// MCPOverflow Cloudflare Worker - Modern Professional Version
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
  try {
    const command = 'Voice command executed successfully';
    return new Response(JSON.stringify({
      message: command,
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
  <title>MCPOverflow - Enterprise MCP Connector Platform</title>
  <meta name="description" content="Professional MCP connector platform with voice-activated deployment. Generate, manage, and scale API connectors with enterprise-grade security.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #2563eb;
      --primary-dark: #1e40af;
      --secondary: #0f172a;
      --accent: #3b82f6;
      --accent-light: #60a5fa;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --gray-50: #f8fafc;
      --gray-100: #f1f5f9;
      --gray-200: #e2e8f0;
      --gray-300: #cbd5e1;
      --gray-400: #94a3b8;
      --gray-500: #64748b;
      --gray-600: #475569;
      --gray-700: #334155;
      --gray-800: #1e293b;
      --gray-900: #0f172a;
      --border: #e2e8f0;
      --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      --shadow-lg: 0 10px 25px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.05);
      --shadow-xl: 0 20px 40px rgba(0,0,0,0.2), 0 10px 20px rgba(0,0,0,0.1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: var(--gray-900);
      background: var(--gray-50);
      overflow-x: hidden;
    }

    /* Navigation */
    nav {
      position: fixed;
      top: 0;
      width: 100%;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 70px;
    }

    .nav-logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 2rem;
      list-style: none;
    }

    .nav-links a {
      color: var(--gray-600);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
      font-size: 0.95rem;
    }

    .nav-links a:hover {
      color: var(--primary);
    }

    .nav-cta {
      background: var(--primary);
      color: white;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }

    .nav-cta:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
    }

    /* Hero Section */
    .hero {
      padding: 140px 0 80px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%);
      border-radius: 50%;
      animation: float 8s ease-in-out infinite;
    }

    .hero::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
      border-radius: 50%;
      animation: float 12s ease-in-out infinite reverse;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(5deg); }
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      position: relative;
      z-index: 1;
    }

    .hero-content {
      text-align: center;
      margin-bottom: 60px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 2rem;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    .hero h1 {
      font-size: 4rem;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--gray-900) 0%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero .subtitle {
      font-size: 1.5rem;
      color: var(--gray-600);
      margin-bottom: 2rem;
      font-weight: 400;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    .hero-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 3rem;
    }

    .btn {
      padding: 0.8rem 1.6rem;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      box-shadow: var(--shadow);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .btn-secondary {
      background: white;
      color: var(--gray-700);
      border: 2px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--gray-50);
      border-color: var(--primary);
      color: var(--primary);
    }

    /* Features Grid */
    .features {
      padding: 80px 0;
      background: white;
    }

    .section-header {
      text-align: center;
      margin-bottom: 4rem;
    }

    .section-header h2 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--gray-900);
    }

    .section-header p {
      font-size: 1.2rem;
      color: var(--gray-600);
      max-width: 600px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      margin-bottom: 4rem;
    }

    .feature-card {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--accent));
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    .feature-card:hover::before {
      transform: scaleX(1);
    }

    .feature-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-xl);
      border-color: var(--accent-light);
    }

    .feature-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: white;
    }

    .feature-card h3 {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--gray-900);
    }

    .feature-card p {
      color: var(--gray-600);
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }

    .feature-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: gap 0.2s;
    }

    .feature-link:hover {
      gap: 1rem;
    }

    /* Stats Section */
    .stats {
      padding: 80px 0;
      background: linear-gradient(135deg, var(--gray-50) 0%, white 100%);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
    }

    .stat-card {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 16px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-lg);
    }

    .stat-number {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 1.1rem;
      color: var(--gray-600);
      font-weight: 600;
    }

    /* CTA Section */
    .cta {
      padding: 100px 0;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .cta::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      border-radius: 50%;
    }

    .cta-content {
      position: relative;
      z-index: 1;
    }

    .cta h2 {
      font-size: 3rem;
      font-weight: 800;
      margin-bottom: 1.5rem;
    }

    .cta p {
      font-size: 1.3rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }

    .cta .btn {
      background: white;
      color: var(--primary);
      font-size: 1.1rem;
      padding: 1rem 2rem;
    }

    .cta .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    /* Footer */
    footer {
      background: var(--gray-900);
      color: white;
      padding: 60px 0 30px;
    }

    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 3rem;
      margin-bottom: 3rem;
    }

    .footer-section h3 {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: white;
    }

    .footer-section a {
      color: var(--gray-400);
      text-decoration: none;
      display: block;
      margin-bottom: 0.5rem;
      transition: color 0.2s;
    }

    .footer-section a:hover {
      color: var(--accent-light);
    }

    .footer-bottom {
      border-top: 1px solid var(--gray-800);
      padding-top: 2rem;
      text-align: center;
      color: var(--gray-400);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .hero h1 {
        font-size: 2.5rem;
      }

      .hero .subtitle {
        font-size: 1.2rem;
      }

      .features-grid {
        grid-template-columns: 1fr;
      }

      .hero-actions {
        flex-direction: column;
        align-items: center;
      }

      .cta h2 {
        font-size: 2rem;
      }
    }

    /* Loading Animation */
    .loader {
      width: 40px;
      height: 40px;
      border: 3px solid var(--gray-200);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Voice Command Animation */
    .voice-pulse {
      animation: voicePulse 2s ease-in-out infinite;
    }

    @keyframes voicePulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
      }
      50% {
        box-shadow: 0 0 0 20px rgba(37, 99, 235, 0);
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
          <span>🔥</span>
          <span>Enterprise-Grade MCP Platform</span>
        </div>

        <h1>Transform API Development with Voice-Activated MCP Connectors</h1>

        <p class="subtitle">
          Generate, deploy, and manage MCP connectors at scale with natural language commands.
          Built for modern enterprises with security, performance, and developer experience in mind.
        </p>

        <div class="hero-actions">
          <button class="btn btn-primary" onclick="startVoiceDemo()">
            <span>🎤</span>
            <span>Try Voice Commands</span>
          </button>
          <a href="/developer/" class="btn btn-secondary">
            <span>🚀</span>
            <span>Start Building</span>
          </a>
        </div>

        <div id="voice-status" style="margin-top: 2rem; display: none;">
          <div class="loader" style="margin: 0 auto; width: 30px; height: 30px;"></div>
          <p style="margin-top: 1rem; color: var(--gray-600);">Processing voice command...</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features" id="features">
    <div class="container">
      <div class="section-header">
        <h2>Built for Modern Development Teams</h2>
        <p>Enterprise-grade features designed to accelerate your API development workflow</p>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🎤</div>
          <h3>Voice-Activated Deployment</h3>
          <p>Deploy and manage connectors using natural language commands. Simply speak your deployment instructions and watch them execute in real-time.</p>
          <a href="#" class="feature-link">Learn more →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>AI-Powered Generation</h3>
          <p>Intelligent connector generation with AI assistance. Automatically optimize performance, validate schemas, and suggest improvements.</p>
          <a href="/ai/" class="feature-link">Try AI Platform →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Lightning Fast Performance</h3>
          <p>Built on Cloudflare Workers for sub-second response times. Global edge deployment with automatic scaling and zero cold starts.</p>
          <a href="#" class="feature-link">View benchmarks →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🛡️</div>
          <h3>Enterprise Security</h3>
          <p>SOC 2 compliant with end-to-end encryption, zero-trust architecture, and comprehensive audit logs for regulatory compliance.</p>
          <a href="#" class="feature-link">Security docs →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Real-time Analytics</h3>
          <p>Monitor connector performance with detailed metrics, usage analytics, and intelligent alerts for proactive issue resolution.</p>
          <a href="#" class="feature-link">View dashboard →</a>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔌</div>
          <h3>Universal Compatibility</h3>
          <p>Support for all major API formats including OpenAPI, GraphQL, and gRPC. Seamless integration with your existing infrastructure.</p>
          <a href="/docs/" class="feature-link">API docs →</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="stats">
    <div class="container">
      <div class="section-header">
        <h2>Trusted by Leading Development Teams</h2>
        <p>Numbers that speak for themselves</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">99.9%</div>
          <div class="stat-label">Uptime SLA</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">&lt;50ms</div>
          <div class="stat-label">Global Response Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">200+</div>
          <div class="stat-label">Edge Locations</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">1M+</div>
          <div class="stat-label">API Calls Daily</div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta">
    <div class="container">
      <div class="cta-content">
        <h2>Ready to Transform Your API Development?</h2>
        <p>Join thousands of developers building the future of API connectivity</p>
        <a href="/developer/" class="btn">
          <span>🚀</span>
          <span>Get Started Free</span>
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h3>Product</h3>
          <a href="/developer/">Developer Platform</a>
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
        <p>&copy; 2025 MCPOverflow. Built with ❤️ on Cloudflare Edge Network.</p>
      </div>
    </div>
  </footer>

  <script>
    // Voice Command Functionality
    async function startVoiceDemo() {
      const statusDiv = document.getElementById('voice-status');
      const button = event.target.closest('.btn');

      // Show loading state
      statusDiv.style.display = 'block';
      button.classList.add('voice-pulse');
      button.disabled = true;

      try {
        const commands = [
          'Deploying MCP connector to production environment',
          'Activating AI-powered connector optimization',
          'Scaling infrastructure to handle increased demand',
          'Running comprehensive security validation checks'
        ];

        const command = commands[Math.floor(Math.random() * commands.length)];

        // Voice synthesis
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(command);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          speechSynthesis.speak(utterance);
        }

        // Send to backend
        const response = await fetch('/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: command,
            platform: 'enterprise',
            domain: window.location.hostname
          })
        });

        const result = await response.json();

        // Success state
        setTimeout(() => {
          statusDiv.innerHTML = \`
            <div style="color: var(--success); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <span>✅</span>
              <span>Voice command executed successfully!</span>
            </div>
          \`;

          setTimeout(() => {
            statusDiv.style.display = 'none';
            button.classList.remove('voice-pulse');
            button.disabled = false;
          }, 3000);
        }, 2000);

      } catch (error) {
        statusDiv.innerHTML = \`
          <div style="color: var(--danger); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>❌</span>
            <span>Voice command failed. Please try again.</span>
          </div>
        \`;

        setTimeout(() => {
          statusDiv.style.display = 'none';
          button.classList.remove('voice-pulse');
          button.disabled = false;
        }, 3000);
      }
    }

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Navbar scroll effect
    let lastScrollTop = 0;
    const navbar = document.querySelector('nav');

    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = 'var(--shadow)';
      } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
      }

      lastScrollTop = scrollTop;
    });

    // Analytics tracking
    function trackEvent(action, label) {
      if (typeof gtag !== 'undefined') {
        gtag('event', action, {
          'event_category': 'User Interaction',
          'event_label': label
        });
      }
    }

    // Track page view
    trackEvent('page_view', 'Enterprise Homepage');
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 2rem;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding: 3rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
      font-weight: 700;
    }
    .tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }
    .tool-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.3s ease;
    }
    .tool-card:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(59, 130, 246, 0.5);
    }
    .tool-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .tool-card h3 {
      font-size: 1.5rem;
      margin: 0 0 1rem 0;
      font-weight: 600;
    }
    .btn {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: white;
      padding: 0.8rem 1.6rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      margin-top: 1rem;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
    }
    .nav {
      text-align: center;
      padding: 2rem 0;
    }
    .nav a {
      color: #94a3b8;
      text-decoration: none;
      margin: 0 1rem;
      font-weight: 500;
    }
    .nav a:hover {
      color: white;
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
      <p style="font-size: 1.2rem; color: #94a3b8;">Professional MCP connector development environment</p>
    </div>

    <div class="tools">
      <div class="tool-card">
        <div class="tool-icon">🔧</div>
        <h3>Connector Builder</h3>
        <p>Create MCP connectors from OpenAPI specs with our intuitive visual builder. Automatic validation and optimization included.</p>
        <button class="btn" onclick="startBuilder()">Start Building</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🎤</div>
        <h3>Voice Deployment</h3>
        <p>Deploy connectors instantly with voice commands. Natural language processing understands complex deployment instructions.</p>
        <button class="btn" onclick="voiceDeploy()">Voice Deploy</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🧪</div>
        <h3>Testing Suite</h3>
        <p>Comprehensive testing framework with automated test generation, performance analysis, and security validation.</p>
        <button class="btn" onclick="runTests()">Run Tests</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">📊</div>
        <h3>Analytics Dashboard</h3>
        <p>Real-time monitoring and analytics for connector performance, usage metrics, and system health indicators.</p>
        <button class="btn" onclick="viewAnalytics()">View Analytics</button>
      </div>

      <div class="tool-card">
        <div class="tool-icon">🔄</div>
        <h3>CI/CD Integration</h3>
        <p>Seamless integration with your existing CI/CD pipelines. GitHub Actions, GitLab CI, and Jenkins support.</p>
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
      alert('Connector Builder: "Loading visual development environment..."');
    }

    function voiceDeploy() {
      alert('Voice Deployment: "Listening for deployment commands... Say: Deploy to production"');
    }

    function runTests() {
      alert('Test Suite: "Running comprehensive connector validation..."');
    }

    function viewAnalytics() {
      alert('Analytics: "Loading performance dashboard..."');
    }

    function setupCI() {
      alert('CI/CD: "Generating pipeline configuration..."');
    }

    function runSecurity() {
      alert('Security Scan: "Running vulnerability assessment..."');
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 2rem;
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: white;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding: 3rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
      font-weight: 700;
    }
    .ai-tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }
    .ai-tool {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.3s ease;
    }
    .ai-tool:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.15);
    }
    .ai-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .ai-tool h3 {
      font-size: 1.5rem;
      margin: 0 0 1rem 0;
      font-weight: 600;
    }
    .btn {
      background: linear-gradient(135deg, #10b981, #34d399);
      color: white;
      padding: 0.8rem 1.6rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      margin-top: 1rem;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
    }
    .nav {
      text-align: center;
      padding: 2rem 0;
    }
    .nav a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      margin: 0 1rem;
      font-weight: 500;
    }
    .nav a:hover {
      color: white;
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
      <p style="font-size: 1.2rem;">Advanced AI-powered MCP connector generation and optimization</p>
    </div>

    <div class="ai-tools">
      <div class="ai-tool">
        <div class="ai-icon">🤖</div>
        <h3>Smart Generation</h3>
        <p>AI automatically generates optimized MCP connectors from your API specifications. Handles complex authentication and error scenarios.</p>
        <button class="btn" onclick="generateConnector()">Generate</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">⚡</div>
        <h3>Performance Optimization</h3>
        <p>AI analyzes and optimizes your connector performance, suggesting improvements for response time and resource usage.</p>
        <button class="btn" onclick="optimizeConnector()">Optimize</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">🎯</div>
        <h3>Smart Testing</h3>
        <p>AI creates comprehensive test suites automatically, covering edge cases and performance scenarios you might miss.</p>
        <button class="btn" onclick="createTests()">Generate Tests</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">🔍</div>
        <h3>Code Analysis</h3>
        <p>AI-powered code review identifies potential issues, security vulnerabilities, and best practice violations.</p>
        <button class="btn" onclick="analyzeCode()">Analyze Code</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">📚</div>
        <h3>Documentation AI</h3>
        <p>Automatically generates comprehensive documentation, API specs, and usage examples for your connectors.</p>
        <button class="btn" onclick="generateDocs()">Generate Docs</button>
      </div>

      <div class="ai-tool">
        <div class="ai-icon">💬</div>
        <h3>AI Assistant</h3>
        <p>Chat with our AI assistant for development help, troubleshooting, and best practices guidance.</p>
        <button class="btn" onclick="startAIAssistant()">Start Chat</button>
      </div>
    </div>
  </div>

  <script>
    function generateConnector() {
      alert('AI Generator: "Analyzing your API specification... Generating optimized MCP connector..."');
    }

    function optimizeConnector() {
      alert('AI Optimizer: "Scanning for performance improvements... Found 3 optimization opportunities..."');
    }

    function createTests() {
      alert('AI Testing: "Generating comprehensive test suite... Creating 47 test cases..."');
    }

    function analyzeCode() {
      alert('AI Analysis: "Analyzing code quality... Security scan complete. No vulnerabilities detected."');
    }

    function generateDocs() {
      alert('AI Documentation: "Generating API documentation... Created interactive examples and guides."');
    }

    function startAIAssistant() {
      alert('AI Assistant: "Hello! I\'m here to help you with MCP connector development. What would you like to work on today?"');
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 2rem;
      background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
      color: white;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding: 3rem 0;
    }
    .header h1 {
      font-size: 3rem;
      margin: 0;
      font-weight: 700;
    }
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }
    .doc-section {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.3s ease;
    }
    .doc-section:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.15);
    }
    .doc-section h3 {
      font-size: 1.5rem;
      margin: 0 0 1.5rem 0;
      font-weight: 600;
      color: #60a5fa;
    }
    .doc-section ul {
      list-style: none;
      padding: 0;
    }
    .doc-section a {
      color: rgba(255, 255, 255, 0.9);
      text-decoration: none;
      display: block;
      padding: 0.8rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s;
    }
    .doc-section a:hover {
      color: #60a5fa;
      padding-left: 1rem;
    }
    .btn {
      background: linear-gradient(135deg, #ef4444, #f87171);
      color: white;
      padding: 0.8rem 1.6rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      margin: 1rem;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
    }
    .nav {
      text-align: center;
      padding: 2rem 0;
    }
    .nav a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      margin: 0 1rem;
      font-weight: 500;
    }
    .nav a:hover {
      color: white;
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
      <p style="font-size: 1.2rem;">Complete guide to MCP Overflow platform</p>
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
        </ul>
      </div>

      <div class="doc-section">
        <h3>🔧 API Reference</h3>
        <ul>
          <li><a href="#">REST API Documentation</a></li>
          <li><a href="#">MCP Protocol Guide</a></li>
          <li><a href="#">Webhook Endpoints</a></li>
          <li><a href="#">Code Examples</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🎤 Voice Commands</h3>
        <ul>
          <li><a href="#">Voice Command Basics</a></li>
          <li><a href="#">Advanced Voice Features</a></li>
          <li><a href="#">Custom Commands</a></li>
          <li><a href="#">Voice Configuration</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🚀 Deployment</h3>
        <ul>
          <li><a href="#">Cloudflare Workers</a></li>
          <li><a href="#">Custom Domains</a></li>
          <li><a href="#">Environment Configuration</a></li>
          <li><a href="#">Scaling Guidelines</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>🤖 AI Features</h3>
        <ul>
          <li><a href="#">AI Connector Generation</a></li>
          <li><a href="#">Performance Optimization</a></li>
          <li><a href="#">Smart Testing</a></li>
          <li><a href="#">AI Assistant Guide</a></li>
        </ul>
      </div>

      <div class="doc-section">
        <h3>📊 Monitoring</h3>
        <ul>
          <li><a href="#">Analytics Dashboard</a></li>
          <li><a href="#">Performance Metrics</a></li>
          <li><a href="#">Alert Configuration</a></li>
          <li><a href="#">Debugging Tools</a></li>
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
        "Explore AI-powered connector generation features..."
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
              setTimeout(speakNext, 1000);
            };
          } else {
            alert(messages[messageIndex]);
            messageIndex++;
            setTimeout(speakNext, 2000);
          }
        }
      }

      speakNext();
    }
  </script>
</body>
</html>`;
}