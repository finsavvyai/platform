import { Link } from 'react-router-dom';
import { usePlan, type Plan } from '../hooks/usePlan';
import { linkGesture } from '../styles/gestures';

interface Props {
  message: string;
  planRequired: Plan;
}

export default function UpgradeBanner({ message, planRequired }: Props) {
  const { hasFeature, loading } = usePlan();

  if (loading || hasFeature(planRequired)) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-2.5 mb-4">
      <p className="text-sm text-zinc-300">{message}</p>
      <Link
        to={`/billing?upgrade=${planRequired}`}
        className={`shrink-0 text-xs font-medium text-emerald-400 hover:text-emerald-300 ${linkGesture}`}
      >
        Upgrade &rarr;
      </Link>
    </div>
  );
}
