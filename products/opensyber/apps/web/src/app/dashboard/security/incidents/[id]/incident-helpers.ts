export interface Incident {
  id: string;
  instanceId: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  rootCause: string | null;
  remediation: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  eventType: string;
  content: string;
  authorId: string | null;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  instanceId: string;
  eventType: string;
  severity: string;
  skillId: string | null;
  sourceIp: string | null;
  sourceCountry: string | null;
  details: string | null;
  createdAt: string;
}

export const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-info/10 text-info',
};

export const statusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  contained: 'bg-info/10 text-info',
  resolved: 'bg-green-500/10 text-green-400',
  closed: 'bg-neutral-800 text-neutral-400',
};

export const eventSeverityColors: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-yellow-500/10 text-yellow-400',
  critical: 'bg-red-500/10 text-red-400',
};

export const timelineEventLabels: Record<string, string> = {
  status_change: 'Status Change',
  comment: 'Comment',
  evidence: 'Evidence',
  assignment: 'Assignment',
};
