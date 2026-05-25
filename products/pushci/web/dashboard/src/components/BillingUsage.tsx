interface BillingUsageProps {
  aiUsage: number;
  aiLimit: number;
}

export default function BillingUsage({ aiUsage, aiLimit }: BillingUsageProps) {
  const pct = aiLimit > 0 ? Math.min(100, (aiUsage / aiLimit) * 100) : 0;
  const isHigh = pct > 80;
  const isEmpty = aiLimit === 0;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">AI Usage This Month</h2>
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-zinc-300">AI Diagnoses</span>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${isHigh ? 'text-amber-400' : isEmpty ? 'text-zinc-600' : 'text-white'}`}>
            {isEmpty ? 'Upgrade for AI' : `${aiUsage} / ${aiLimit}`}
          </span>
        </div>
        <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isEmpty ? 'w-0'
              : isHigh ? 'bg-gradient-to-r from-amber-500 to-red-500'
              : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isEmpty && (
          <p className="mt-3 text-xs text-zinc-600">
            AI diagnosis available on Pro and Team plans.
          </p>
        )}
        {isHigh && !isEmpty && (
          <p className="mt-3 text-xs text-amber-500/80">
            {Math.round(100 - pct)}% remaining — consider upgrading to Team.
          </p>
        )}
      </div>
    </section>
  );
}
