/**
 * PipeWarden Integration Bridge
 *
 * Bridges the SDLC.ai compliance engine with PipeWarden for enterprise-grade
 * pipeline security. Translates SDLC DLP findings into PipeWarden format,
 * syncs OPA policies, and generates compliance reports.
 */

import { FastPIIDetector, PIIType, MaskingStrategy } from '@sdlc/dlp';
import type { PIIMatch } from '@sdlc/dlp';
import type {
  DLPFinding,
  OPAPolicy,
  ComplianceReport,
} from './pipewarden-types';
import { getDefaultPolicies as getDefaultPoliciesFn } from './pipewarden-defaults';

export type {
  DLPFinding,
  OPAPolicy,
  OPARule,
  ComplianceReport,
  PolicyViolation,
} from './pipewarden-types';
export { getDefaultPolicies } from './pipewarden-defaults';

/**
 * Bridge between SDLC compliance engine and PipeWarden.
 * Translates SDLC findings into PipeWarden format and vice versa.
 */
export class PipeWardenBridge {
  private pipewardenUrl: string;
  private dlpDetector: FastPIIDetector;
  private policyCache: Map<string, OPAPolicy>;

  constructor(pipewardenUrl: string) {
    this.pipewardenUrl = pipewardenUrl.replace(/\/$/, '');
    this.dlpDetector = new FastPIIDetector({
      enabled: true,
      defaultStrategy: MaskingStrategy.REDACT,
      strategyOverrides: {},
      confidenceThreshold: 0.5,
    });
    this.policyCache = new Map();
  }

  /** Push DLP findings from SDLC to PipeWarden. */
  async pushDLPFindings(findings: DLPFinding[]): Promise<void> {
    const payload = {
      findings: findings.map((f) => ({
        pattern: f.pattern,
        match: f.match,
        file: f.file,
        line: f.line,
        severity: f.severity,
        category: f.category,
        confidence: f.confidence,
      })),
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${this.pipewardenUrl}/api/dlp/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to push DLP findings: ${response.status} ${response.statusText}`,
      );
    }
  }

  /** Sync OPA policies from SDLC to PipeWarden. */
  async syncPolicies(policies: OPAPolicy[]): Promise<void> {
    const payload = {
      policies: policies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        severity: p.severity,
        enforced: p.enforced,
        rules: p.rules,
      })),
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${this.pipewardenUrl}/api/policies/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to sync policies: ${response.status} ${response.statusText}`,
      );
    }

    for (const policy of policies) {
      this.policyCache.set(policy.id, policy);
    }
  }

  /** Get compliance report from PipeWarden for a connection. */
  async getComplianceReport(connectionName: string): Promise<ComplianceReport> {
    const response = await fetch(
      `${this.pipewardenUrl}/api/compliance/report/${encodeURIComponent(connectionName)}`,
      { method: 'GET' },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get compliance report: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Partial<ComplianceReport>;
    return {
      connectionName: data.connectionName ?? connectionName,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      dlpFindings: data.dlpFindings ?? [],
      policyViolations: data.policyViolations ?? [],
      riskScore: data.riskScore ?? 0,
      summary: data.summary ?? '',
    };
  }

  /** Convert SDLC DLP findings to PipeWarden findings. */
  convertSDLCFindingsToPipeWarden(sdlcMatches: PIIMatch[]): DLPFinding[] {
    const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      [PIIType.CREDIT_CARD]: 'critical',
      [PIIType.SSN]: 'critical',
      [PIIType.EMAIL]: 'high',
      [PIIType.PHONE]: 'high',
      [PIIType.IP_ADDRESS]: 'medium',
      [PIIType.DOB]: 'medium',
    };

    return sdlcMatches.map((match) => ({
      pattern: `PII Type: ${match.piiType}`,
      match: match.matchedText,
      file: 'unknown',
      line: 0,
      severity: severityMap[match.piiType] ?? 'medium',
      category: 'data-exposure',
      confidence: match.confidence,
    }));
  }

  /** Scan pipeline configuration content using SDLC DLP detector. */
  scanPipelineConfig(content: string): DLPFinding[] {
    const result = this.dlpDetector.scan(content);

    return result.matches.map((match) => ({
      pattern: match.piiType,
      match: match.redactedLabel,
      file: 'pipeline.yml',
      line: 0,
      severity: match.confidence > 0.95 ? 'critical' : 'high',
      category: 'secrets',
      confidence: match.confidence,
    }));
  }

  /** Return the default PipeWarden policy set shipped with SDLC. */
  getDefaultPolicies(): OPAPolicy[] {
    return getDefaultPoliciesFn();
  }
}
