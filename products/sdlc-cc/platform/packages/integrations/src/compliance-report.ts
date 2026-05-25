/**
 * SDLC.ai Compliance Report Generator
 *
 * Maps PipeWarden findings to compliance frameworks:
 * SOC2, HIPAA, GDPR, PCI-DSS.
 */

import type {
  ComplianceFramework,
  ComplianceMapping,
  ComplianceReport,
  ComplianceStatus,
  PipeWardenFinding,
} from './compliance-report-types';
import { CONTROL_MAPPINGS, getFrameworks } from './compliance-controls';

export type {
  ComplianceFramework,
  ComplianceMapping,
  ComplianceReport,
  ComplianceStatus,
  ControlDefinition,
  FindingCategory,
  PipeWardenFinding,
  Severity,
} from './compliance-report-types';
export { CONTROL_MAPPINGS, getFrameworks } from './compliance-controls';
export {
  exportReportCSV,
  exportReportJSON,
} from './compliance-report-exporters';

/** Generate compliance report from PipeWarden findings for a single framework. */
export function generateComplianceReport(
  findings: PipeWardenFinding[],
  framework: ComplianceFramework,
): ComplianceReport {
  const frameworkControls = CONTROL_MAPPINGS[framework] ?? {};
  const mappings: ComplianceMapping[] = [];

  for (const control in frameworkControls) {
    const controlDef = frameworkControls[control];
    const applicableFindings = findings.filter((f) =>
      controlDef.categories.includes(f.category),
    );

    for (const finding of applicableFindings) {
      mappings.push({
        framework,
        control,
        controlDescription: controlDef.description,
        status: determineStatus(finding),
        finding,
        evidence: finding.evidence ?? `Finding: ${finding.id}`,
        remediation: getRemediation(finding),
      });
    }
  }

  const summary = {
    total: mappings.length,
    passed: mappings.filter((m) => m.status === 'pass').length,
    failed: mappings.filter((m) => m.status === 'fail').length,
    partial: mappings.filter((m) => m.status === 'partial').length,
  };

  return {
    framework,
    generatedAt: new Date(),
    summary,
    mappings,
  };
}

/** Generate compliance reports for all supported frameworks. */
export function generateAllComplianceReports(
  findings: PipeWardenFinding[],
): ComplianceReport[] {
  return getFrameworks().map((framework) =>
    generateComplianceReport(findings, framework),
  );
}

/** Determine compliance status from finding severity and resolution. */
function determineStatus(finding: PipeWardenFinding): ComplianceStatus {
  if (finding.resolved) {
    return 'pass';
  }
  switch (finding.severity) {
    case 'critical':
    case 'high':
      return 'fail';
    case 'medium':
    case 'low':
    default:
      return 'partial';
  }
}

/** Map a finding category to a canonical remediation statement. */
function getRemediation(finding: PipeWardenFinding): string {
  const remediationMap: Record<string, string> = {
    secrets:
      'Rotate exposed credentials immediately. Use a secure secret management system.',
    'branch-security':
      'Enforce branch protection rules. Require code review before merge.',
    'missing-tests':
      'Add automated tests to the pipeline. Ensure minimum coverage threshold.',
    permissions:
      'Review and restrict access permissions. Apply principle of least privilege.',
    'supply-chain':
      'Verify dependencies. Use trusted registries. Implement SBOM scanning.',
  };

  return (
    remediationMap[finding.category] ??
    'Review finding and implement appropriate controls.'
  );
}
