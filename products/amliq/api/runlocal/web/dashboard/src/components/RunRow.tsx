import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CIRun } from '../data/types';
import StatusBadge from './StatusBadge';
import CheckRow from './CheckRow';

interface Props {
  run: CIRun;
}

export default function RunRow({ run }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const time = new Date(run.timestamp).toLocaleString();

  return (
    <div className="border border-surface-border rounded-lg bg-surface-card hover:border-zinc-600 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left"
      >
        <StatusBadge status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-zinc-100 truncate">{run.repo}</span>
            <span className="text-xs text-zinc-500">{run.branch}</span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{run.commitMsg}</p>
        </div>
        <code className="text-xs text-zinc-500 font-mono">{run.commitSha}</code>
        <span className="text-xs text-zinc-500 w-16 text-right">{run.duration}</span>
        <span className="text-xs text-zinc-600 w-36 text-right">{time}</span>
        <span className="text-zinc-500 text-xs">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-surface-border pt-3">
          {run.checks.map((c) => <CheckRow key={c.name} check={c} />)}
          <button
            onClick={() => navigate(`/runs/${run.id}`)}
            className="text-xs text-emerald-400 hover:text-emerald-300 mt-2"
          >
            View full details
          </button>
        </div>
      )}
    </div>
  );
}
