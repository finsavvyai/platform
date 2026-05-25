import { Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import PlanIcon from './PlanIcon';

const BADGE_STYLES = {
  free: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40',
  pro: 'badge-pro-shimmer text-emerald-300 border-emerald-500/30',
  team: 'badge-team-shimmer text-amber-300 border-amber-500/30',
} as const;

export default function PlanBadge() {
  const { plan, loading } = usePlan();
  if (loading) return null;

  const label = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${BADGE_STYLES[plan]}`}
      >
        <PlanIcon plan={plan} size={12} />
        {label}
      </span>
      {plan === 'free' && (
        <Link
          to="/billing"
          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
