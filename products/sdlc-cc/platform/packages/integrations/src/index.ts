/**
 * @sdlc/integrations
 *
 * Bridges between the SDLC compliance engine and external enterprise tools.
 * Currently supported integrations:
 *   - PipeWarden (CI/CD pipeline security)
 *   - Compliance reporting (SOC2, HIPAA, GDPR, PCI-DSS)
 */

export {
  PipeWardenBridge,
  getDefaultPolicies,
} from './pipewarden';
export type {
  DLPFinding,
  OPAPolicy,
  OPARule,
  ComplianceReport as PipeWardenComplianceReport,
  PolicyViolation,
} from './pipewarden-types';

export {
  generateComplianceReport,
  generateAllComplianceReports,
  exportReportJSON,
  exportReportCSV,
  CONTROL_MAPPINGS,
  getFrameworks,
} from './compliance-report';
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
