/**
 * TenantIQ Integration Types
 * Types for receiving M365 alerts/findings from tenantiq via webhook.
 * Mirrors the tenantiq AlertCandidate shape with snake_case for wire format.
 */

export type TenantiqSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TenantiqCategory = 'security' | 'optimization' | 'compliance' | 'operational';
export type TenantiqSource = 'intel-engine' | 'remediation' | 'compliance-scan' | 'drift-detection';

export interface TenantiqAlert {
  rule_id: string;
  severity: TenantiqSeverity;
  category: TenantiqCategory;
  title: string;
  description: string;
  business_impact: string | null;
  recommended_action: string | null;
  affected_resources_count: number;
  tenant_id: string;
}

export interface TenantiqWebhookPayload {
  alerts: TenantiqAlert[];
  tenant_id: string;
  evaluated_at: string;
  source: TenantiqSource;
  connection_name: string;
}

export type OpenSyberSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export function mapTenantiqSeverity(severity: TenantiqSeverity): OpenSyberSeverity {
  const map: Record<TenantiqSeverity, OpenSyberSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };
  return map[severity] ?? 'info';
}
