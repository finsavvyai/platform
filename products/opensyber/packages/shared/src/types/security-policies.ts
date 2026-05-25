// ---- Security Policies ----

export type PolicyType =
  | 'network_allowlist'
  | 'network_blocklist'
  | 'file_path_rules'
  | 'shell_command_rules'
  | 'ip_allowlist'
  | 'rate_limit';

export interface SecurityPolicy {
  id: string;
  instanceId: string;
  policyType: PolicyType;
  name: string;
  rules: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkRule {
  domain: string;
  ports?: number[];
  description?: string;
}

export interface FilePathRule {
  path: string;
  action: 'allow' | 'deny';
  description?: string;
}

export interface ShellCommandRule {
  pattern: string;
  action: 'allow' | 'deny';
  description?: string;
}

// ---- Incidents ----

export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Incident {
  id: string;
  instanceId: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  rootCause: string | null;
  remediation: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export type IncidentEventType = 'status_change' | 'comment' | 'evidence' | 'assignment';

export interface IncidentEvent {
  id: string;
  incidentId: string;
  eventType: IncidentEventType;
  content: string;
  authorId: string | null;
  createdAt: string;
}

// ---- Alert Rules & Alerts ----

export interface AlertRule {
  id: string;
  instanceId: string;
  name: string;
  eventType: string;
  severityFilter: string | null;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  instanceId: string;
  alertRuleId: string;
  severity: import('./security-events.js').Severity;
  title: string;
  details: string | null;
  status: AlertStatus;
  triggeredCount: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

// ---- Notification Channels ----

export type ChannelType = 'email' | 'webhook' | 'slack';

export interface NotificationChannel {
  id: string;
  userId: string;
  channelType: ChannelType;
  name: string;
  config: string;
  isActive: boolean;
  createdAt: string;
}
