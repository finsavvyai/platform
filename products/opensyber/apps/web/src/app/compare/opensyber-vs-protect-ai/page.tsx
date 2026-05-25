import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/opensyber-vs-protect-ai');
export const metadata = buildCompareMetadata(pageMeta);

const rows = [
  { feature: 'Go-to-market', opensyber: 'Self-serve PLG and transparent pricing', protectAi: 'Enterprise-led, demo-first buying motion' },
  { feature: 'Time to first protected agent', opensyber: '<60 seconds', protectAi: 'Longer onboarding and procurement cycles' },
  { feature: 'Runtime-first UX', opensyber: 'Live operational dashboard for teams', protectAi: 'Security program and governance heavy' },
  { feature: 'Skill ecosystem', opensyber: 'Verified marketplace with trust metadata', protectAi: 'No equivalent first-party skill marketplace' },
  { feature: 'Developer workflow fit', opensyber: 'Built for builder teams and coding agents', protectAi: 'Security leadership / enterprise posture focus' },
  { feature: 'Best fit', opensyber: 'Fast-moving product teams', protectAi: 'Large org strategic security programs' },
];

export default function OpenSyberVsProtectAiPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="mb-16 text-center">
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal">Comparison</p>
          <h1 className="mb-5 font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide md:text-6xl">OpenSyber vs Protect AI</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            Protect AI is positioned for enterprise procurement cycles. OpenSyber is built for developers who need secured agents running this week.
          </p>
        </div>

        <div className="mb-16 gradient-border">
          <div className="overflow-x-auto rounded-2xl bg-panel p-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Feature</th>
                  <th className="py-3 pr-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal">OpenSyber</th>
                  <th className="py-3 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim">Protect AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-secondary">{row.feature}</td>
                    <td className="py-3 pr-4 text-white">{row.opensyber}</td>
                    <td className="py-3 text-text-dim">{row.protectAi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-panel/40 p-8">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">Choose OpenSyber If</h2>
            <ul className="space-y-3 text-sm text-text-secondary">
              <li>You need production security telemetry tied to real agent operations.</li>
              <li>You want self-serve onboarding and transparent pricing.</li>
              <li>You need runtime, marketplace, and trust controls in one workflow.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-panel/40 p-8">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide">Choose Protect AI If</h2>
            <ul className="space-y-3 text-sm text-text-secondary">
              <li>Your purchasing path is enterprise security committee first.</li>
              <li>You are optimizing for long-cycle strategic vendor consolidation.</li>
              <li>You can defer developer-first deployment speed.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <TrackedCompareLink
            href="/sign-up"
            comparePage={pageMeta.href}
            ctaLabel="start-in-60-seconds"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void transition-all duration-300 hover:bg-signal-hover"
          >
            Start in 60 Seconds <ArrowRight className="h-4 w-4" />
          </TrackedCompareLink>
          <TrackedCompareLink
            href="/enterprise"
            comparePage={pageMeta.href}
            ctaLabel="talk-to-team"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal transition-all duration-300 hover:border-signal/30 hover:bg-signal/5"
          >
            Talk to Team
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}

