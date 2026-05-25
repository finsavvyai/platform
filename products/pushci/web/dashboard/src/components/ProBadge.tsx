import { usePlan, type Plan } from '../hooks/usePlan';

interface Props {
  required: Plan;
}

const STYLES: Record<Plan, string> = {
  free: '',
  pro: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  team: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const LABELS: Record<Plan, string> = {
  free: '',
  pro: 'Pro',
  team: 'Team',
};

export default function ProBadge({ required }: Props) {
  const { hasFeature, loading } = usePlan();

  if (loading || hasFeature(required)) return null;

  return (
    <span
      className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STYLES[required]}`}
    >
      {LABELS[required]}
    </span>
  );
}
