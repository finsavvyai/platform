import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/opensyber-vs-modal');
export const metadata = buildCompareMetadata(pageMeta);

const rows = [
  { feature: 'Primary focus', opensyber: 'Runtime security platform for AI agents', modal: 'Agent compute and sandbox execution' },
  { feature: 'Runtime attestation feed', opensyber: 'Built-in dashboard telemetry', modal: 'Not native (requires custom wiring)' },
  { feature: 'Verified skill marketplace', opensyber: 'Security-audited + signed skills', modal: 'No marketplace layer' },
  { feature: 'Compliance evidence output', opensyber: 'SOC 2 / ISO / HIPAA evidence flows', modal: 'Infrastructure-level controls only' },
  { feature: 'Device-bound agent auth', opensyber: 'TokenForge cryptographic binding', modal: 'Not included' },
  { feature: 'Best use', opensyber: 'Secure operations and governance', modal: 'Fast execution and sandbox compute' },
];

export default function OpenSyberVsModalPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="mb-16 text-center">
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal">Comparison</p>
          <h1 className="mb-5 font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide md:text-6xl">OpenSyber vs Modal</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            Modal is a strong compute layer. OpenSyber is the security and trust layer teams add when agent workloads hit production.
          </p>
        </div>

        <div className="mb-16 gradient-border">
          <div className="overflow-x-auto rounded-2xl bg-panel p-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Feature</th>
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal">OpenSyber</th>
                  <th className="py-3 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Modal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-secondary">{row.feature}</td>
                    <td className="py-3 pr-4 text-white">{row.opensyber}</td>
                    <td className="py-3 text-text-dim">{row.modal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">Use Modal + OpenSyber Together</h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li>Keep Modal for sandbox execution and scaling.</li>
                <li>Add OpenSyber for runtime telemetry, policy controls, and security evidence.</li>
                <li>Use TokenForge for device-bound credentials across agent workflows.</li>
              </ul>
            </div>
          </div>
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">When OpenSyber Alone Fits</h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li>Security and governance are first-order requirements.</li>
                <li>You need an auditable skill supply chain, not just compute.</li>
                <li>You need one place for runtime, trust, and compliance workflows.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <TrackedCompareLink
            href="/sign-up"
            comparePage={pageMeta.href}
            ctaLabel="start-free"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void transition-all duration-300 hover:bg-signal-hover"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </TrackedCompareLink>
          <TrackedCompareLink
            href="/dashboard/security/attestation-feed"
            comparePage={pageMeta.href}
            ctaLabel="see-attestation-feed"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal transition-all duration-300 hover:border-signal/30 hover:bg-signal/5"
          >
            See Attestation Feed
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}

