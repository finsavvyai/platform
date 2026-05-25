import { RunStatus } from '../data/types';

const config: Record<RunStatus, { bg: string; text: string; label: string }> = {
  passed: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Passed' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
  running: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Running' },
};

interface Props {
  status: RunStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const c = config[status];
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${c.bg} ${c.text} ${px}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
        status === 'passed' ? 'bg-emerald-400' :
        status === 'failed' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
      }`} />
      {c.label}
    </span>
  );
}
