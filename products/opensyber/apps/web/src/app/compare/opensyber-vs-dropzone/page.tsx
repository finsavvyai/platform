import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/opensyber-vs-dropzone');
export const metadata = buildCompareMetadata(pageMeta);

const rows = [
  { feature: 'Pricing', opensyber: '$99–$1,999/mo, transparent, self-serve', dropzone: '$50K+ ACV, sales call required' },
  { feature: 'Deploy time', opensyber: '60 seconds, self-serve signup', dropzone: '4–8 week implementation engagement' },
  { feature: 'AI agents', opensyber: 'Marketplace + bring-your-own + 6 built-in', dropzone: 'Single closed proprietary analyst' },
  { feature: 'Skill ecosystem', opensyber: 'Open marketplace with 70/30 publisher split', dropzone: 'No marketplace (closed platform)' },
  { feature: 'Session security', opensyber: 'TokenForge device-bound ECDSA P-256 keys', dropzone: 'Standard OAuth bearer tokens' },
  { feature: 'Self-host / BYO cloud', opensyber: 'Roadmapped (Q3 2026)', dropzone: 'SaaS only — no on-prem option' },
  { feature: 'CSPM / cloud posture', opensyber: 'Built-in (Prowler integration)', dropzone: 'Out of scope' },
  { feature: 'PipeWarden CI/CD scanning', opensyber: 'Native pipeline finding ingestion', dropzone: 'Not available' },
  { feature: 'Customization', opensyber: 'Build/install skills via SDK', dropzone: 'Locked to vendor roadmap' },
  { feature: 'Time to first triage', opensyber: 'Same day', dropzone: '4–8 weeks post-contract' },
  { feature: 'Multi-cloud CSPM', opensyber: 'AWS / Azure / GCP via Prowler', dropzone: 'Not applicable' },
  { feature: 'Developer experience', opensyber: 'TypeScript SDK, OpenAPI, MCP server', dropzone: 'Web UI + REST API' },
];

const dropzoneWins = [
  'Proven enterprise outcomes — 100+ deployments including CBTS, UiPath, Zapier',
  'SOC 2 Type II and ISO 27001 certifications (OpenSyber: SOC 2 in progress)',
  '30+ native integrations to SIEMs, EDRs, and identity providers',
  '$57M Series B funding (Theory Ventures, Madrona, IQT)',
];

const opensyberWins = [
  '10x cheaper entry point — $99/mo vs $50K+ ACV',
  '60-second self-serve deploy — no sales engagement required',
  'Open skill marketplace — install or publish runtime modules',
  'Device-bound sessions — stolen tokens are useless without the original hardware key',
  'Combined CSPM + agents + compliance in one platform',
];

export default function OpenSyberVsDropzonePage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="mb-16 text-center">
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal">Comparison</p>
          <h1 className="mb-5 font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide md:text-6xl">OpenSyber vs Dropzone AI</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            Dropzone built a great AI analyst for Fortune 1000. OpenSyber is the AI security platform for everyone else — and you own the agents.
          </p>
        </div>

        <div className="mb-16 gradient-border">
          <div className="overflow-x-auto rounded-2xl bg-panel p-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Feature</th>
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal">OpenSyber</th>
                  <th className="py-3 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Dropzone AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-secondary">{row.feature}</td>
                    <td className="py-3 pr-4 text-white">{row.opensyber}</td>
                    <td className="py-3 text-text-dim">{row.dropzone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">When OpenSyber Fits</h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                {opensyberWins.map((win) => <li key={win}>• {win}</li>)}
              </ul>
            </div>
          </div>
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">When Dropzone Fits</h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                {dropzoneWins.map((win) => <li key={win}>• {win}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-16 rounded-2xl border border-border/50 bg-panel/40 p-8">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">Honest summary</h2>
          <p className="text-sm text-text-secondary">
            Pick Dropzone when you have a six-figure budget, a regulated enterprise footprint, and want a proven closed analyst running on day one. Pick OpenSyber when you need a self-serve AI security platform that you can extend, deploy in minutes, and run for less than the cost of one Dropzone implementation week.
          </p>
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
            href="/marketplace"
            comparePage={pageMeta.href}
            ctaLabel="browse-marketplace"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal transition-all duration-300 hover:border-signal/30 hover:bg-signal/5"
          >
            Browse Marketplace
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}
