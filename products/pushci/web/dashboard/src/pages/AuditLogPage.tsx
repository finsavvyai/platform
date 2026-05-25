import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../hooks/useApi';
import type { AuditLogEntry } from '../hooks/useApi';

const ACTION_OPTIONS = ['', 'create', 'update', 'delete', 'cancel', 'login', 'invite', 'deploy', 'rerun'];
const RESOURCE_OPTIONS = ['', 'run', 'project', 'channel', 'member', 'runner', 'artifact', 'settings', 'billing'];

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  update: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  delete: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancel: 'bg-red-500/15 text-red-400 border-red-500/30',
  login: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  invite: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  deploy: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  rerun: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
      {action}
    </span>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({
        limit,
        offset,
        action: actionFilter || undefined,
        resource_type: resourceFilter || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [offset, actionFilter, resourceFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Log"
        description="Track all actions performed across your account."
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6 stagger-1">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setOffset(0); }}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        >
          <option value="">All resources</option>
          {RESOURCE_OPTIONS.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {(actionFilter || resourceFilter) && (
          <button
            onClick={() => { setActionFilter(''); setResourceFilter(''); setOffset(0); }}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-500 self-center">
          {total} {total === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl shimmer" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 sm:py-12 md:py-16">
          <div className="text-3xl mb-3 opacity-40">!</div>
          <p className="text-zinc-400 text-sm">No audit log entries found.</p>
          <p className="text-zinc-500 text-xs mt-1">Actions you perform will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((entry, idx) => {
            const isExpanded = expandedId === entry.id;
            let details: Record<string, unknown> | null = null;
            if (entry.details_json) {
              try {
                details = JSON.parse(entry.details_json);
              } catch { /* ignore */ }
            }
            return (
              <div
                key={entry.id}
                className={`rounded-xl border border-surface-border bg-surface-card overflow-hidden transition-all stagger-${Math.min(idx + 1, 8)}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 px-4 py-3 text-left hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="shrink-0 w-auto sm:w-24">
                    <span className="text-xs text-zinc-500" title={new Date(entry.created_at).toLocaleString()}>
                      {relativeTime(entry.created_at)}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <ActionBadge action={entry.action} />
                  </div>
                  <div className="shrink-0 hidden sm:block w-20">
                    <span className="text-xs text-zinc-400">{entry.resource_type}</span>
                  </div>
                  <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                    <span className="text-sm text-zinc-200 truncate block">
                      <span className="text-zinc-400">{entry.actor_login}</span>
                      {' '}
                      <span className="text-zinc-500">{entry.action}</span>
                      {' '}
                      {entry.resource_type}
                      {entry.resource_id && (
                        <span className="text-zinc-500 font-mono text-xs ml-1">
                          {entry.resource_id.length > 12
                            ? `${entry.resource_id.slice(0, 12)}...`
                            : entry.resource_id}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-surface-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                      <div>
                        <span className="text-zinc-500">Actor</span>
                        <p className="text-zinc-200 mt-0.5">{entry.actor_login}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Timestamp</span>
                        <p className="text-zinc-200 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Resource Type</span>
                        <p className="text-zinc-200 mt-0.5">{entry.resource_type}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Resource ID</span>
                        <p className="text-zinc-200 font-mono mt-0.5">{entry.resource_id || '-'}</p>
                      </div>
                    </div>
                    {details && (
                      <div className="mt-3">
                        <span className="text-xs text-zinc-500">Details</span>
                        <pre className="mt-1 p-3 bg-surface/50 border border-surface-border rounded-lg text-xs text-zinc-300 overflow-x-auto">
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-surface-border">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-surface-border bg-surface-card text-zinc-300 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-surface-border bg-surface-card text-zinc-300 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
