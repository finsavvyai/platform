import { breachStats } from './plans';

export function PricingHero() {
  return (
    <div className="text-center mb-20">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
        Pricing
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl lg:text-7xl tracking-wide mb-4 leading-[0.95] max-w-4xl mx-auto">
        A BREACH COSTS<br />
        <span className="text-gradient">$4.88 MILLION.</span>
      </h1>
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-4xl tracking-wide mb-5 text-text-secondary">
        OPENSYBER STARTS AT $0.
      </h2>
      <p className="text-xl text-text-primary font-medium max-w-2xl mx-auto">
        Save 40+ hours/month on manual triage. Catch supply-chain attacks in 340ms. Pay $299/mo instead of $4.88M.
      </p>
      <p className="mt-3 text-sm text-text-secondary">
        I&apos;m not going to tell you what to do. But the math is right there. Just... sitting there. Looking at you.
      </p>
    </div>
  );
}

export function StatsBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 max-w-4xl mx-auto">
      {breachStats.map((stat) => (
        <div
          key={stat.label}
          className="gradient-border"
        >
          <div className="rounded-2xl bg-panel p-6 text-center">
            <p className="font-[family-name:var(--font-display)] text-3xl md:text-4xl text-gradient">
              {stat.value}
            </p>
            <p className="text-xs text-text-secondary mt-2">
              {stat.label}
              {stat.source && (
                <span className="text-text-muted"> ({stat.source})</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
