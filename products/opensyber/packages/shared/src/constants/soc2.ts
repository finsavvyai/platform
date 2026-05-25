/**
 * SOC2 Trust Service Criteria Mapping
 *
 * Maps OASF 15 controls to SOC2 Trust Service Criteria (CC1-CC9, A1, PI1).
 * Used for SOC2 Type 1 readiness assessment.
 */
export interface Soc2ControlMapping {
  oasfId: string;
  oasfName: string;
  tsc: string;
  tscName: string;
  description: string;
}

export const SOC2_MAPPINGS: Soc2ControlMapping[] = [
  { oasfId: 'OASF-01', oasfName: 'Runtime Activity Logging', tsc: 'CC7.2', tscName: 'System Operations', description: 'Monitor system components for anomalies' },
  { oasfId: 'OASF-02', oasfName: 'Behavioral Policy Enforcement', tsc: 'CC6.1', tscName: 'Logical Access', description: 'Restrict logical access to information assets' },
  { oasfId: 'OASF-03', oasfName: 'Credential Vault Integration', tsc: 'CC6.6', tscName: 'Credential Management', description: 'Manage credentials and secrets securely' },
  { oasfId: 'OASF-04', oasfName: 'Network Segmentation', tsc: 'CC6.1', tscName: 'Logical Access', description: 'Network boundaries and access controls' },
  { oasfId: 'OASF-05', oasfName: 'Alerting & Notification', tsc: 'CC7.3', tscName: 'Change Detection', description: 'Detect and respond to security events' },
  { oasfId: 'OASF-06', oasfName: 'Vulnerability Scanning', tsc: 'CC7.1', tscName: 'Detection Mechanisms', description: 'Identify and evaluate vulnerabilities' },
  { oasfId: 'OASF-07', oasfName: 'Compliance Reporting', tsc: 'CC4.1', tscName: 'Monitoring Activities', description: 'Monitor internal controls effectiveness' },
  { oasfId: 'OASF-08', oasfName: 'Incident Response', tsc: 'CC7.4', tscName: 'Incident Response', description: 'Respond to identified security incidents' },
  { oasfId: 'OASF-09', oasfName: 'Skill Provenance', tsc: 'CC8.1', tscName: 'Change Management', description: 'Authorize and manage system changes' },
  { oasfId: 'OASF-10', oasfName: 'RBAC Enforcement', tsc: 'CC6.3', tscName: 'Role-Based Access', description: 'Manage access based on roles and responsibilities' },
  { oasfId: 'OASF-11', oasfName: 'Audit Trail Integrity', tsc: 'CC7.2', tscName: 'System Operations', description: 'Monitor audit logging infrastructure' },
  { oasfId: 'OASF-12', oasfName: 'Data Encryption', tsc: 'CC6.7', tscName: 'Encryption', description: 'Encrypt data in transit and at rest' },
  { oasfId: 'OASF-13', oasfName: 'Cloud Posture Management', tsc: 'CC6.1', tscName: 'Logical Access', description: 'Cloud infrastructure security posture' },
  { oasfId: 'OASF-14', oasfName: 'Attack Path Analysis', tsc: 'CC3.2', tscName: 'Risk Assessment', description: 'Identify and assess risks from attack paths' },
  { oasfId: 'OASF-15', oasfName: 'Multi-Tenancy Isolation', tsc: 'CC6.1', tscName: 'Logical Access', description: 'Tenant data isolation and boundaries' },
];

export const SOC2_TSC_CATEGORIES = {
  'CC1': 'Control Environment',
  'CC2': 'Communication and Information',
  'CC3': 'Risk Assessment',
  'CC4': 'Monitoring Activities',
  'CC5': 'Control Activities',
  'CC6': 'Logical and Physical Access Controls',
  'CC7': 'System Operations',
  'CC8': 'Change Management',
  'CC9': 'Risk Mitigation',
  'A1': 'Availability',
  'PI1': 'Processing Integrity',
} as const;

export type Soc2Category = keyof typeof SOC2_TSC_CATEGORIES;
