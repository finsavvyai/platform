import Link from 'next/link';
import { KeyRound, ArrowRight } from 'lucide-react';
import { CodeBlock } from '@/components/dashboard/CodeBlock';

export const metadata = {
  title: 'Quick Start — TokenForge',
  description: 'Add device-bound session security with one script tag, one DNS record, or one npm install.',
};

const cnameCode = `# Add one DNS record. Done.
app.example.com  CNAME  proxy.tokenforge.opensyber.cloud`;

const scriptCode = `<!-- Add to index.html — works with React, Angular, Vue, or plain HTML -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>`;

const middlewareCode = `npm install @opensyber/tokenforge

// Hono
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
app.use('/admin/*', requireFreshSig({ minTrustScore: 90 }));

// Express
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
app.use('/admin', requireFreshSig({ minTrustScore: 90 }));

// Next.js
export const GET = withTokenForge(handler, { apiKey: process.env.TOKENFORGE_API_KEY! });

// Fastify
fastify.register(tokenForgePlugin, { apiKey: process.env.TOKENFORGE_API_KEY! });

// SvelteKit (src/hooks.server.ts)
export const handle = tokenForgeHandle({ apiKey: process.env.TOKENFORGE_API_KEY! });

// Astro (src/middleware.ts)
export const onRequest = tokenForgeMiddleware({ apiKey: import.meta.env.TOKENFORGE_API_KEY });`;

export default function PublicDocsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <nav aria-label="Documentation navigation" className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-info text-void px-4 py-2 text-sm font-medium glow-info hover:brightness-110 transition">
            Get Started Free
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-36 pb-24">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
          Documentation
        </span>
        <h1 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-2">Quick Start</h1>
        <p className="text-text-secondary mb-10">
          Pick the easiest path for you. All three protect every session after login.
        </p>

        <div className="space-y-6">
          {/* Easiest: DNS */}
          <div className="gradient-border">
            <div className="rounded-2xl bg-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-ok/20 px-2.5 py-0.5 text-xs font-medium text-ok">Easiest</span>
                <span className="text-xs text-text-muted">Team plan</span>
              </div>
              <h2 className="text-lg font-semibold mb-2">DNS Proxy — zero code</h2>
              <p className="text-sm text-text-secondary mb-4">
                Add one DNS record. We auto-inject the script and verify every request. No code changes to your app.
              </p>
              <CodeBlock code={cnameCode} language="bash" />
              <p className="mt-3 text-xs text-text-muted">
                Set up in <Link href="/dashboard/proxy" className="text-info hover:text-signal-hover">Dashboard → Zero-Code Proxy</Link>
              </p>
            </div>
          </div>

          {/* Simple: Script tag */}
          <div className="gradient-border">
            <div className="rounded-2xl bg-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-info/20 px-2.5 py-0.5 text-xs font-medium text-info">Simple</span>
                <span className="text-xs text-text-muted">All plans</span>
              </div>
              <h2 className="text-lg font-semibold mb-2">Script Tag — one line of HTML</h2>
              <p className="text-sm text-text-secondary mb-4">
                Add the script to your HTML. Works in React, Angular, Vue, Next.js, or plain HTML.
                Auto-generates device keys and signs every request.
              </p>
              <CodeBlock code={scriptCode} language="html" />
              <p className="mt-4 text-sm text-text-secondary mb-4">
                Then add one line of server middleware to verify:
              </p>
              <CodeBlock code={middlewareCode} language="typescript" />
            </div>
          </div>

          {/* Advanced: npm */}
          <div className="gradient-border">
            <div className="rounded-2xl bg-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-wire px-2.5 py-0.5 text-xs font-medium text-text-secondary">Advanced</span>
                <span className="text-xs text-text-muted">All plans</span>
              </div>
              <h2 className="text-lg font-semibold mb-2">npm Package — full control</h2>
              <p className="text-sm text-text-secondary mb-3">
                For React hooks, TypeScript types, or custom configuration. Same API key, same protection.
              </p>
              <p className="text-sm text-text-muted">
                See framework guides: {' '}
                <Link href="/docs/integrations#react" className="text-info hover:text-signal-hover">React</Link>{', '}
                <Link href="/docs/integrations#angular" className="text-info hover:text-signal-hover">Angular</Link>{', '}
                <Link href="/docs/integrations#vue" className="text-info hover:text-signal-hover">Vue</Link>{', '}
                <Link href="/docs/integrations#clerk" className="text-info hover:text-signal-hover">Clerk</Link>{', '}
                <Link href="/docs/integrations#microsoft-365" className="text-info hover:text-signal-hover">Microsoft 365</Link>{', '}
                <Link href="/docs/integrations#auth0" className="text-info hover:text-signal-hover">Auth0</Link>
              </p>
            </div>
          </div>

          {/* Mobile & AI Agents */}
          <div className="gradient-border">
            <div className="rounded-2xl bg-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-medium text-purple-400">Native SDKs</span>
                <span className="text-xs text-text-muted">All plans</span>
              </div>
              <h2 className="text-lg font-semibold mb-2">Mobile &amp; AI Agents</h2>
              <p className="text-sm text-text-secondary mb-3">
                Same trust scoring engine, platform-native key storage. One API key across all platforms.
              </p>
              <p className="text-sm text-text-muted">
                <Link href="/docs/integrations/native#swift" className="text-info hover:text-signal-hover">Swift (iOS)</Link>{', '}
                <Link href="/docs/integrations/native#kotlin" className="text-info hover:text-signal-hover">Kotlin (Android)</Link>{', '}
                <Link href="/docs/integrations/native#react-native" className="text-info hover:text-signal-hover">React Native</Link>{', '}
                <Link href="/docs/integrations/native#python" className="text-info hover:text-signal-hover">Python</Link>{', '}
                <Link href="/docs/integrations/native#go" className="text-info hover:text-signal-hover">Go</Link>{', '}
                <Link href="/docs/integrations/native#mcp" className="text-info hover:text-signal-hover">MCP Server</Link>
              </p>
            </div>
          </div>

          {/* Get API Key */}
          <div className="gradient-border glow-info">
            <div className="rounded-2xl bg-panel p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Get your API key</h3>
              <p className="text-sm text-text-secondary mb-4">
                Sign up with Google or GitHub. Your API key is generated automatically.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-info text-void px-8 py-4 text-sm font-medium glow-info hover:brightness-110 transition"
              >
                Sign Up Free <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs text-text-muted">
                Free tier: 10,000 verifications/month. No credit card.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
