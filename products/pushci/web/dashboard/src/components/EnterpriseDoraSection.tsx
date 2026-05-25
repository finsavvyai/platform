// DORA metrics section of /enterprise dashboard. Live data only.

import { cardGesture } from '../styles/gestures';
import type { DoraMetrics } from '../hooks/useEnterprise';
import { formatDuration, formatFrequency, formatRate } from '../pages/enterprise-format';

interface Props {
  data: DoraMetrics | null;
  loading: boolean;
  error: string | null;
}

interface Card { key: string; label: string; value: string; description: string; }

function buildCards(d: DoraMetrics): Card[] {
  return [
    {
      key: 'deploy-freq',
      label: 'Deploy frequency',
      value: formatFrequency(d.deploy_frequency_per_day),
      description: `${d.deploy_count} deploys in the last ${d.window_days} days.`,
    },
    {
      key: 'lead-time',
      label: 'Lead time (p50)',
      value: formatDuration(d.lead_time_ms_p50),
      description: 'Median CI run duration across your projects.',
    },
    {
      key: 'mttr',
      label: 'MTTR (p50)',
      value: formatDuration(d.mttr_ms_p50),
      description: 'Median duration of failed runs before restore.',
    },
    {
      key: 'cfr',
      label: 'Change failure rate',
      value: formatRate(d.change_failure_rate),
      description: 'Share of deploys blocked or failed by policy gate.',
    },
  ];
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4" data-testid="dora-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5">
          <div className="h-3 w-20 rounded shimmer mb-3" />
          <div className="h-7 w-24 rounded shimmer mb-2" />
          <div className="h-2 w-32 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

export default function EnterpriseDoraSection({ data, loading, error }: Props) {
  return (
    <section>
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">DORA metrics</h2>
      {loading && <Skeleton />}
      {error && !loading && (
        <div className="rounded-xl border border-surface-border bg-surface-card p-5 text-sm text-amber-400">
          Couldn't load DORA metrics: {error}
        </div>
      )}
      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {buildCards(data).map((c) => (
            <div key={c.key} className={`rounded-xl border border-surface-border bg-surface-card p-5 ${cardGesture}`}>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">{c.label}</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-100">{c.value}</div>
              <div className="text-xs text-zinc-500 mt-3 leading-relaxed">{c.description}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
