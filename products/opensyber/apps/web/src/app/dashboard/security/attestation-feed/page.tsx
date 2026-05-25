import { ShieldCheck, ShieldAlert, Clock3 } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type SecurityEvent = {
  id: string;
  eventType: string;
  severity: string;
  details: string | null;
  createdAt: string;
};

function classifyEvent(eventType: string): 'runtime' | 'attestation' | 'supply-chain' | 'other' {
  const t = eventType.toLowerCase();
  if (t.includes('seccomp') || t.includes('osquery') || t.includes('runtime')) return 'runtime';
  if (t.includes('attest') || t.includes('signature') || t.includes('verification')) return 'attestation';
  if (t.includes('supply') || t.includes('package') || t.includes('dependency')) return 'supply-chain';
  return 'other';
}

function typeBadge(type: ReturnType<typeof classifyEvent>) {
  if (type === 'runtime') return 'bg-cyan-500/10 text-cyan-300';
  if (type === 'attestation') return 'bg-green-500/10 text-green-300';
  if (type === 'supply-chain') return 'bg-purple-500/10 text-purple-300';
  return 'bg-neutral-500/15 text-neutral-300';
}

export const metadata = {
  title: 'Runtime Attestation Feed',
};

export default async function AttestationFeedPage() {
  let instanceId: string | null = null;
  let events: SecurityEvent[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const eventData = await apiClient<{ events: SecurityEvent[] }>(
          `/api/security/instances/${instance.id}/events`,
          { token },
        );
        events = eventData.events ?? [];
      }
    }
  } catch (err) {
    console.error('[AttestationFeed] Failed to fetch security events:', err instanceof Error ? err.message : err);
  }

  const feedEvents = events
    .map((event) => ({ ...event, category: classifyEvent(event.eventType) }))
    .filter((event) => event.category !== 'other');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Runtime Attestation Feed</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Live stream of runtime, attestation, and supply-chain security signals for your active instance.
        </p>
      </div>

      {!instanceId && (
        <div className="rounded border border-border bg-panel/30 p-6">
          <p className="text-sm text-text-secondary">Deploy an instance to activate runtime attestation telemetry.</p>
        </div>
      )}

      {instanceId && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded border border-border bg-panel/30 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                <ShieldCheck className="h-4 w-4 text-green-400" aria-hidden="true" />
                Attestation Events
              </div>
              <p className="text-3xl font-bold">
                {feedEvents.filter((e) => e.category === 'attestation').length}
              </p>
            </div>
            <div className="rounded border border-border bg-panel/30 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                <ShieldAlert className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Runtime Signals
              </div>
              <p className="text-3xl font-bold">
                {feedEvents.filter((e) => e.category === 'runtime').length}
              </p>
            </div>
            <div className="rounded border border-border bg-panel/30 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                <Clock3 className="h-4 w-4 text-purple-400" aria-hidden="true" />
                Supply Chain
              </div>
              <p className="text-3xl font-bold">
                {feedEvents.filter((e) => e.category === 'supply-chain').length}
              </p>
            </div>
          </div>

          <div className="rounded border border-border bg-panel/30 p-6">
            <h2 className="mb-4 text-lg font-semibold">Latest Verified Signals</h2>
            {feedEvents.length === 0 ? (
              <p className="text-sm text-text-dim">No attestation-classified events yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-secondary">
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Event Type</th>
                      <th className="pb-3 font-medium">Severity</th>
                      <th className="pb-3 font-medium">Details</th>
                      <th className="pb-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {feedEvents.slice(0, 100).map((event) => (
                      <tr key={event.id}>
                        <td className="py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase ${typeBadge(event.category)}`}>
                            {event.category}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-xs">{event.eventType}</td>
                        <td className="py-3">
                          <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-primary">
                            {event.severity}
                          </span>
                        </td>
                        <td className="max-w-md truncate py-3 text-text-secondary">{event.details || '\u2014'}</td>
                        <td className="whitespace-nowrap py-3 text-text-dim">{formatDate(event.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

