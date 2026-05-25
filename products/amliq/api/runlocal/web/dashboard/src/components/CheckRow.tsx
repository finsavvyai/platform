import { Check } from '../data/types';
import StatusBadge from './StatusBadge';

interface Props {
  check: Check;
}

export default function CheckRow({ check }: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-zinc-900/50">
      <StatusBadge status={check.status} size="sm" />
      <span className="text-sm text-zinc-200 flex-1">{check.name}</span>
      <span className="text-xs text-zinc-500 font-mono">{check.duration}</span>
      <span className="text-xs text-zinc-500 truncate max-w-[200px]">{check.output}</span>
    </div>
  );
}
