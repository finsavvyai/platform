import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { CodeBlock } from '@/components/dashboard/CodeBlock';

export const metadata = {
  title: '5-Minute Quickstart — TokenForge',
  description: 'From npm install to a verified bound session in five minutes. Hono, Express, Fastify, Next.js, SvelteKit, Astro.',
};

const installCode = `npm install @opensyber/tokenforge`;

const honoCode = `import { Hono } from 'hono';
import { tokenForgeMiddleware, requireFreshSig } from '@opensyber/tokenforge/hono';

const app = new Hono();
app.use('*', tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
app.use('/admin/*', requireFreshSig({ minTrustScore: 90 }));

app.get('/', (c) => c.text(\`trust=\${c.get('tf')?.trustScore ?? 0}\`));
export default app;`;

const expressCode = `import express from 'express';
import { tokenForgeMiddleware, requireFreshSig } from '@opensyber/tokenforge/express';

const app = express();
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));
app.use('/admin', requireFreshSig({ minTrustScore: 90 }));

app.get('/', (req, res) => res.json({ trust: req.tf?.trustScore ?? 0 }));
app.listen(3000);`;

const fastifyCode = `import Fastify from 'fastify';
import { tokenForgePlugin, requireFreshSig } from '@opensyber/tokenforge/fastify';

const fastify = Fastify();
fastify.register(tokenForgePlugin, { apiKey: process.env.TOKENFORGE_API_KEY! });
fastify.addHook('preHandler', async (req, reply) => {
  if (req.url.startsWith('/admin')) await requireFreshSig({ minTrustScore: 90 })(req, reply);
});

fastify.get('/', async (req) => ({ trust: req.tf?.trustScore ?? 0 }));
fastify.listen({ port: 3000 });`;

const nextCode = `// app/api/me/route.ts
import { withTokenForge } from '@opensyber/tokenforge/nextjs';

export const GET = withTokenForge(async (req, tf) => {
  return Response.json({ trust: tf.trustScore });
}, { apiKey: process.env.TOKENFORGE_API_KEY! });`;

const svelteKitCode = `// src/hooks.server.ts
import { tokenForgeHandle } from '@opensyber/tokenforge/sveltekit';
export const handle = tokenForgeHandle({
  apiKey: process.env.TOKENFORGE_API_KEY!,
});

// src/routes/admin/+page.server.ts
import { requireFreshSig } from '@opensyber/tokenforge/sveltekit';
export const load = ({ locals }) => {
  requireFreshSig({ locals }, { minTrustScore: 90 });
  return { trust: locals.tf?.trustScore };
};`;

const astroCode = `// src/middleware.ts
import { tokenForgeMiddleware } from '@opensyber/tokenforge/astro';
export const onRequest = tokenForgeMiddleware({
  apiKey: import.meta.env.TOKENFORGE_API_KEY,
});

// src/pages/admin/index.astro
---
import { requireFreshSig } from '@opensyber/tokenforge/astro';
const stepUp = requireFreshSig(Astro.locals, { minTrustScore: 90 });
if (stepUp) return stepUp;
---`;

const clientCode = `// In your browser app (any framework)
import { TokenForge } from '@opensyber/tokenforge/client';

const tf = new TokenForge({ apiBase: 'https://tokenforge-api.opensyber.cloud' });
await tf.bind();        // generate ECDSA P-256 keypair, register device
await tf.attach(fetch); // sign every fetch with X-TF-* headers`;

interface Step {
  framework: string;
  badge: string;
  code: string;
}

const steps: Step[] = [
  { framework: 'Hono', badge: 'Recommended', code: honoCode },
  { framework: 'Express', badge: 'Node.js', code: expressCode },
  { framework: 'Fastify', badge: 'Node.js', code: fastifyCode },
  { framework: 'Next.js', badge: 'App Router', code: nextCode },
  { framework: 'SvelteKit', badge: 'Edge', code: svelteKitCode },
  { framework: 'Astro', badge: 'Edge', code: astroCode },
];

export default function QuickstartPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <nav aria-label="Documentation navigation" className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/docs" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Docs</span>
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-info text-void px-4 py-2 text-sm font-medium glow-info hover:brightness-110 transition">
            Get Started Free
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-20 pb-24">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-5 w-5 text-info" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em]">
            5-minute quickstart
          </span>
        </div>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-4">
          From <span className="text-info">npm install</span> to bound sessions in 5 minutes.
        </h1>
        <p className="text-text-secondary mb-10 max-w-2xl">
          Pick your server framework. Add one middleware. Every request after login is now signed by the user&apos;s device — replayed cookies bounce.
        </p>

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">1. Install</h2>
          <CodeBlock code={installCode} language="bash" />
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">2. Server</h2>
          <p className="text-sm text-text-secondary mb-4">
            Drop in the adapter for your framework. <code className="text-info">requireFreshSig</code> gates routes that need elevated trust (admin, payments, role grants).
          </p>
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.framework} className="rounded-2xl bg-panel border border-border/60 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-base font-semibold">{step.framework}</h3>
                  <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-medium text-info uppercase tracking-wider">
                    {step.badge}
                  </span>
                </div>
                <CodeBlock code={step.code} language="ts" />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">3. Browser</h2>
          <p className="text-sm text-text-secondary mb-4">
            Initialize the SDK once after the user signs in. <code className="text-info">attach(fetch)</code> wraps the global fetch so every request is signed.
          </p>
          <CodeBlock code={clientCode} language="ts" />
        </section>

        <section className="mb-10 rounded-2xl border border-border/60 bg-panel p-6">
          <h2 className="text-lg font-semibold mb-3">Trust-score thresholds</h2>
          <p className="text-sm text-text-secondary mb-4">
            <code className="text-info">requireFreshSig({'{ minTrustScore: 90 }'})</code> gates against the score that <code className="text-info">tokenForgeMiddleware</code> computes per request. Use these defaults until you have data to tune them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-ok/10 border border-ok/30 p-4">
              <div className="font-[family-name:var(--font-mono)] text-[11px] text-ok uppercase tracking-[0.15em] mb-1">90–100 · ALLOW</div>
              <p className="text-text-secondary">Bound device, clean signals. Default verdict.</p>
            </div>
            <div className="rounded-lg bg-warn/10 border border-warn/30 p-4">
              <div className="font-[family-name:var(--font-mono)] text-[11px] text-warn uppercase tracking-[0.15em] mb-1">40–89 · STEP_UP</div>
              <p className="text-text-secondary">Drift detected. Sensitive routes should reject; ordinary reads can proceed.</p>
            </div>
            <div className="rounded-lg bg-alert/10 border border-alert/30 p-4">
              <div className="font-[family-name:var(--font-mono)] text-[11px] text-alert uppercase tracking-[0.15em] mb-1">0–39 · BLOCK</div>
              <p className="text-text-secondary">Multiple high-confidence anomalies — middleware returns 401 automatically.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-info/30 bg-info/5 p-6">
          <h2 className="text-lg font-semibold mb-2">Done. What you got:</h2>
          <ul className="text-sm text-text-secondary space-y-1.5 list-disc pl-5">
            <li>Every request after login carries an ECDSA P-256 signature bound to the user&apos;s device.</li>
            <li>A stolen session cookie alone is useless — without the device key, signature verification fails.</li>
            <li><code className="text-info">requireFreshSig</code> blocks admin / payment routes when the trust score drops (geo change, IP rotation, AitM signals).</li>
            <li>Trust score and AitM signals surface in <Link href="/dashboard" className="text-info hover:text-signal-hover">your dashboard</Link>.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
