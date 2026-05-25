import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Shield, ArrowRight } from 'lucide-react';
import { atlasTactics, owaspLlmTop10, computeStats } from './data';
import type { CoverageLevel } from './data';

export const metadata: Metadata = {
  title: 'MITRE ATLAS Coverage Matrix | OpenSyber',
  description:
    'How OpenSyber maps detection coverage to MITRE ATLAS for AI systems and the OWASP LLM Top 10 2025.',
  openGraph: {
    title: 'MITRE ATLAS Coverage Matrix | OpenSyber',
    description: 'OpenSyber detection coverage mapped to the adversarial threat landscape for AI systems.',
    type: 'website',
  },
};

const badgeClass: Record<CoverageLevel, string> = {
  Full: 'bg-ok/15 text-ok border-ok/30',
  Partial: 'bg-warn/15 text-warn border-warn/30',
  Roadmap: 'bg-text-dim/15 text-text-dim border-text-dim/30',
};

/** Inline badge for coverage level. */
function CoverageBadge({ level }: { level: CoverageLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider ${badgeClass[level]}`}
    >
      {level}
    </span>
  );
}

export default function AtlasPage() {
  const stats = computeStats();

  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Detection Coverage
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            MITRE ATLAS Coverage
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            How OpenSyber maps to the adversarial threat landscape for AI systems.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { label: 'Techniques Tracked', value: stats.total, color: 'text-white' },
            { label: 'Full Coverage', value: stats.full, color: 'text-ok' },
            { label: 'Partial Coverage', value: stats.partial, color: 'text-warn' },
            { label: 'Roadmap', value: stats.roadmap, color: 'text-text-dim' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-panel p-6 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-secondary mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ATLAS coverage table */}
        <SectionHeading tag="MITRE ATLAS" title="Technique Coverage" />
        <div className="overflow-x-auto mb-16">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-secondary">
                <th className="py-3 pr-4">Tactic</th>
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Technique</th>
                <th className="py-3 pr-4">Coverage</th>
                <th className="py-3">How We Detect</th>
              </tr>
            </thead>
            <tbody>
              {atlasTactics.flatMap((tactic) =>
                tactic.techniques.map((tech, idx) => (
                  <tr key={tech.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-text-secondary whitespace-nowrap">
                      {idx === 0 ? tactic.tactic : ''}
                    </td>
                    <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-[11px] text-text-dim whitespace-nowrap">
                      {tech.id}
                    </td>
                    <td className="py-3 pr-4 text-white">{tech.name}</td>
                    <td className="py-3 pr-4"><CoverageBadge level={tech.coverage} /></td>
                    <td className="py-3 text-text-secondary">{tech.how}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>

        {/* OWASP LLM Top 10 */}
        <SectionHeading tag="OWASP LLM Top 10 2025" title="LLM Risk Coverage" />
        <div className="overflow-x-auto mb-16">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-secondary">
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Risk</th>
                <th className="py-3 pr-4">Coverage</th>
                <th className="py-3">How We Detect</th>
              </tr>
            </thead>
            <tbody>
              {owaspLlmTop10.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-[11px] text-text-dim">{entry.id}</td>
                  <td className="py-3 pr-4 text-white">{entry.name}</td>
                  <td className="py-3 pr-4"><CoverageBadge level={entry.coverage} /></td>
                  <td className="py-3 text-text-secondary">{entry.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Get Protected <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/security/detection"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            How Detection Works <Shield className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Reusable section heading with tag + title. */
function SectionHeading({ tag, title }: { tag: string; title: string }) {
  return (
    <>
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
        {tag}
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
        {title}
      </h2>
    </>
  );
}
