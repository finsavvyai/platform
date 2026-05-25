import { btnGesturePrimary, btnGesture } from '../styles/gestures';

interface PlanDef {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}

interface Props {
  plan: PlanDef;
  isCurrent: boolean;
  isBelowCurrent: boolean;
  isTarget: boolean;
  loading: boolean;
  onCheckout: () => void;
}

const PLAN_ACCENT: Record<string, string> = {
  team: 'from-violet-400 via-purple-400 to-blue-400',
};

export default function BillingPlanCard({ plan, isCurrent, isBelowCurrent, isTarget, loading, onCheckout }: Props) {
  const isPro = plan.highlight;
  const isTeam = plan.id === 'team';
  const dimmed = isBelowCurrent && !isCurrent;

  const wrapperGlow = isPro
    ? 'p-px bg-gradient-to-b from-emerald-400/80 via-emerald-500/40 to-transparent rounded-2xl shadow-[0_0_40px_-8px_rgba(16,185,129,0.35)]'
    : isTeam
    ? 'p-px bg-gradient-to-b from-violet-400/50 via-purple-500/20 to-transparent rounded-2xl'
    : '';

  const innerBg = isPro
    ? 'bg-[#0d1f18] rounded-2xl'
    : isTeam
    ? 'bg-[#120e1f] rounded-2xl'
    : 'rounded-xl border border-zinc-800/80 bg-zinc-900/60';

  const inner = (
    <div className={`flex flex-col h-full p-6 relative overflow-hidden ${innerBg} ${dimmed ? 'opacity-50' : ''}`}>
      {isPro && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_65%)]" />
      )}
      {isTeam && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_65%)]" />
      )}

      <div className="relative">
        {isCurrent && (
          <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest mb-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Your Plan
          </p>
        )}
        {isTarget && !isCurrent && (
          <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest mb-3">Ready to upgrade</p>
        )}

        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-white">{plan.name}</h3>
          {isPro && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-400 to-cyan-400 text-transparent bg-clip-text border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Most Popular
            </span>
          )}
          {isTeam && (
            <span className={`text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r ${PLAN_ACCENT.team} text-transparent bg-clip-text border border-violet-500/30 px-2 py-0.5 rounded-full`}>
              Team
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1 mb-5">
          <span className={`text-4xl font-black tracking-tight ${isPro ? 'bg-gradient-to-r from-emerald-300 to-cyan-300 text-transparent bg-clip-text' : isTeam ? `bg-gradient-to-r ${PLAN_ACCENT.team} text-transparent bg-clip-text` : 'text-white'}`}>
            {plan.price}
          </span>
          <span className="text-sm text-zinc-500 font-medium">{plan.period}</span>
        </div>

        <ul className="flex-1 space-y-2.5 mb-6">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
              <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isPro ? 'text-emerald-400' : isTeam ? 'text-violet-400' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <div className="w-full py-2.5 rounded-xl border border-emerald-500/25 text-center text-sm text-emerald-400 font-medium bg-emerald-500/5">
            Current Plan
          </div>
        ) : plan.id !== 'free' ? (
          <button
            onClick={onCheckout}
            disabled={loading}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 ${btnGesturePrimary} ${
              isPro
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5)]'
                : isTeam
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_4px_20px_-4px_rgba(139,92,246,0.4)]'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
          >
            {loading ? 'Loading…' : `Upgrade to ${plan.name}`}
          </button>
        ) : (
          <div className={`w-full py-2.5 rounded-xl border border-zinc-800 text-center text-sm text-zinc-500 ${btnGesture}`}>
            Free forever
          </div>
        )}
      </div>
    </div>
  );

  return wrapperGlow ? (
    <div className={`${wrapperGlow} h-full`}>{inner}</div>
  ) : (
    <div className="h-full">{inner}</div>
  );
}
