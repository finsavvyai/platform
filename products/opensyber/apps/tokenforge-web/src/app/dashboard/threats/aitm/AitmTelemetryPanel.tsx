'use client';

import { useCallback, useState } from 'react';
import { ShieldAlert, Search } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchDeviceTelemetry, type DeviceTelemetry } from '@/lib/tokenforge-api';

const CONF_COLOR: Record<string, string> = {
  high: 'bg-alert/15 border-alert/40 text-alert',
  medium: 'bg-warn/15 border-warn/40 text-warn',
  low: 'bg-info/15 border-info/40 text-info',
};

function trustColor(score: number): string {
  if (score >= 90) return 'text-ok';
  if (score >= 40) return 'text-warn';
  return 'text-alert';
}

function trustBand(score: number): string {
  if (score >= 90) return 'ALLOW';
  if (score >= 40) return 'STEP_UP';
  return 'BLOCK';
}

export function AitmTelemetryPanel(): React.ReactElement {
  const [deviceId, setDeviceId] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const fetcher = useCallback(
    (token: string, signal: AbortSignal) =>
      submittedId
        ? fetchDeviceTelemetry(token, submittedId, signal)
        : Promise.resolve(null),
    [submittedId],
  );

  const { data, loading, error } = useApi<DeviceTelemetry | null>(fetcher);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = deviceId.trim();
    if (trimmed) setSubmittedId(trimmed);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device ID (e.g. dev_a1b2c3...)"
            className="w-full rounded-lg border border-border bg-panel pl-10 pr-3 py-2 text-sm font-[family-name:var(--font-mono)] focus:border-info focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-info px-4 py-2 text-sm font-semibold text-void hover:brightness-110 transition"
        >
          Inspect
        </button>
      </form>

      {!submittedId && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-panel/30 p-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            Enter a device ID to view AitM telemetry: trust score, key class, and recent anomaly events.
          </p>
        </div>
      )}

      {submittedId && loading && (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      )}

      {submittedId && error && (
        <div className="rounded-2xl border border-alert/40 bg-alert/5 p-6 text-sm text-alert">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Trust score" value={String(data.trustScore)} extra={trustBand(data.trustScore)} valueClass={trustColor(data.trustScore)} />
            <Stat label="Key class" value={data.keyClass.replace('_', ' ')} />
            <Stat label="Channel bound" value={data.channelBound ? 'Yes' : 'No'} valueClass={data.channelBound ? 'text-ok' : 'text-warn'} />
            <Stat label="Anomalies" value={String(data.anomalies.length)} valueClass={data.anomalies.length > 0 ? 'text-warn' : 'text-text-secondary'} />
          </div>

          <div className="rounded-2xl border border-border/60 bg-panel p-6">
            <h3 className="text-base font-semibold mb-3">Recent anomalies</h3>
            {data.anomalies.length === 0 ? (
              <p className="text-sm text-text-secondary">No AitM anomaly events recorded for this device.</p>
            ) : (
              <ul className="space-y-2">
                {data.anomalies.map((a, i) => (
                  <li key={`${a.kind}-${a.capturedAt}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-void p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-[family-name:var(--font-mono)] text-sm">{a.kind}</span>
                      {a.confidence && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${CONF_COLOR[a.confidence] ?? ''}`}>
                          {a.confidence}
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-text-muted shrink-0">
                      {new Date(a.capturedAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-text-muted font-[family-name:var(--font-mono)]">
            <div>bound: {new Date(data.boundAt).toLocaleString()}</div>
            <div>last verified: {new Date(data.lastVerifiedAt).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, extra, valueClass }: { label: string; value: string; extra?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-panel p-4">
      <div className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-semibold ${valueClass ?? ''}`}>{value}</div>
      {extra && <div className="text-[10px] font-[family-name:var(--font-mono)] mt-1 opacity-70">{extra}</div>}
    </div>
  );
}
