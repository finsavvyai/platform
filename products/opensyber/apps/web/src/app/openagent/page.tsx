import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import {
  Shield, Terminal, FileWarning, Eye, Download,
  AlertTriangle, CheckCircle, Key, ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'OpenAgent — AI Agent Activity Monitor | OpenSyber',
  description:
    'See exactly what Cursor, Cline, Claude Code, and GitHub Copilot do to your filesystem and terminal in real time. Free VS Code extension.',
  openGraph: {
    title: 'OpenAgent — AI Agent Activity Monitor',
    description: 'Your AI coding agent is reading secrets and running sudo commands. Now you can see it.',
    images: [{ url: '/og-openagent.png', width: 1200, height: 630 }],
  },
};

// Direct .vsix download until the extension is published to VS Marketplace
const INSTALL_URL = '/openagent/install';

const RISK_EXAMPLES = [
  { risk: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Key,          label: 'file_read',  text: 'Read: /project/.env' },
  { risk: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: Key,          label: 'file_read',  text: 'Read: ~/.aws/credentials' },
  { risk: 'HIGH',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: Terminal, label: 'bash_exec', text: 'sudo apt-get install nginx' },
  { risk: 'HIGH',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: Terminal, label: 'bash_exec', text: 'aws iam list-users' },
  { risk: 'MEDIUM',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: FileWarning, label: 'file_read', text: 'Read: /project/package.json' },
];

const FEATURES = [
  {
    icon: Eye,
    title: 'Real-time file monitoring',
    body: 'Every file your agent opens, classified as CRITICAL, HIGH, MEDIUM, or LOW — instantly.',
  },
  {
    icon: Terminal,
    title: 'Terminal command interception',
    body: 'Catches curl | bash, cat .env, printenv, sudo, aws iam, kubectl exec before you blink.',
  },
  {
    icon: Key,
    title: 'Secret pattern detection',
    body: 'Counts AWS keys, GitHub tokens, OpenAI keys, and private key blocks. Values are never logged.',
  },
  {
    icon: Shield,
    title: 'Security risk score',
    body: '0–100 score per session. Shareable scorecard image for LinkedIn, X, Reddit, and Facebook.',
  },
  {
    icon: AlertTriangle,
    title: 'Critical event notifications',
    body: 'Instant VS Code notification when your agent touches credentials or runs remote code execution.',
  },
  {
    icon: CheckCircle,
    title: 'Fully offline',
    body: 'All data stays in ~/.opensyber/activity.jsonl. Zero telemetry. Cloud sync is opt-in only.',
  },
];

export default function OpenAgentPage() {
  return (
    <div className="min-h-screen bg-void text-neutral-100">
      <SiteHeader />
      <main>
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-info/30 bg-signal/10 px-4 py-1.5 text-xs font-semibold text-signal uppercase tracking-wider">
          Free VS Code Extension
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-6 leading-tight">
          Your AI agent is reading<br />
          <span className="text-red-400">your secrets.</span>
        </h1>
        <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Cursor, Cline, Claude Code, GitHub Copilot — they run autonomously.
          OpenAgent shows you every file they read, every command they run, every secret they touch.
          In real time.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href={INSTALL_URL}
            className="flex items-center gap-2 rounded bg-signal px-8 py-3.5 text-base font-bold hover:bg-signal-hover transition"
          >
            <Download className="h-5 w-5" />
            Install Free — VS Code
          </a>
          <Link
            href="/sign-up"
            className="flex items-center gap-2 rounded border border-wire bg-surface px-8 py-3.5 text-base font-semibold hover:bg-neutral-700 transition"
          >
            Get team visibility <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-dim">No account required · Works with all AI coding agents · macOS, Linux, Windows</p>
      </section>

      {/* Live activity demo */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <div className="rounded border border-border bg-panel/60 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-panel px-4 py-2.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-text-dim font-mono">OpenAgent — Activity Monitor</span>
          </div>
          <div className="p-4 space-y-2 font-mono text-sm">
            {RISK_EXAMPLES.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${e.color} w-20 text-center flex-shrink-0`}>
                  {e.risk}
                </span>
                <span className="text-text-dim text-xs w-20 flex-shrink-0">{e.label}</span>
                <span className="text-text-primary truncate">{e.text}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center gap-4 text-xs">
              <span className="text-red-400 font-bold">2 critical</span>
              <span className="text-orange-400 font-bold">2 high</span>
              <span className="text-amber-400">1 medium</span>
              <span className="ml-auto text-text-dim">score: 44/100</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">Everything your agent does. Nothing hidden.</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded border border-border bg-panel/30 p-6">
              <Icon className="mb-4 h-6 w-6 text-signal" />
              <h3 className="mb-2 text-base font-semibold">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install steps */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">Up in 60 seconds</h2>
        <div className="space-y-4">
          {[
            { n: '1', text: 'Download the free .vsix — click Install Free above, then follow the 30-second setup guide' },
            { n: '2', text: 'Open any project — the OpenAgent panel appears in the sidebar automatically' },
            { n: '3', text: 'Use Cursor, Cline, or any AI coding assistant as normal' },
            { n: '4', text: 'Watch activity appear in real time. Click View Report → for a full audit' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-start gap-4 rounded border border-border bg-panel/30 p-5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-signal/20 text-sm font-bold text-signal">
                {n}
              </span>
              <p className="text-sm text-text-primary leading-relaxed pt-1">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-32 text-center">
        <div className="rounded border border-info/20 bg-gradient-to-br from-info/60 to-neutral-900 p-12">
          <Shield className="mx-auto mb-6 h-12 w-12 text-signal" />
          <h2 className="text-3xl font-bold mb-4">Start monitoring in 60 seconds</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Free forever for individuals. Team-wide visibility, Slack alerts, and compliance export with OpenSyber Pro.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={INSTALL_URL}
              className="flex items-center gap-2 rounded bg-signal px-8 py-3.5 font-bold hover:bg-signal-hover transition"
            >
              <Download className="h-5 w-5" />
              Install Free Extension
            </a>
            <Link
              href="/pricing"
              className="flex items-center gap-2 rounded border border-wire bg-surface px-8 py-3.5 font-semibold hover:bg-neutral-700 transition"
            >
              View Pro plans
            </Link>
          </div>
          <p className="mt-6 text-xs text-text-dim">
            Need team-wide visibility? <Link href="/sign-up" className="text-signal hover:underline">Start a free trial →</Link>
          </p>
        </div>
      </section>
      </main>
    </div>
  );
}
