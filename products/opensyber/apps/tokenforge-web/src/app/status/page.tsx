'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://tokenforge-api.opensyber.cloud';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'operational' | 'degraded' | 'down' | 'checking';
  latencyMs: number | null;
  checkedAt: string | null;
}

const SERVICES: Array<{ name: string; url: string }> = [
  { name: 'TokenForge API', url: `${API_BASE}/health` },
  { name: 'DBSC Service Descriptor', url: `${API_BASE}/.well-known/tokenforge/dbsc` },
  { name: 'JWKS Endpoint', url: `${API_BASE}/.well-known/tokenforge/jwks` },
  { name: 'OpenAPI Spec', url: `${API_BASE}/v1/openapi.json` },
];

async function checkService(svc: { name: string; url: string }): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const res = await fetch(svc.url, { method: 'GET', cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) return { ...svc, status: 'operational', latencyMs, checkedAt: new Date().toISOString() };
    return { ...svc, status: 'degraded', latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { ...svc, status: 'down', latencyMs: null, checkedAt: new Date().toISOString() };
  }
}

const STATUS_ICON = {
  operational: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  degraded: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  down: <XCircle className="h-5 w-5 text-red-500" />,
  checking: <RefreshCw className="h-5 w-5 animate-spin text-text-tertiary" />,
};

const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  checking: 'Checking...',
};

export default function StatusPage(): React.ReactElement {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({ ...s, status: 'checking', latencyMs: null, checkedAt: null })),
  );
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  async function runChecks(): Promise<void> {
    setServices((prev) => prev.map((s) => ({ ...s, status: 'checking' })));
    const results = await Promise.all(SERVICES.map(checkService));
    setServices(results);
    setLastCheck(new Date().toISOString());
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- run-on-mount status checks; setServices/setLastCheck happen after fetches resolve
  useEffect(() => { runChecks(); }, []);

  const allOk = services.every((s) => s.status === 'operational');
  const anyDown = services.some((s) => s.status === 'down');

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">TokenForge Status</h1>
      <p className="mb-8 text-text-secondary">
        Real-time availability of TokenForge services.
      </p>

      <div className={`mb-8 rounded-xl border p-6 ${allOk ? 'border-green-500/30 bg-green-500/5' : anyDown ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
        <div className="flex items-center gap-3">
          {allOk ? STATUS_ICON.operational : anyDown ? STATUS_ICON.down : STATUS_ICON.degraded}
          <span className="text-lg font-semibold">
            {allOk ? 'All Systems Operational' : anyDown ? 'Service Disruption' : 'Partial Degradation'}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="flex items-center justify-between rounded-xl border border-border/50 bg-panel px-5 py-4"
          >
            <div className="flex items-center gap-3">
              {STATUS_ICON[svc.status]}
              <span className="font-medium">{svc.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              {svc.latencyMs !== null && (
                <span className="font-mono">{svc.latencyMs}ms</span>
              )}
              <span>{STATUS_LABEL[svc.status]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between text-sm text-text-tertiary">
        <span>
          {lastCheck ? `Last checked: ${new Date(lastCheck).toLocaleTimeString()}` : ''}
        </span>
        <button
          type="button"
          onClick={runChecks}
          className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 hover:bg-surface/80 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
    </div>
  );
}
