import { Link } from 'react-router-dom';
import type { Plan } from '../hooks/usePlan';

interface Props {
  title: string;
  requiredPlan: Plan;
  description?: string;
}

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

export default function LockedFeature({ title, requiredPlan, description }: Props) {
  const label = PLAN_LABEL[requiredPlan];
  const desc = description ?? `${title} is available on the ${label} plan.`;

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 text-center opacity-75">
      <div className="text-2xl mb-2" aria-hidden>&#128274;</div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 mb-4">{desc}</p>
      <Link
        to="/billing"
        className="inline-block text-xs font-medium px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
      >
        Upgrade to {label}
      </Link>
    </div>
  );
}
