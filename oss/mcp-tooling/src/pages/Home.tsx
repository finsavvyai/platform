import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Code2, Shield, Sparkles, Layers, Globe } from 'lucide-react';

export function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-slate-100" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative">
      <section className="max-w-7xl mx-auto px-4 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 shadow-soft">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Next-gen API integration</span>
          </div>

          <h1 className="text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
            Overflow your APIs
            <br />
            <span className="text-gradient">into MCPs</span>
          </h1>

          <p className="text-xl text-gray-600 mb-12 leading-relaxed max-w-2xl mx-auto font-light">
            Generate, host, and sync MCP servers from any API specification.
            Transform your OpenAPI specs into production-ready connectors in seconds.
          </p>

          <div className="flex gap-4 justify-center">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-elevated hover:shadow-floating transition-all duration-300 transform hover:scale-105"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 glass px-8 py-4 rounded-2xl font-semibold text-gray-700 shadow-soft hover:shadow-elevated transition-all duration-300"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="glass rounded-3xl p-2 shadow-elevated max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500" />

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs text-slate-400 font-medium">openapi.json</span>
                </div>
                <pre className="text-sm text-emerald-400 font-mono leading-relaxed">
{`{
  "openapi": "3.0.0",
  "info": {
    "title": "Payment API",
    "version": "1.0.0"
  },
  "paths": {
    "/payments": {
      "post": {
        "summary": "Create payment"
      }
    }
  }
}`}
                </pre>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-400 font-medium">Generated MCP</span>
                </div>
                <pre className="text-sm text-cyan-400 font-mono leading-relaxed">
{`{
  "name": "payment-api",
  "version": "1.0.0",
  "tools": [{
    "name": "createPayment",
    "description": "Create payment",
    "inputSchema": {
      "type": "object",
      "properties": { ... }
    }
  }]
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Why developers choose us
          </h2>
          <p className="text-lg text-gray-600 font-light">
            Enterprise-grade infrastructure with developer-first experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass rounded-3xl p-8 shadow-soft hover:shadow-elevated transition-all duration-300 group">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Lightning Fast
            </h3>
            <p className="text-gray-600 leading-relaxed font-light">
              Generate connectors in under 60 seconds with sub-200ms edge response times
            </p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-soft hover:shadow-elevated transition-all duration-300 group">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Layers className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Multi Runtime
            </h3>
            <p className="text-gray-600 leading-relaxed font-light">
              TypeScript, Go, or downloadable bundles for any deployment target
            </p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-soft hover:shadow-elevated transition-all duration-300 group">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Smart Auth
            </h3>
            <p className="text-gray-600 leading-relaxed font-light">
              Auto-detect API keys, OAuth2, JWT with secure vault storage
            </p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-soft hover:shadow-elevated transition-all duration-300 group">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Global Edge
            </h3>
            <p className="text-gray-600 leading-relaxed font-light">
              Deploy to 300+ cities worldwide on Cloudflare's edge network
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-32">
        <div className="glass rounded-3xl p-12 shadow-elevated relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-cyan-600/5" />
          <div className="relative text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Ready to transform your APIs?
            </h2>
            <p className="text-lg text-gray-600 mb-8 font-light">
              Join developers building the next generation of integrations
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-elevated hover:shadow-floating transition-all duration-300 transform hover:scale-105"
            >
              Start Building Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/50 backdrop-blur-sm py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Code2 className="w-5 h-5" />
              <span className="font-semibold">MCPoverflow</span>
            </div>
            <p className="text-gray-600 text-sm font-light">
              Transform APIs into MCP connectors with zero configuration
            </p>
          </div>
        </div>
      </footer>
    </div>
    </div>
  );
}
