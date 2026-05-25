/**
 * SDLC.ai - Landing Page Worker
 */

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SDLC.ai - The AI-Powered Software Development Lifecycle Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .gradient-text {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .hero-gradient {
      background: radial-gradient(circle at 50% 0%, rgba(102, 126, 234, 0.15) 0%, transparent 50%);
    }
  </style>
</head>
<body class="bg-slate-950 text-white min-h-screen">
  <!-- Navigation -->
  <nav class="border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 gradient-bg rounded-lg"></div>
          <span class="text-xl font-bold">SDLC.ai</span>
        </div>
        <div class="hidden md:flex items-center space-x-8">
          <a href="#features" class="text-slate-300 hover:text-white transition">Features</a>
          <a href="#pricing" class="text-slate-300 hover:text-white transition">Pricing</a>
          <a href="#docs" class="text-slate-300 hover:text-white transition">Docs</a>
          <a href="https://api.sdlc.cc" class="text-slate-300 hover:text-white transition">API</a>
        </div>
        <div class="flex items-center space-x-4">
          <a href="https://api.sdlc.cc/health" class="text-sm text-slate-400 hover:text-white transition">Status</a>
          <button class="gradient-bg px-4 py-2 rounded-lg font-medium hover:opacity-90 transition">Get Started</button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero-gradient relative py-32">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div class="inline-flex items-center px-4 py-2 bg-slate-800/50 rounded-full text-sm text-slate-300 mb-8">
        <span class="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
        API Live • Production Ready
      </div>
      <h1 class="text-5xl md:text-7xl font-extrabold mb-6">
        <span class="gradient-text">Ship Software</span>
        <br>10x Faster with AI
      </h1>
      <p class="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
        The complete AI-powered SDLC platform. From code generation to CI/CD automation,
        observability to compliance—all in one place.
      </p>
      <div class="flex flex-col sm:flex-row justify-center items-center gap-4">
        <a href="https://api.sdlc.cc" class="gradient-bg px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition">
          Try the API →
        </a>
        <a href="#docs" class="px-8 py-4 rounded-xl font-semibold text-lg border border-slate-700 hover:border-slate-600 transition">
          Read the Docs
        </a>
      </div>
    </div>
  </section>

  <!-- Features Grid -->
  <section id="features" class="py-24 bg-slate-900/50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-16">Everything You Need</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">AI Code Generation</h3>
          <p class="text-slate-400">Generate production-ready code with AI assistants trained on your codebase.</p>
        </div>
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">Automated CI/CD</h3>
          <p class="text-slate-400">GitHub Actions workflows, blue-green deployments, automatic rollbacks.</p>
        </div>
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">API Gateway</h3>
          <p class="text-slate-400">Rate limiting, PII redaction, auth, and observability out of the box.</p>
        </div>
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">Observability</h3>
          <p class="text-slate-400">Distributed tracing, metrics, logs, and alerts powered by OpenTelemetry.</p>
        </div>
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">Compliance</h3>
          <p class="text-slate-400">SOC 2, HIPAA, GDPR ready with automated policy enforcement.</p>
        </div>
        <div class="p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div class="w-12 h-12 gradient-bg rounded-xl mb-4"></div>
          <h3 class="text-xl font-semibold mb-2">Multi-Tenant</h3>
          <p class="text-slate-400">Built for SaaS with tenant isolation, RBAC, and per-tenant configs.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- API Preview -->
  <section class="py-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-800">
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 class="text-3xl md:text-4xl font-bold mb-4">RESTful API</h2>
            <p class="text-slate-400 mb-6">OpenAI-compatible endpoints with enterprise features.</p>
            <ul class="space-y-3 text-slate-300">
              <li class="flex items-center"><span class="text-green-400 mr-2">✓</span> Rate limiting (3 tiers)</li>
              <li class="flex items-center"><span class="text-green-400 mr-2">✓</span> PII detection & redaction</li>
              <li class="flex items-center"><span class="text-green-400 mr-2">✓</span> Usage analytics</li>
              <li class="flex items-center"><span class="text-green-400 mr-2">✓</span> 99.9% uptime SLA</li>
            </ul>
            <div class="mt-8">
              <code class="bg-slate-950 px-4 py-2 rounded-lg text-sm">https://api.sdlc.cc/v1/chat/completions</code>
            </div>
          </div>
          <div class="bg-slate-950 rounded-xl p-6 font-mono text-sm">
            <div class="text-slate-500 mb-2"># Example request</div>
            <div class="text-green-400 mb-4">curl -X POST https://api.sdlc.cc/v1/chat/completions \\</div>
            <div class="pl-4 text-slate-300">-H "Authorization: Bearer YOUR_KEY" \\</div>
            <div class="pl-4 text-slate-300">-H "Content-Type: application/json" \\</div>
            <div class="pl-4 text-slate-300">-d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-slate-800 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
      <div class="flex justify-center items-center space-x-2 mb-4">
        <div class="w-6 h-6 gradient-bg rounded"></div>
        <span class="font-semibold text-white">SDLC.ai</span>
      </div>
      <p class="text-sm">© 2026 SDLC.ai • Production at api.sdlc.cc</p>
    </div>
  </footer>
</body>
</html>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'sdlc-landing',
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // API proxy to main API
    if (url.pathname.startsWith('/api/')) {
      const apiUrl = new URL(url.pathname + url.search, 'https://api.sdlc.cc');
      return fetch(apiUrl.toString(), request);
    }

    // Serve landing page
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
