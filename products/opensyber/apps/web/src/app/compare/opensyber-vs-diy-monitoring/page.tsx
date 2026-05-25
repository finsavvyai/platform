import { SiteHeader } from '@/components/SiteHeader';
import { ArrowRight } from 'lucide-react';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/opensyber-vs-diy-monitoring');
export const metadata = buildCompareMetadata(pageMeta);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'OpenSyber vs DIY Monitoring (Datadog + Sentry + Custom Scripts)',
  author: { '@type': 'Organization', name: 'OpenSyber' },
  datePublished: '2026-04-01',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
  description: pageMeta.metaDescription,
};

const rows = [
  { feature: 'Anomaly detection speed', opensyber: '340ms behavioral detection', diy: 'Days/weeks (manual threshold tuning)' },
  { feature: 'Monitoring scope', opensyber: 'Agent-specific behavioral baselines', diy: 'Infrastructure metrics only (CPU, memory, errors)' },
  { feature: 'Credential security', opensyber: 'Vaulted with skill-level access control', diy: 'All-or-nothing environment variables' },
  { feature: 'Supply chain scanning', opensyber: 'Real-time dependency analysis', diy: 'npm audit (misses 40% of threats)' },
  { feature: 'Setup time', opensyber: '60 seconds', diy: '4-8 hours minimum' },
  { feature: 'Monthly cost', opensyber: 'Free - $49/mo', diy: '$200+/mo (Datadog + Sentry + infra)' },
  { feature: 'AI agent context', opensyber: 'Understands skills, runs, and tool calls', diy: 'Generic APM with no agent awareness' },
  { feature: 'Compliance dashboards', opensyber: 'SOC 2, NIST AI RMF built-in', diy: 'Build your own or buy separately' },
];

export default function OpenSyberVsDiyPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Comparison
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            OpenSyber vs DIY Monitoring
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Datadog + Sentry + custom scripts were built for web apps, not autonomous AI agents.
            Here is how purpose-built agent security compares to stitching it together yourself.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mb-20 gradient-border">
          <div className="rounded-2xl bg-panel p-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim text-left py-3 pr-4">Feature</th>
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal text-left py-3 pr-4">OpenSyber</th>
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim text-left py-3">DIY Stack</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 text-text-secondary font-medium">{r.feature}</td>
                    <td className="py-3 pr-4 text-white">{r.opensyber}</td>
                    <td className="py-3 text-text-dim">{r.diy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* When to use sections */}
        <div className="grid md:grid-cols-2 gap-6 mb-20">
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide mb-4">
                When to Use OpenSyber
              </h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li><strong className="text-white">You run AI agents in production</strong> and need behavioral anomaly detection, not just uptime checks.</li>
                <li><strong className="text-white">Your agents handle credentials</strong> and you need skill-level vault access instead of shared env vars.</li>
                <li><strong className="text-white">You need compliance</strong> dashboards (SOC 2, NIST AI RMF) without building them from scratch.</li>
                <li><strong className="text-white">Your team is small</strong> and you cannot dedicate 4-8 hours per agent to monitoring setup.</li>
                <li><strong className="text-white">You install community skills</strong> and need supply chain scanning that catches what npm audit misses.</li>
              </ul>
            </div>
          </div>

          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide mb-4">
                When DIY Makes Sense
              </h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li><strong className="text-white">You already run Datadog/Sentry</strong> at scale and have a dedicated platform team to build agent-specific integrations.</li>
                <li><strong className="text-white">Your agents are stateless workers</strong> with no credential access and no skill marketplace dependencies.</li>
                <li><strong className="text-white">You need custom anomaly models</strong> trained on proprietary data that no third-party platform can replicate.</li>
                <li><strong className="text-white">Regulatory requirements mandate</strong> on-premise monitoring with no external SaaS dependencies.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <TrackedCompareLink
            href="/sign-up"
            comparePage={pageMeta.href}
            ctaLabel="start-free"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </TrackedCompareLink>
          <TrackedCompareLink
            href="/enterprise"
            comparePage={pageMeta.href}
            ctaLabel="contact-sales"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            Contact Sales
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}
