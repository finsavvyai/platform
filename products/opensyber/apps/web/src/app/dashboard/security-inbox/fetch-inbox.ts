import type { InboxItem, Category, Severity } from './types';

interface ApiIncident {
  id: string;
  title?: string;
  severity?: string;
  source?: string;
  resource?: string;
  createdAt?: string;
  status?: string;
  riskScore?: number;
}

interface ApiFinding {
  id: string;
  title?: string;
  severity?: string;
  service?: string;
  resource?: string;
  createdAt?: string;
  status?: string;
}

interface ApiViolation {
  id: string;
  title?: string;
  severity?: string;
  instanceId?: string;
  createdAt?: string;
  status?: string;
}

function mapSeverity(s?: string): Severity {
  const v = (s ?? '').toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  return 'low';
}

function mapStatus(s?: string): 'new' | 'in_progress' | 'snoozed' {
  const v = (s ?? '').toLowerCase();
  if (v === 'in_progress' || v === 'investigating') return 'in_progress';
  if (v === 'snoozed' || v === 'resolved') return 'snoozed';
  return 'new';
}

function incidentToItem(i: ApiIncident): InboxItem {
  return {
    id: `inc-${i.id}`, title: i.title ?? `Incident ${i.id}`,
    category: 'incident' as Category, severity: mapSeverity(i.severity),
    source: i.source ?? 'Runtime Monitor', resource: i.resource ?? 'unknown',
    firstSeen: i.createdAt ?? new Date().toISOString(),
    status: mapStatus(i.status), score: i.riskScore ?? 50,
  };
}

function findingToItem(f: ApiFinding): InboxItem {
  return {
    id: `cspm-${f.id}`, title: f.title ?? `Finding ${f.id}`,
    category: 'misconfiguration' as Category, severity: mapSeverity(f.severity),
    source: f.service ?? 'Cloud Posture', resource: f.resource ?? 'unknown',
    firstSeen: f.createdAt ?? new Date().toISOString(),
    status: mapStatus(f.status), score: f.severity === 'critical' ? 95 : f.severity === 'high' ? 75 : 50,
  };
}

function violationToItem(v: ApiViolation): InboxItem {
  return {
    id: `agent-${v.id}`, title: v.title ?? `Agent Violation ${v.id}`,
    category: 'agent' as Category, severity: mapSeverity(v.severity),
    source: 'Agent Monitor', resource: v.instanceId ?? 'unknown',
    firstSeen: v.createdAt ?? new Date().toISOString(),
    status: mapStatus(v.status), score: v.severity === 'critical' ? 90 : v.severity === 'high' ? 70 : 45,
  };
}

export async function fetchSecurityInbox(): Promise<InboxItem[]> {
  const [incidents, findings, violations] = await Promise.allSettled([
    fetch('/api/proxy/security/incidents').then((r) => r.json()),
    fetch('/api/proxy/cloud/findings').then((r) => r.json()),
    fetch('/api/proxy/agents/violations').then((r) => r.json()),
  ]);

  const items: InboxItem[] = [];

  if (incidents.status === 'fulfilled' && Array.isArray(incidents.value?.data)) {
    items.push(...incidents.value.data.map(incidentToItem));
  }
  if (findings.status === 'fulfilled' && Array.isArray(findings.value?.data)) {
    items.push(...findings.value.data.map(findingToItem));
  }
  if (violations.status === 'fulfilled' && Array.isArray(violations.value?.data)) {
    items.push(...violations.value.data.map(violationToItem));
  }

  return items;
}
