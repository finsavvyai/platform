export interface AlertRuleTemplate {
  name: string;
  eventType: string;
  severityFilter: string | null;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
}

export const DEFAULT_ALERT_RULES: AlertRuleTemplate[] = [
  {
    name: 'Brute Force Detection',
    eventType: 'brute_force_attempt',
    severityFilter: null,
    threshold: 5,
    windowMinutes: 15,
    cooldownMinutes: 60,
  },
  {
    name: 'Credential Access Alert',
    eventType: 'credential_access',
    severityFilter: 'critical',
    threshold: 1,
    windowMinutes: 5,
    cooldownMinutes: 30,
  },
  {
    name: 'File Integrity Violation',
    eventType: 'file_access_violation',
    severityFilter: null,
    threshold: 3,
    windowMinutes: 30,
    cooldownMinutes: 60,
  },
  {
    name: 'Unauthorized Network Access',
    eventType: 'unauthorized_network',
    severityFilter: null,
    threshold: 5,
    windowMinutes: 10,
    cooldownMinutes: 30,
  },
  {
    name: 'Skill Blocked Alert',
    eventType: 'skill_blocked',
    severityFilter: null,
    threshold: 1,
    windowMinutes: 60,
    cooldownMinutes: 120,
  },
  {
    name: 'Anomaly Burst Detection',
    eventType: 'anomaly_detected',
    severityFilter: 'warning',
    threshold: 10,
    windowMinutes: 60,
    cooldownMinutes: 120,
  },
  {
    name: 'Critical Event Escalation',
    eventType: '*',
    severityFilter: 'critical',
    threshold: 3,
    windowMinutes: 30,
    cooldownMinutes: 60,
  },
];
