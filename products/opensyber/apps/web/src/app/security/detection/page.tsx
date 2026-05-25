import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { ArrowRight, ShieldAlert, Gauge, Clock } from 'lucide-react';
import { layers, egressTechniques, latencyStats, falsePositiveRate } from './data';

export const metadata: Metadata = {
  title: 'How Detection Works | OpenSyber',
  description:
    'Five layers of defense from regex to behavioral anomaly — how OpenSyber detects prompt injection, exfiltration, and agent attacks.',
  openGraph: {
    title: 'How Detection Works | OpenSyber',
    description: 'Five layers of defense, from regex to behavioral anomaly.',
    type: 'website',
  },
};

export default function DetectionPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Detection Architecture
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            How Detection Works
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Five layers of defense, from regex to behavioral anomaly.
          </p>
        </div>

        {/* 5-Layer Model */}
        <SectionHeading tag="Defense in Depth" title="5-Layer Detection Model" />
        <div className="space-y-4 mb-20">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <div key={layer.number} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-7">
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-signal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">
                          Layer {layer.number}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] text-signal/70">
                          {layer.latency}
                        </span>
                      </div>
                      <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-white mb-2">
                        {layer.name}
                      </h3>
                      <p className="text-sm text-text-secondary">{layer.detail}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Egress Detection Techniques */}
        <SectionHeading tag="Exfiltration Defense" title="Egress Detection Techniques" />
        <div className="grid md:grid-cols-2 gap-4 mb-20">
          {egressTechniques.map((tech) => {
            const Icon = tech.icon;
            return (
              <div key={tech.name} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-7">
                  <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-signal" />
                  </div>
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-1">
                    {tech.name}
                  </h3>
                  <p className="text-sm text-text-secondary">{tech.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* False Positive Rate + Latency */}
        <div className="grid md:grid-cols-2 gap-4 mb-20">
          <StatCard
            icon={<Gauge className="h-5 w-5 text-signal" />}
            tag="Precision"
            title="False Positive Rate"
            body={falsePositiveRate}
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-signal" />}
            tag="Speed"
            title="Detection Latency"
            body={`p50: ${latencyStats.p50} | p95: ${latencyStats.p95} | p99: ${latencyStats.p99}. ${latencyStats.layerBreakdown}`}
          />
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/security/atlas"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            ATLAS Coverage <ShieldAlert className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Reusable section heading. */
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

/** Stats card used for FP rate and latency. */
function StatCard({ icon, tag, title, body }: { icon: React.ReactNode; tag: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-7">
      <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim mb-1">{tag}</p>
      <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-white mb-2">{title}</h3>
      <p className="text-sm text-text-secondary">{body}</p>
    </div>
  );
}
