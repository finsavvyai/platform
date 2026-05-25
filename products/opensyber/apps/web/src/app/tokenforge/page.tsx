import Link from 'next/link';
import type { Metadata } from 'next';
import { Fingerprint, Shield, Zap, Lock, RefreshCw, Eye, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'TokenForge — Device-Bound Session Security SDK',
  description: 'Cryptographic session security for web applications. ECDSA P-256 device binding, challenge-response signing, trust scoring. Prevents session hijacking and token theft.',
  keywords: ['session security', 'device binding', 'ECDSA', 'token theft prevention', 'Web Crypto API', 'TokenForge'],
};

const features = [
  { icon: Lock, title: 'DEVICE BINDING', desc: 'Non-extractable ECDSA P-256 keypairs. Stolen tokens are worthless without the hardware.' },
  { icon: RefreshCw, title: 'CHALLENGE-RESPONSE', desc: 'Every request is signed. Replay attacks are mathematically impossible.' },
  { icon: Eye, title: 'TRUST SCORING', desc: '7 weighted signals: device fingerprint, IP consistency, session age, behavior analysis.' },
  { icon: Shield, title: 'STEP-UP AUTH', desc: 'Automatic re-authentication when anomalies detected. Zero user friction when clean.' },
  { icon: Zap, title: 'ZERO DEPENDENCIES', desc: 'Built on Web Crypto API. No external libraries. Works in every modern browser.' },
  { icon: Fingerprint, title: 'FRAMEWORK AGNOSTIC', desc: 'Adapters for Hono, Express, Next.js. Server SDK is framework-independent.' },
];

export default function TokenForgePage() {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <div className="pt-36 pb-20">
        <div className="mx-auto max-w-5xl px-6">
          {/* Hero */}
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 flex items-center gap-3">
            <span className="block w-8 h-px bg-info" />Session Security SDK
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">
            TOKEN<span className="text-info">FORGE</span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mb-6">
            Cryptographic device binding for web sessions. Stolen tokens become worthless.
          </p>
          <p className="text-text-dim max-w-2xl mb-10 leading-relaxed">
            TokenForge binds every session to the user&apos;s device using ECDSA P-256 keypairs
            generated in the Web Crypto API. Private keys never leave the browser. Every request
            is challenge-response signed. Session hijacking becomes a solved problem.
          </p>

          {/* CTA */}
          <div className="flex gap-4 mb-20">
            <Link href="/docs/security" className="rounded-lg bg-signal text-void px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300 inline-flex items-center gap-2">
              Read the Docs <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sign-up" className="rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-info hover:border-info/30 hover:bg-info/5 transition-all duration-300">
              Try It Free
            </Link>
          </div>

          {/* Features */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-20">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="gradient-border card-hover">
                  <div className="rounded-2xl bg-panel p-8">
                    <div className="h-11 w-11 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-info" />
                    </div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg tracking-wider mb-2">{f.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Code example */}
          <div className="gradient-border mb-20">
            <div className="rounded-2xl bg-panel overflow-hidden">
              <div className="bg-surface border-b border-border/50 px-4 py-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-alert" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn" />
                <span className="h-2.5 w-2.5 rounded-full bg-ok" />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim ml-2">tokenforge-example.ts</span>
              </div>
              <pre className="p-6 font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.8] overflow-x-auto">
                <code>
                  <span className="text-text-dim">{'// Server: verify device-bound session'}</span>{'\n'}
                  <span className="text-signal">import</span>{' { verifySession } '}<span className="text-signal">from</span>{' '}<span className="text-warn">&apos;@opensyber/tokenforge&apos;</span>{'\n\n'}
                  <span className="text-signal">const</span>{' result = '}<span className="text-signal">await</span>{' verifySession(request, {\n'}
                  {'  '}<span className="text-text-primary">trustThreshold</span>{': '}<span className="text-info">0.7</span>{',\n'}
                  {'  '}<span className="text-text-primary">stepUpOnAnomaly</span>{': '}<span className="text-signal">true</span>{',\n'}
                  {'  '}<span className="text-text-primary">maxSessionAge</span>{': '}<span className="text-warn">&apos;24h&apos;</span>{',\n'}
                  {'});\n\n'}
                  <span className="text-text-dim">{'// result.trustScore: 0.92'}</span>{'\n'}
                  <span className="text-text-dim">{'// result.deviceBound: true'}</span>{'\n'}
                  <span className="text-text-dim">{'// result.verified: true'}</span>
                </code>
              </pre>
            </div>
          </div>

          {/* Who uses it */}
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim uppercase tracking-[0.2em] mb-2">
              Built into OpenSyber. Available as standalone SDK.
            </p>
            <Link href="/docs/security" className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-wider hover:text-info/80 transition">
              View full documentation →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
