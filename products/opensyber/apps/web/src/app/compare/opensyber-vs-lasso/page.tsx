import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/opensyber-vs-lasso');
export const metadata = buildCompareMetadata(pageMeta);

const rows = [
  { feature: 'Security surface', opensyber: 'Runtime + marketplace + identity + compliance', lasso: 'MCP gateway and tool access controls' },
  { feature: 'Runtime telemetry', opensyber: 'Live event feed and behavioral monitoring', lasso: 'Limited runtime observability context' },
  { feature: 'Skill trust chain', opensyber: 'Signed skills + SBOM + verification metadata', lasso: 'Gateway policy enforcement' },
  { feature: 'Hosted runtime', opensyber: 'Managed secure runtime workflow', lasso: 'No first-party managed runtime layer' },
  { feature: 'Device-bound auth', opensyber: 'TokenForge-integrated', lasso: 'Not core offering' },
  { feature: 'Ideal buyer', opensyber: 'Teams shipping production AI agents', lasso: 'Teams prioritizing MCP gateway control plane' },
];

export default function OpenSyberVsLassoPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="mb-16 text-center">
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal">Comparison</p>
          <h1 className="mb-5 font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide md:text-6xl">OpenSyber vs Lasso</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            Lasso secures MCP access paths. OpenSyber secures the full production lifecycle: runtime, skills, telemetry, and compliance evidence.
          </p>
        </div>

        <div className="mb-16 gradient-border">
          <div className="overflow-x-auto rounded-2xl bg-panel p-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Feature</th>
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal">OpenSyber</th>
                  <th className="py-3 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Lasso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-secondary">{row.feature}</td>
                    <td className="py-3 pr-4 text-white">{row.opensyber}</td>
                    <td className="py-3 text-text-dim">{row.lasso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16 rounded-2xl border border-border bg-panel/40 p-8">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">Where OpenSyber Pulls Ahead</h2>
          <ul className="space-y-3 text-sm text-text-secondary">
            <li>Production runtime monitoring is native, not stitched from logs and proxy controls.</li>
            <li>Marketplace trust is auditable end-to-end with signed artifacts and security metadata.</li>
            <li>Agent identity is cryptographically bound to device/session context via TokenForge.</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-4">
          <TrackedCompareLink
            href="/sign-up"
            comparePage={pageMeta.href}
            ctaLabel="deploy-secure-agent"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void transition-all duration-300 hover:bg-signal-hover"
          >
            Deploy Secure Agent <ArrowRight className="h-4 w-4" />
          </TrackedCompareLink>
          <TrackedCompareLink
            href="/marketplace"
            comparePage={pageMeta.href}
            ctaLabel="explore-verified-skills"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal transition-all duration-300 hover:border-signal/30 hover:bg-signal/5"
          >
            Explore Verified Skills
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}

