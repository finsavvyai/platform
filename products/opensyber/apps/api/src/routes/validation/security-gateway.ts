import { z } from 'zod';

const validEventTypes = [
  'skill_blocked', 'skill_installed', 'skill_removed', 'anomaly_detected',
  'credential_access', 'unauthorized_network', 'file_access_violation',
  'update_applied', 'instance_hardened', 'brute_force_attempt',
] as const;

const validSeverities = ['info', 'warning', 'critical'] as const;

const validAuditActions = [
  'shell_exec', 'file_read', 'file_write', 'http_request',
  'credential_access', 'skill_install', 'skill_uninstall', 'config_change',
] as const;

const validVulnSeverities = ['critical', 'high', 'medium', 'low'] as const;

export const securityEventsSchema = z.object({
  events: z.array(z.object({
    eventType: z.string().min(1),
    severity: z.string().min(1),
    skillId: z.string().optional(),
    sourceIp: z.string().optional(),
    sourceCountry: z.string().optional(),
    details: z.string().optional(),
  })).min(1),
});

export const auditEntriesSchema = z.object({
  entries: z.array(z.object({
    action: z.string().min(1),
    skillId: z.string().optional(),
    details: z.string().optional(),
  })).min(1),
});

export const vulnerabilityScanSchema = z.object({
  scanner: z.string().min(1).default('unknown'),
  vulnerabilities: z.array(z.object({
    cveId: z.string().optional(),
    packageName: z.string().min(1),
    packageVersion: z.string().optional(),
    fixedVersion: z.string().optional(),
    severity: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
  })),
});
