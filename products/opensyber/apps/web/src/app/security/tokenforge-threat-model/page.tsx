import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Shield, AlertTriangle, CheckCircle, Lock, Key } from 'lucide-react';
import {
  stoppedAttacks, unstoppedAttacks, assumptions,
  standards, keyStorage, integrationCode,
} from './data';

export const metadata: Metadata = {
  title: 'TokenForge Threat Model | OpenSyber',
  description:
    'What TokenForge stops, what it does not, and the assumptions it relies on. Honest, specific, and matched to the real implementation.',
  openGraph: {
    title: 'TokenForge Threat Model | OpenSyber',
    description: 'A transparent threat model for device-bound session security.',
    type: 'website',
  },
};

export default function TokenForgeThreatModelPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Security Transparency
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            TokenForge Threat Model
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            What we stop, what we don&apos;t, and the assumptions we rely on.
          </p>
        </div>

        {/* Section 1: What TokenForge Stops */}
        <SectionTag icon={Shield} label="What TokenForge Stops" />
        <DataTable
          headers={['Attack', 'How We Stop It', 'Confidence']}
          rows={stoppedAttacks.map((a) => [a.attack, a.how, a.confidence])}
          badgeCol={2}
          badgeClass={{ High: 'bg-ok/15 text-ok border-ok/30', Medium: 'bg-warn/15 text-warn border-warn/30' }}
        />

        {/* Section 2: What TokenForge Does NOT Stop */}
        <SectionTag icon={AlertTriangle} label="What TokenForge Does NOT Stop" />
        <DataTable
          headers={['Attack', 'Why', 'Mitigation']}
          rows={unstoppedAttacks.map((a) => [a.attack, a.why, a.mitigation])}
        />

        {/* Section 3: Assumptions */}
        <SectionTag icon={CheckCircle} label="Assumptions" />
        <ul className="list-disc pl-6 mb-16 space-y-2 text-sm text-text-secondary leading-relaxed">
          {assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>

        {/* Section 4: Standards Alignment */}
        <SectionTag icon={Lock} label="Standards Alignment" />
        <DataTable
          headers={['Standard', 'Status', 'Details']}
          rows={standards.map((s) => [s.standard, s.status, s.details])}
          badgeCol={1}
          badgeClass={{
            Compliant: 'bg-ok/15 text-ok border-ok/30',
            Aligned: 'bg-info/15 text-info border-info/30',
            'Primitives built': 'bg-warn/15 text-warn border-warn/30',
            'Not implemented': 'bg-text-dim/15 text-text-dim border-text-dim/30',
          }}
        />

        {/* Section 5: Key Storage by Platform */}
        <SectionTag icon={Key} label="Key Storage by Platform" />
        <DataTable
          headers={['Platform', 'Storage', 'Hardware-backed?']}
          rows={keyStorage.map((k) => [k.platform, k.storage, k.hardwareBacked])}
        />

        {/* Section 6: Integration Example */}
        <SectionTag icon={Shield} label="Integration Example" />
        <div className="rounded-2xl border border-border bg-panel overflow-hidden mb-6">
          <div className="bg-surface border-b border-border/50 px-4 py-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-alert" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim ml-2">
              middleware.ts
            </span>
          </div>
          <pre className="p-6 font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.8] overflow-x-auto text-text-secondary">
            <code>{integrationCode}</code>
          </pre>
        </div>
        <p className="text-sm text-text-dim mb-16">
          5-10 lines of code to integrate. No certificate management. No TLS configuration.
        </p>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            Read the Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionTag({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Icon className="h-4 w-4 text-signal" />
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl uppercase tracking-wide">
        {label}
      </h2>
    </div>
  );
}

function DataTable({
  headers, rows, badgeCol, badgeClass,
}: {
  headers: string[];
  rows: string[][];
  badgeCol?: number;
  badgeClass?: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel overflow-hidden mb-16">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {headers.map((h) => (
                <th key={h} className="px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-b border-border/50 last:border-b-0 hover:bg-surface/30 transition-colors">
                {row.map((cell, i) => (
                  <td key={i} className="px-5 py-4 text-text-secondary">
                    {badgeCol === i && badgeClass?.[cell] ? (
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider ${badgeClass[cell]}`}>
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
