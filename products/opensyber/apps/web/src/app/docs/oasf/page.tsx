import type { Metadata } from 'next';
import Link from 'next/link';
import { OasfControls } from './OasfControls';

export const metadata: Metadata = {
  title: 'OASF — Open Agent Security Framework',
  description:
    '15 controls for AI agent governance. The open standard for securing autonomous AI agents in production environments.',
};

export default function OasfPage() {
  return (
    <div className="space-y-12">
      <header className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-6xl tracking-wide text-text-primary">
          OASF — OPEN AGENT SECURITY FRAMEWORK
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          15 controls for AI agent governance. Open standard. Version 1.0.
        </p>
      </header>

      <OasfControls />

      <div className="brand-card rounded border border-border bg-panel p-8 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-text-primary mb-3">
          ASSESS YOUR AGENTS
        </h2>
        <p className="text-text-secondary mb-6 max-w-lg mx-auto">
          Run a free OASF compliance assessment on your AI agents and get a detailed scorecard.
        </p>
        <Link
          href="/sign-up"
          className="inline-block rounded bg-signal px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-void hover:bg-signal-hover transition"
        >
          Run Assessment
        </Link>
      </div>
    </div>
  );
}
