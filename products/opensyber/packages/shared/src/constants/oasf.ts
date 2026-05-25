/**
 * OpenSyber AI Agent Security Framework (OASF) 1.0
 *
 * 15 controls for AI coding agent governance.
 * Maps to SOC 2, ISO 27001, and NIST CSF frameworks.
 */
import type { OasfControl, OasfCategory } from './oasf-types.js';

export type { OasfControl, OasfCategory, OasfEvidenceType, OasfStatus } from './oasf-types.js';

export const OASF_CONTROLS: OasfControl[] = [
  // -- Monitoring (4 controls) --
  {
    id: 'OASF-01', name: 'Agent Session Monitoring',
    description: 'All AI agent sessions are monitored and logged.',
    category: 'monitoring', evidenceType: 'agent_activity_log',
    soc2Mapping: ['CC4.1', 'CC7.1'], iso27001Mapping: ['A.12.4.1'], nistCsfMapping: ['DE.CM-1', 'DE.CM-3'],
  },
  {
    id: 'OASF-03', name: 'Human Review Within 24h',
    description: 'Agent activity is reviewed by a human within 24 hours.',
    category: 'monitoring', evidenceType: 'audit_review_cadence',
    soc2Mapping: ['CC4.2', 'CC7.2'], iso27001Mapping: ['A.12.4.1', 'A.16.1.4'], nistCsfMapping: ['RS.AN-1'],
  },
  {
    id: 'OASF-04', name: 'Secret Detection Active',
    description: 'Secret detection is active on all agent file operations.',
    category: 'monitoring', evidenceType: 'secret_detection_log',
    soc2Mapping: ['CC6.1', 'CC6.7'], iso27001Mapping: ['A.10.1.1'], nistCsfMapping: ['PR.DS-1', 'PR.DS-5'],
  },
  {
    id: 'OASF-10', name: 'Anomalous Behavior Alerting',
    description: 'Anomalous agent behavior triggers automated alerts.',
    category: 'monitoring', evidenceType: 'alert_rule_config',
    soc2Mapping: ['CC7.1', 'CC7.2'], iso27001Mapping: ['A.12.4.1', 'A.16.1.2'], nistCsfMapping: ['DE.AE-2', 'DE.AE-5'],
  },

  // -- Access Control (5 controls) --
  {
    id: 'OASF-02', name: 'Production Secret Step-Up Approval',
    description: 'Agents cannot access production secrets without step-up approval.',
    category: 'access_control', evidenceType: 'jit_access_config',
    soc2Mapping: ['CC6.1', 'CC6.3'], iso27001Mapping: ['A.9.2.3', 'A.9.4.1'], nistCsfMapping: ['PR.AC-1', 'PR.AC-4'],
  },
  {
    id: 'OASF-05', name: 'Agent Session Isolation',
    description: 'Agent sessions are isolated from production environments.',
    category: 'access_control', evidenceType: 'sandbox_config',
    soc2Mapping: ['CC6.1', 'CC6.6'], iso27001Mapping: ['A.12.1.4', 'A.14.2.6'], nistCsfMapping: ['PR.AC-5', 'PR.DS-5'],
  },
  {
    id: 'OASF-06', name: 'Network Access Restriction',
    description: 'Agent network access is restricted to declared domains only.',
    category: 'access_control', evidenceType: 'network_policy',
    soc2Mapping: ['CC6.1', 'CC6.6'], iso27001Mapping: ['A.13.1.1', 'A.13.1.3'], nistCsfMapping: ['PR.AC-5', 'PR.PT-4'],
  },
  {
    id: 'OASF-12', name: 'MFA for Agent Management',
    description: 'Multi-factor authentication is enforced for agent management.',
    category: 'access_control', evidenceType: 'mfa_config',
    soc2Mapping: ['CC6.1', 'CC6.2'], iso27001Mapping: ['A.9.4.2'], nistCsfMapping: ['PR.AC-1', 'PR.AC-7'],
  },
  {
    id: 'OASF-13', name: 'RBAC for Agent Provisioning',
    description: 'Role-based access controls limit agent provisioning.',
    category: 'access_control', evidenceType: 'rbac_config',
    soc2Mapping: ['CC6.2', 'CC6.3'], iso27001Mapping: ['A.9.2.1', 'A.9.2.2'], nistCsfMapping: ['PR.AC-4'],
  },

  // -- Supply Chain (3 controls) --
  {
    id: 'OASF-07', name: 'Credential Rotation Schedule',
    description: 'Agent credentials are rotated on a defined schedule.',
    category: 'supply_chain', evidenceType: 'rotation_policy',
    soc2Mapping: ['CC6.1', 'CC6.2'], iso27001Mapping: ['A.9.2.4', 'A.9.3.1'], nistCsfMapping: ['PR.AC-1'],
  },
  {
    id: 'OASF-08', name: 'Dependency Scanning',
    description: 'Supply chain dependencies are scanned before agent installation.',
    category: 'supply_chain', evidenceType: 'ci_scan_config',
    soc2Mapping: ['CC6.1', 'CC7.1'], iso27001Mapping: ['A.12.5.1', 'A.12.6.1'], nistCsfMapping: ['PR.DS-6', 'DE.CM-8'],
  },
  {
    id: 'OASF-09', name: 'Skill Package Verification',
    description: 'Agent skill packages are verified before execution.',
    category: 'supply_chain', evidenceType: 'skill_verification',
    soc2Mapping: ['CC6.1', 'CC8.1'], iso27001Mapping: ['A.12.5.1', 'A.14.2.7'], nistCsfMapping: ['PR.DS-6', 'PR.IP-1'],
  },

  // -- Governance (3 controls) --
  {
    id: 'OASF-11', name: 'Audit Log Retention',
    description: 'Agent activity audit logs are retained per compliance requirements.',
    category: 'governance', evidenceType: 'audit_retention',
    soc2Mapping: ['CC8.1', 'CC7.3'], iso27001Mapping: ['A.12.4.1', 'A.12.4.2'], nistCsfMapping: ['PR.PT-1', 'DE.AE-3'],
  },
  {
    id: 'OASF-14', name: 'Blast Radius Assessment',
    description: 'Agent blast radius is assessed and documented.',
    category: 'governance', evidenceType: 'attack_path_analysis',
    soc2Mapping: ['CC3.1', 'CC3.2'], iso27001Mapping: ['A.12.6.1', 'A.18.2.3'], nistCsfMapping: ['ID.RA-1', 'ID.RA-5'],
  },
  {
    id: 'OASF-15', name: 'Quarterly Compliance Assessment',
    description: 'Compliance posture is assessed at least quarterly.',
    category: 'governance', evidenceType: 'compliance_report',
    soc2Mapping: ['CC4.1', 'CC4.2'], iso27001Mapping: ['A.18.2.1', 'A.18.2.2'], nistCsfMapping: ['ID.GV-4', 'DE.DP-5'],
  },
] as const;

export const OASF_CATEGORIES: OasfCategory[] = [
  'monitoring', 'access_control', 'supply_chain', 'governance',
];
