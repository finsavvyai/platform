// ============================================================
// Alert adapter — converts TenantIQ alerts to/from universal format
// ============================================================

import type { Alert, AlertCategory, Severity } from './types';
import type { UniversalAlert, UniversalComplianceControl } from './cross-project';

/** CIS control result shape used by the adapter */
export interface CISControlResult {
  id: string;
  controlId: string;
  framework: string;
  title: string;
  description: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'manual_review';
  severity: Severity;
  evidence: string;
  remediationScript?: string;
  lastChecked: number;
}

const CATEGORY_MAP: Record<AlertCategory, UniversalAlert['category']> = {
  security: 'security',
  compliance: 'compliance',
  optimization: 'cost',
  operational: 'performance',
};

const REVERSE_CATEGORY_MAP: Record<UniversalAlert['category'], AlertCategory> = {
  security: 'security',
  compliance: 'compliance',
  cost: 'optimization',
  performance: 'operational',
};

/**
 * Convert a TenantIQ alert to the universal alert format.
 * Maps TenantIQ-specific categories and builds the resource identifier.
 */
export function toUniversalAlert(
  alert: Alert,
  tenantId: string,
): UniversalAlert {
  return {
    id: `tenantiq:${alert.id}`,
    source: 'tenantiq',
    sourceId: alert.id,
    category: CATEGORY_MAP[alert.category],
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    affectedResource: `tenant:${tenantId}`,
    frameworks: inferFrameworks(alert),
    remediationSteps: alert.recommendedAction
      ? [alert.recommendedAction]
      : [],
    autoRemediable: alert.remediationType === 'automatic',
    confidence: severityToConfidence(alert.severity),
    detectedAt: new Date(alert.createdAt).getTime(),
    resolvedAt: alert.resolvedAt
      ? new Date(alert.resolvedAt).getTime()
      : undefined,
    metadata: {
      tenantId,
      ruleId: alert.ruleId,
      status: alert.status,
      businessImpact: alert.businessImpact,
      affectedResources: alert.affectedResources,
      resolvedBy: alert.resolvedBy,
    },
  };
}

/**
 * Convert a universal alert back to a partial TenantIQ alert.
 * Only includes fields that map cleanly to the TenantIQ model.
 */
export function fromUniversalAlert(
  alert: UniversalAlert,
): Partial<Alert> {
  const severity = alert.severity === 'info' ? 'low' : alert.severity;
  return {
    id: alert.sourceId,
    severity,
    category: REVERSE_CATEGORY_MAP[alert.category],
    title: alert.title,
    description: alert.description,
    recommendedAction: alert.remediationSteps.length > 0
      ? alert.remediationSteps.join('; ')
      : null,
    remediationType: alert.autoRemediable ? 'automatic' : 'manual',
    status: 'active',
    createdAt: new Date(alert.detectedAt).toISOString(),
    resolvedAt: alert.resolvedAt
      ? new Date(alert.resolvedAt).toISOString()
      : null,
  };
}

/**
 * Convert a CIS control result to the universal compliance control format.
 */
export function toUniversalControl(
  cisResult: CISControlResult,
): UniversalComplianceControl {
  return {
    id: `tenantiq:${cisResult.id}`,
    framework: cisResult.framework,
    controlId: cisResult.controlId,
    title: cisResult.title,
    description: cisResult.description,
    status: cisResult.status,
    severity: cisResult.severity,
    evidence: cisResult.evidence,
    remediationScript: cisResult.remediationScript,
    lastChecked: cisResult.lastChecked,
  };
}

/** Infer compliance frameworks from alert category and title */
function inferFrameworks(alert: Alert): string[] {
  const frameworks: string[] = [];
  const text = `${alert.title} ${alert.description}`.toLowerCase();
  if (alert.category === 'compliance' || text.includes('cis'))
    frameworks.push('CIS-M365');
  if (text.includes('soc2') || text.includes('soc 2'))
    frameworks.push('SOC2');
  if (text.includes('hipaa')) frameworks.push('HIPAA');
  if (text.includes('nist')) frameworks.push('NIST');
  if (text.includes('gdpr')) frameworks.push('GDPR');
  return frameworks;
}

/** Map severity to a default confidence score */
function severityToConfidence(severity: Severity): number {
  const map: Record<Severity, number> = {
    critical: 0.95,
    high: 0.85,
    medium: 0.7,
    low: 0.5,
  };
  return map[severity];
}
