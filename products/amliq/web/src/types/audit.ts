export type AuditAction = 'screen_initiated' | 'alert_created' | 'alert_resolved' | 'config_updated' | 'list_imported' | 'export_generated';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;
  target: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}
