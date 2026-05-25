import { Link } from 'react-router-dom';
import { useRuns } from '../hooks/useRuns';
import PageHeader from '../components/PageHeader';

import type { RunStatus as Status } from '../data/types';

function parseDurationSec(d: string): number {
  const m = d.match(/(\d+)m\s*(\d+)s/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function percent(n: number, d: number): string {
  if (d === 0) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusDot({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    passed: 'bg-emerald-400',
    failed: 'bg-red-500',
    running: 'bg-blue-400 animate-pulse',
    cancelled: 'bg-zinc-500',
  };
  return (
    <span
      role="img"
      aria-label={status}
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-zinc-500'}`}
    />
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return <div className="h-12 text-xs text-zinc-500">No data</div>;
  const max = Math.max(...points, 1);
  const w = 220;
  const h = 40;
  const step = w / Math.max(points.length - 1, 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / max) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="text-emerald-400">
      <path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function OverviewPage() {
  const { runs, loading } = useRuns();

  const recent = runs.slice(0, 20);
  const success = recent.filter((r) => r.status === 'passed').length;
  const failed = recent.filter((r) => r.status === 'failed').length;
  const avgDur =
    recent.length === 0
      ? 0
      : Math.round(recent.reduce((s, r) => s + parseDurationSec(r.duration), 0) / recent.length);
  const durPoints = recent.slice().reverse().map((r) => parseDurationSec(r.duration));

  const projects = Array.from(new Set(runs.map((r) => r.repo))).slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Build health at a glance" />

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading runs…</div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <MetricCard label="Runs (recent 20)" value={String(recent.length)} />
            <MetricCard label="Success rate" value={percent(success, recent.length)} hint={`${failed} failed`} />
            <MetricCard label="Avg duration" value={avgDur ? `${Math.floor(avgDur / 60)}m ${avgDur % 60}s` : '—'} />
            <MetricCard label="Active projects" value={String(projects.length)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-surface-border bg-surface-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-zinc-100">Build duration trend</span>
                <Link to="/analytics" className="text-xs text-emerald-400 hover:underline">View analytics →</Link>
              </div>
              <Sparkline points={durPoints} />
              <div className="mt-2 text-xs text-zinc-500">Latest 20 runs, oldest → newest</div>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-5">
              <div className="text-sm font-semibold text-zinc-100 mb-3">Recent deploys</div>
              {recent.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-zinc-500">No runs yet.</div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/projects" className="text-xs text-emerald-400 hover:underline">Connect a repo</Link>
                    <span className="text-xs text-zinc-600">or run</span>
                    <code className="font-mono text-xs text-emerald-400">npx pushci init</code>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recent.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <Link to={`/runs/${r.id}`} className="flex items-center gap-2 text-xs hover:bg-surface-hover rounded px-2 py-1.5">
                        <StatusDot status={r.status} />
                        <span className="font-mono text-zinc-300 truncate flex-1">{r.repo}</span>
                        <span className="text-zinc-500 flex-shrink-0">{relTime(r.timestamp)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-100">Active projects</span>
              <Link to="/projects" className="text-xs text-emerald-400 hover:underline">All projects →</Link>
            </div>
            {projects.length === 0 ? (
              <div className="flex flex-col gap-3 items-start py-4">
                <div className="text-sm text-zinc-300">No projects tracked yet.</div>
                <div className="text-xs text-zinc-500 max-w-md">Connect a repository to see runs, deploys, and analytics here. You can connect from GitHub, GitLab, or Bitbucket — or import an existing CI pipeline.</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Link to="/projects" className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-900">Connect a repo</Link>
                  <Link to="/migrate" className="px-3 py-2 rounded-lg text-xs font-semibold border border-surface-border text-zinc-200 hover:bg-surface-hover">Import existing pipeline</Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                  const projectRuns = runs.filter((r) => r.repo === p);
                  const last = projectRuns[0];
                  const ok = projectRuns.filter((r) => r.status === 'passed').length;
                  return (
                    <Link key={p} to={`/runs?repo=${encodeURIComponent(p)}`} className="rounded-lg border border-surface-border p-3 hover:bg-surface-hover">
                      <div className="flex items-center gap-2">
                        {last && <StatusDot status={last.status as Status} />}
                        <span className="text-xs font-mono text-zinc-200 truncate">{p}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {projectRuns.length} runs · {percent(ok, projectRuns.length)} pass
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
