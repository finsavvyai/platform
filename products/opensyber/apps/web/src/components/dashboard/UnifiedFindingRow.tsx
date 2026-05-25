import { formatDate } from '@/lib/utils';
import {
  SEV_COLORS,
  SOURCE_LABELS,
  SOURCE_COLORS,
} from './UnifiedFindingsSummary';

export interface UnifiedFinding {
  id: string;
  source: 'cspm' | 'pipewarden' | 'tenantiq' | 'sdlc';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  summary: string;
  createdAt: string;
  eventType: string | null;
  status: string | null;
}

export function UnifiedFindingRow({ finding: f }: { finding: UnifiedFinding }) {
  return (
    <li className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-xs px-2 py-0.5 rounded border uppercase tracking-wide ${SEV_COLORS[f.severity]}`}
            >
              {f.severity}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${SOURCE_COLORS[f.source]}`}
            >
              {SOURCE_LABELS[f.source]}
            </span>
            {f.eventType && (
              <span className="text-xs px-2 py-0.5 rounded border border-zinc-700 text-zinc-400">
                {f.eventType}
              </span>
            )}
            {f.status && (
              <span className="text-xs px-2 py-0.5 rounded border border-zinc-700 text-zinc-400">
                {f.status}
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-white">{f.title}</h3>
          {f.summary && f.summary !== f.title && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{f.summary}</p>
          )}
        </div>
        <div className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(f.createdAt)}</div>
      </div>
    </li>
  );
}
