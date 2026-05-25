import ShareButton from './ShareButton';

const RUNS = 1247;
const AVG_DURATION_MIN = 0.63; // ~38s
const GH_RATE = 0.008; // $/min

const ghCost = Math.round(RUNS * AVG_DURATION_MIN * GH_RATE * 100) / 100;
const pushciCost = 0;
const saved = ghCost;

function CostBar({ label, cost, max, color }: {
  label: string; cost: number; max: number; color: string;
}) {
  const pct = max > 0 ? (cost / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-28 text-right">{label}</span>
      <div className="flex-1 h-6 bg-zinc-800 rounded-lg overflow-hidden relative">
        <div className={`h-full rounded-lg ${color} transition-all`}
          style={{ width: `${Math.max(pct, 2)}%` }} />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-zinc-200">
          ${cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function CostSavings() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-1">Cost Savings</h3>
      <p className="text-xs text-zinc-500 mb-4">This month vs GitHub Actions pricing</p>

      <div className="text-center mb-5">
        <span className="text-3xl font-bold text-emerald-400">${saved.toFixed(2)}</span>
        <span className="text-sm text-zinc-400 ml-2">saved this month</span>
      </div>

      <div className="space-y-3">
        <CostBar label="GitHub Actions" cost={ghCost} max={ghCost} color="bg-zinc-500" />
        <CostBar label="PushCI" cost={pushciCost} max={ghCost} color="bg-emerald-500" />
      </div>

      <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Based on {RUNS.toLocaleString()} runs &times; {AVG_DURATION_MIN}min avg &times; ${GH_RATE}/min
        </span>
        <ShareButton saved={saved} runs={RUNS} />
      </div>
    </div>
  );
}
