'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Instance {
  id: string;
  status?: string;
  gatewayToken?: string | null;
}

interface PrereqState {
  deployed: boolean;
  gatewayConfigured: boolean;
  agentRunning: boolean;
}

function detectPrereqs(instances: Instance[]): PrereqState {
  const first = instances?.[0];
  return {
    deployed: instances.length > 0,
    gatewayConfigured: !!first?.gatewayToken,
    agentRunning: first?.status === 'running',
  };
}

const CHECKS = [
  { key: 'deployed', label: 'Instance deployed', link: '/dashboard', linkLabel: 'Dashboard' },
  { key: 'gatewayConfigured', label: 'Gateway token configured', link: '/dashboard/settings', linkLabel: 'Settings' },
  { key: 'agentRunning', label: 'Agent running', link: '/dashboard', linkLabel: 'Dashboard' },
] as const;

export default function PrereqStatus() {
  const [state, setState] = useState<PrereqState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/instances')
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setState(detectPrereqs(json.instances ?? json.data ?? [])))
      .catch(() => setState({ deployed: false, gatewayConfigured: false, agentRunning: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-8 rounded border border-info/20 bg-info/5 p-6">
      <h2 className="text-sm font-semibold text-signal mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4" />
        Before You Start
      </h2>
      {loading ? (
        <div className="flex items-center text-xs text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Checking prerequisites...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 text-sm text-text-primary">
          {CHECKS.map((c) => {
            const ok = state?.[c.key] ?? false;
            const Icon = ok ? CheckCircle : XCircle;
            const color = ok ? 'text-green-400' : 'text-amber-400';
            return (
              <div key={c.key} className="flex items-start gap-2">
                <Icon className={`h-4 w-4 ${color} mt-0.5 flex-shrink-0`} />
                <span>
                  {c.label}{' '}
                  {!ok && (
                    <Link href={c.link} className="text-signal hover:underline">
                      Go to {c.linkLabel}
                    </Link>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
