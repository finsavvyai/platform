import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CIRun } from '../data/types';
import StatusBadge from './StatusBadge';
import CheckRow from './CheckRow';

interface Props {
  run: CIRun;
}

const STATUS_BORDERS: Record<string, string> = {
  passed: 'hover:border-emerald-500/30',
  failed: 'hover:border-red-500/30',
  running: 'border-yellow-500/20 hover:border-yellow-500/40',
  cancelled: 'hover:border-zinc-500/30',
};

const STATUS_GLOWS: Record<string, string> = {
  running: 'shadow-[0_0_15px_-3px_rgba(234,179,8,0.15)]',
  passed: 'hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)]',
  failed: 'hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]',
};

export default function RunRow({ run }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const time = new Date(run.timestamp).toLocaleString();
  const borderClass = STATUS_BORDERS[run.status] ?? '';
  const glowClass = STATUS_GLOWS[run.status] ?? '';

  return (
    <div className={`
      border border-surface-border rounded-xl
      bg-surface-card/80 backdrop-blur-md
      ${borderClass} ${glowClass}
      transition-all duration-300 ease-out
      animate-fade-up
    `}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4 text-left"
      >
        <StatusBadge status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-100 truncate">{run.repo}</span>
            <span className="text-xs text-zinc-500 hidden sm:inline">{run.branch}</span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{run.commitMsg}</p>
          <div className="flex items-center gap-2 mt-1 sm:hidden">
            <span className="text-xs text-zinc-500">{run.branch}</span>
            <span className="text-xs text-zinc-600">{run.duration}</span>
          </div>
        </div>
        <code className="text-xs text-zinc-500 font-mono hidden md:block">{run.commitSha}</code>
        <span className="text-xs text-zinc-500 w-16 text-right hidden sm:block">{run.duration}</span>
        <span className="text-xs text-zinc-600 w-36 text-right hidden lg:block">{time}</span>
        <span className={`text-zinc-500 text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 space-y-2 border-t border-surface-border/50 pt-3 animate-slide-in">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 sm:hidden mb-2">
            <span className="font-mono">{run.commitSha}</span>
            <span>{time}</span>
          </div>
          {run.checks.map((c) => <CheckRow key={c.name} check={c} />)}
          <button
            onClick={() => navigate(`/runs/${run.id}`)}
            className="text-xs text-emerald-400 hover:text-emerald-300 mt-2 transition-colors"
          >
            View full details
          </button>
        </div>
      )}
    </div>
  );
}
