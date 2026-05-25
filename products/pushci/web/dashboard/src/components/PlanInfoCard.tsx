import { Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import PlanIcon from './PlanIcon';

const BADGE_STYLES = {
  free: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40',
  pro: 'badge-pro-shimmer text-emerald-300 border-emerald-500/30',
  team: 'badge-team-shimmer text-amber-300 border-amber-500/30',
} as const;

export default function PlanInfoCard() {
  const { plan, loading, isFree } = usePlan();
  if (loading) return null;

  const label = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${BADGE_STYLES[plan]}`}
        >
          <PlanIcon plan={plan} size={14} />
          {label} Plan
        </span>
        <span className="text-xs text-zinc-500">
          Member since April 2026
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <Link to="/billing" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          Manage Subscription
        </Link>
        <Link to="/analytics" className="text-zinc-400 hover:text-zinc-300 font-medium transition-colors">
          View Usage
        </Link>
        {isFree && (
          <Link
            to="/billing"
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 font-medium transition-colors"
          >
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}
