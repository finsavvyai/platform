import Link from 'next/link';
import { ArrowLeft, AlertOctagon, Clock } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Incident, IncidentEvent, SecurityEvent } from './incident-helpers';
import { severityColors, statusColors, eventSeverityColors, timelineEventLabels } from './incident-helpers';

export const metadata = { title: 'Incident Detail' };

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: incidentId } = await params;
  let incident: Incident | null = null;
  let timeline: IncidentEvent[] = [];
  let linkedEvents: SecurityEvent[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{
          incident: Incident; timeline: IncidentEvent[]; linkedEvents: SecurityEvent[];
        }>(`/api/security/instances/${instance.id}/incidents/${incidentId}`, { token });
        incident = data.incident;
        timeline = data.timeline;
        linkedEvents = data.linkedEvents;
      }
    }
  } catch (err) { console.error('[IncidentDetail] Failed to fetch incident:', err instanceof Error ? err.message : err); }

  if (!incident) {
    return (
      <div>
        <Link href="/dashboard/security/incidents" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-white transition mb-6">
          <ArrowLeft className="h-4 w-4" />Back to Incidents
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <AlertOctagon className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">Incident not found</h3>
          <p className="text-sm text-text-secondary max-w-sm">The incident you are looking for does not exist or you do not have access.</p>
        </div>
      </div>
    );
  }

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div>
      <Link href="/dashboard/security/incidents" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-white transition mb-6">
        <ArrowLeft className="h-4 w-4" />Back to Incidents
      </Link>
      <IncidentHeader incident={incident} />
      <IncidentDetails incident={incident} />
      <TimelineSection sortedTimeline={sortedTimeline} />
      <LinkedEventsTable linkedEvents={linkedEvents} />
    </div>
  );
}

function IncidentHeader({ incident }: { incident: Incident }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold">{incident.title}</h1>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[incident.severity] ?? 'bg-surface text-text-primary'}`}>
          {incident.severity}
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[incident.status] ?? 'bg-surface text-text-primary'}`}>
          {incident.status}
        </span>
      </div>
      <p className="text-sm text-text-secondary">Created {formatDate(incident.createdAt)}</p>
    </div>
  );
}

function IncidentDetails({ incident }: { incident: Incident }) {
  return (
    <>
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border bg-panel/30 p-6">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Description</h3>
          <p className="text-sm text-neutral-200">{incident.description || '\u2014'}</p>
        </div>
        <div className="rounded border border-border bg-panel/30 p-6">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Assignee</h3>
          <p className="text-sm text-neutral-200">{incident.assignee || 'Unassigned'}</p>
          {incident.resolvedAt && (
            <div className="mt-3 pt-3 border-t border-border">
              <h3 className="text-sm font-medium text-text-secondary mb-1">Resolved</h3>
              <p className="text-sm text-neutral-200">{formatDate(incident.resolvedAt)}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border bg-panel/30 p-6">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Root Cause</h3>
          <p className="text-sm text-neutral-200">{incident.rootCause || '\u2014'}</p>
        </div>
        <div className="rounded border border-border bg-panel/30 p-6">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Remediation</h3>
          <p className="text-sm text-neutral-200">{incident.remediation || '\u2014'}</p>
        </div>
      </div>
    </>
  );
}

function TimelineSection({ sortedTimeline }: { sortedTimeline: IncidentEvent[] }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-text-secondary" />Timeline
      </h3>
      {sortedTimeline.length === 0 ? (
        <p className="text-sm text-text-dim">No timeline events recorded.</p>
      ) : (
        <div className="space-y-4">
          {sortedTimeline.map((event) => (
            <div key={event.id} className="flex gap-4 items-start">
              <div className="flex-shrink-0 mt-1"><div className="h-2 w-2 rounded-full bg-neutral-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text-primary">{timelineEventLabels[event.eventType] ?? event.eventType}</span>
                  <span className="text-xs text-text-dim">{formatDate(event.createdAt)}</span>
                </div>
                <p className="text-sm text-text-secondary">{event.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedEventsTable({ linkedEvents }: { linkedEvents: SecurityEvent[] }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Linked Security Events</h3>
      {linkedEvents.length === 0 ? (
        <p className="text-sm text-text-dim">No linked security events.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Details</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {linkedEvents.map((event) => (
                <tr key={event.id}>
                  <td className="py-3 font-mono text-xs">{event.eventType}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventSeverityColors[event.severity] ?? 'bg-surface text-text-primary'}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="py-3 text-text-secondary max-w-xs truncate">{event.details || '\u2014'}</td>
                  <td className="py-3 text-text-dim whitespace-nowrap">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
