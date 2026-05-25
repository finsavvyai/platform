import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { ArrowRight, Shield } from 'lucide-react';
import { features, steps, stats } from './pushci-data';

export const metadata: Metadata = {
  title: 'PushCI — Catch broken AI-generated code before production',
  description:
    'PushCI validates every AI-written PR with semantic analysis, dependency safety checks, and infrastructure drift detection. GitHub Actions in 2 minutes.',
  openGraph: {
    title: 'PushCI — Catch broken AI-generated code before production',
    description:
      'Cursor PRs, Claude-generated migrations, hallucinated infra changes — PushCI catches them before production.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

export default function PushCIPage() {
  return (
    <div className="min-h-screen bg-void text-neutral-100">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-4 py-1.5 text-xs font-semibold text-signal uppercase tracking-wider">
            Free for open source
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-6 leading-tight">
            Catch broken AI-generated code<br />
            <span className="text-signal">before production.</span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            PushCI validates every AI-written PR with semantic analysis, dependency safety checks,
            and infrastructure drift detection. Works with GitHub Actions in 2 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 rounded bg-signal px-8 py-3.5 text-base font-bold hover:bg-signal-hover transition"
            >
              Add to your repo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/blog/pushci-launch"
              className="flex items-center gap-2 rounded border border-wire bg-surface px-8 py-3.5 text-base font-semibold hover:bg-neutral-700 transition"
            >
              Read the launch post
            </Link>
          </div>
          <p className="mt-4 text-xs text-text-dim">
            Free for open source. No credit card required.
          </p>
        </section>

        {/* Stats bar */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="grid grid-cols-3 gap-4 rounded border border-border bg-panel/60 p-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-signal font-mono">{s.value}</p>
                <p className="text-xs text-text-dim mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <h2 className="text-3xl font-bold text-center mb-12">
            What PushCI catches that linters cannot
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded border border-border bg-panel/30 p-6">
                <Icon className="mb-4 h-6 w-6 text-signal" />
                <h3 className="mb-2 text-base font-semibold">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="text-3xl font-bold text-center mb-12">Up and running in 3 steps</h2>
          <div className="space-y-4">
            {steps.map(({ n, icon: Icon, text }) => (
              <div key={n} className="flex items-start gap-4 rounded border border-border bg-panel/30 p-5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-signal/20 text-sm font-bold text-signal">
                  {n}
                </span>
                <div className="flex items-center gap-3 pt-1">
                  <Icon className="h-4 w-4 text-text-dim flex-shrink-0" />
                  <p className="text-sm text-text-primary leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* YAML example */}
        <section className="mx-auto max-w-2xl px-6 pb-24">
          <div className="rounded border border-border bg-panel/60 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-panel px-4 py-2.5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-text-dim font-mono">.github/workflows/ci.yml</span>
            </div>
            <pre className="p-4 text-sm font-mono text-text-primary overflow-x-auto">
{`- name: PushCI
  uses: opensyber/pushci@v1`}
            </pre>
          </div>
          <p className="text-center text-xs text-text-dim mt-4">That is the entire setup.</p>
        </section>

        {/* Social proof + CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-32 text-center">
          <div className="rounded border border-signal/20 bg-gradient-to-br from-signal/[0.06] via-panel to-info/[0.03] p-12">
            <Shield className="mx-auto mb-6 h-12 w-12 text-signal" />
            <p className="text-sm text-text-dim mb-4 font-mono uppercase tracking-wider">
              Built by the OpenSyber team
            </p>
            <p className="text-text-secondary mb-8 max-w-md mx-auto">
              Same detection engine that monitors AI agents in production.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded bg-signal px-8 py-3.5 font-bold hover:bg-signal-hover transition"
            >
              Add to your repo — free for open source <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
