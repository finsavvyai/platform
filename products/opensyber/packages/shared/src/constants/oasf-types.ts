/**
 * OASF Type Definitions
 *
 * Types for the OpenSyber AI Agent Security Framework (OASF) 1.0.
 */

export interface OasfControl {
  id: string;
  name: string;
  description: string;
  category: OasfCategory;
  soc2Mapping: string[];
  iso27001Mapping: string[];
  nistCsfMapping: string[];
  evidenceType: OasfEvidenceType;
}

export type OasfCategory =
  | 'monitoring'
  | 'access_control'
  | 'supply_chain'
  | 'governance';

export type OasfEvidenceType =
  | 'agent_activity_log'
  | 'jit_access_config'
  | 'audit_review_cadence'
  | 'secret_detection_log'
  | 'sandbox_config'
  | 'network_policy'
  | 'rotation_policy'
  | 'ci_scan_config'
  | 'skill_verification'
  | 'alert_rule_config'
  | 'audit_retention'
  | 'mfa_config'
  | 'rbac_config'
  | 'attack_path_analysis'
  | 'compliance_report';

export type OasfStatus = 'pass' | 'fail' | 'partial' | 'not_applicable';
