import { Pause, Play, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface ZtnaApp {
  id: string;
  hostname: string;
  upstream: string;
  requiredTrustScore: number;
  forwardWriteMethods: boolean;
  status: 'active' | 'paused' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<ZtnaApp['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  deleted: 'bg-zinc-700/30 text-zinc-500 border-zinc-700',
};

interface Props {
  app: ZtnaApp;
  onToggleStatus: (app: ZtnaApp) => void;
  onDelete: (app: ZtnaApp) => void;
}

export function ZtnaAppRow({ app, onToggleStatus, onDelete }: Props) {
  return (
    <li className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-medium text-white">{app.hostname}</code>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[app.status]}`}
            >
              {app.status}
            </span>
          </div>
          <div className="text-xs text-zinc-400">
            → <code>{app.upstream}</code>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Min trust score: <span className="text-zinc-300">{app.requiredTrustScore}</span>
            {' · '}
            Writes: {app.forwardWriteMethods ? 'allowed' : 'blocked'}
            {' · '}
            Updated {formatDate(app.updatedAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleStatus(app)}
            className="p-2 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 transition"
            title={app.status === 'active' ? 'Pause' : 'Resume'}
          >
            {app.status === 'active' ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(app)}
            className="p-2 rounded-md border border-red-500/30 hover:border-red-500 text-red-400 hover:text-red-300 transition"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
