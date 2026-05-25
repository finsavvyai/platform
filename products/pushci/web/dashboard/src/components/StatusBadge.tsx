import { RunStatus } from '../data/types';

const config: Record<RunStatus, {
  bg: string; text: string; label: string;
  glow: string; ring: string;
}> = {
  passed: {
    bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Passed',
    glow: 'shadow-emerald-500/20', ring: 'bg-emerald-400',
  },
  failed: {
    bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed',
    glow: 'shadow-red-500/20', ring: 'bg-red-400',
  },
  running: {
    bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Running',
    glow: 'shadow-yellow-500/20', ring: 'bg-yellow-400',
  },
  cancelled: {
    bg: 'bg-zinc-500/10', text: 'text-zinc-300', label: 'Cancelled',
    glow: '', ring: 'bg-zinc-400',
  },
};

interface Props {
  status: RunStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const c = config[status];
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  const isRunning = status === 'running';
  const isFailed = status === 'failed';

  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full font-medium
      ${c.bg} ${c.text} ${px}
      backdrop-blur-sm border border-white/5
      ${isRunning ? 'animate-glow-pulse' : ''}
      ${isFailed ? 'animate-shake' : ''}
      transition-all duration-300
    `}>
      <span className="relative flex h-2 w-2">
        {isRunning && (
          <span className={`absolute inset-0 rounded-full ${c.ring} animate-status-ring`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.ring} ${isRunning ? 'animate-pulse' : ''}`} />
      </span>
      {c.label}
    </span>
  );
}
