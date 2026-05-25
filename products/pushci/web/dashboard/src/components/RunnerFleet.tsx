import { useEffect, useState } from 'react';
import { api, type CloudPoolStatus, type CloudRunner } from '../hooks/useApi';
import { friendlyError } from '../utils/errorMessages';
import EmptyRunnersState from './EmptyRunnersState';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-surface-border bg-zinc-900/50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

export default function RunnerFleet() {
  const [pool, setPool] = useState<CloudPoolStatus | null>(null);
  const [runners, setRunners] = useState<CloudRunner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.getRunnerPool();
        if (!cancelled) {
          setPool(data.pool ?? { total: 0, idle: 0, busy: 0, pending: 0 });
          setRunners(data.runners ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPool({ total: 0, idle: 0, busy: 0, pending: 0 });
          setRunners([]);
          setError(friendlyError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Runner Fleet</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Live pool status from the deployment API.
          </p>
        </div>
      </div>

      {error && (
        error.includes('403') || error.includes('upgrade') ? (
          <div className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-4 text-center">
            <p className="text-sm text-amber-300 font-medium">Cloud runners require a Pro or Team plan</p>
            <p className="text-xs text-zinc-500 mt-1">Free plan includes unlimited local runs on your own machine.</p>
            <a href="/billing" className="inline-block mt-3 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 text-xs font-semibold transition-colors">
              View Plans
            </a>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading runner status…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total" value={pool?.total ?? 0} />
            <StatCard label="Idle" value={pool?.idle ?? 0} />
            <StatCard label="Busy" value={pool?.busy ?? 0} />
            <StatCard label="Pending" value={pool?.pending ?? 0} />
          </div>

          {(pool?.total ?? 0) === 0 ? (
            <EmptyRunnersState />
          ) : (
            <div className="mt-4 grid gap-3">
              {runners.slice(0, 8).map((runner) => (
                <div key={runner.id} className="rounded-xl border border-surface-border bg-zinc-900/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{runner.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {runner.os}/{runner.arch} · heartbeat {new Date(runner.last_heartbeat).toLocaleString()}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${
                      runner.status === 'idle'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : runner.status === 'busy'
                        ? 'bg-yellow-500/10 text-yellow-300'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {runner.status}
                    </span>
                  </div>
                  {runner.labels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {runner.labels.map((label) => (
                        <span key={label} className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
