import type { ComplianceControl } from '../types/security.js';
import { HIPAA_CONTROLS } from './compliance-hipaa.js';
import { GDPR_CONTROLS } from './compliance-gdpr.js';
import { NIST_CSF_CONTROLS } from './compliance-nist.js';
import { PCI_DSS_CONTROLS } from './compliance-pci.js';

export { HIPAA_CONTROLS, GDPR_CONTROLS, NIST_CSF_CONTROLS, PCI_DSS_CONTROLS };

export const SOC2_CONTROLS: ComplianceControl[] = [
  { id: 'soc2-cc1.1', name: 'Security Policy Documentation', category: 'Common Criteria', description: 'Organization has documented security policies', framework: 'soc2' },
  { id: 'soc2-cc1.2', name: 'Board Oversight', category: 'Common Criteria', description: 'Board of directors demonstrates oversight of security', framework: 'soc2' },
  { id: 'soc2-cc2.1', name: 'Security Communication', category: 'Common Criteria', description: 'Security objectives are communicated internally', framework: 'soc2' },
  { id: 'soc2-cc3.1', name: 'Risk Assessment', category: 'Risk Assessment', description: 'Organization performs regular risk assessments', framework: 'soc2' },
  { id: 'soc2-cc3.2', name: 'Risk Mitigation', category: 'Risk Assessment', description: 'Identified risks have documented mitigations', framework: 'soc2' },
  { id: 'soc2-cc4.1', name: 'Monitoring Activities', category: 'Monitoring', description: 'Ongoing monitoring of security controls', framework: 'soc2' },
  { id: 'soc2-cc4.2', name: 'Deficiency Remediation', category: 'Monitoring', description: 'Security deficiencies are remediated timely', framework: 'soc2' },
  { id: 'soc2-cc5.1', name: 'Logical Access Controls', category: 'Logical Access', description: 'Logical access is restricted to authorized users', framework: 'soc2' },
  { id: 'soc2-cc5.2', name: 'Authentication Mechanisms', category: 'Logical Access', description: 'Strong authentication mechanisms are implemented', framework: 'soc2' },
  { id: 'soc2-cc5.3', name: 'Access Review', category: 'Logical Access', description: 'Access rights are reviewed periodically', framework: 'soc2' },
  { id: 'soc2-cc6.1', name: 'Encryption in Transit', category: 'System Operations', description: 'Data is encrypted during transmission', framework: 'soc2' },
  { id: 'soc2-cc6.2', name: 'Encryption at Rest', category: 'System Operations', description: 'Sensitive data is encrypted at rest', framework: 'soc2' },
  { id: 'soc2-cc6.3', name: 'Vulnerability Management', category: 'System Operations', description: 'Vulnerabilities are identified and remediated', framework: 'soc2' },
  { id: 'soc2-cc7.1', name: 'Incident Detection', category: 'Incident Response', description: 'Security incidents are detected promptly', framework: 'soc2' },
  { id: 'soc2-cc7.2', name: 'Incident Response Plan', category: 'Incident Response', description: 'Documented incident response procedures exist', framework: 'soc2' },
  { id: 'soc2-cc7.3', name: 'Incident Remediation', category: 'Incident Response', description: 'Incidents are remediated and root causes addressed', framework: 'soc2' },
  { id: 'soc2-cc8.1', name: 'Change Management', category: 'Change Management', description: 'Changes follow a documented change process', framework: 'soc2' },
  { id: 'soc2-cc9.1', name: 'Vendor Management', category: 'Risk Mitigation', description: 'Third-party risks are assessed and managed', framework: 'soc2' },
  { id: 'soc2-a1.1', name: 'Availability Monitoring', category: 'Availability', description: 'System availability is monitored continuously', framework: 'soc2' },
  { id: 'soc2-a1.2', name: 'Disaster Recovery', category: 'Availability', description: 'Disaster recovery plan is documented and tested', framework: 'soc2' },
];

export const ISO27001_CONTROLS: ComplianceControl[] = [
  { id: 'iso-a5.1', name: 'Information Security Policy', category: 'Organizational', description: 'Security policies are defined and approved', framework: 'iso27001' },
  { id: 'iso-a6.1', name: 'Security Roles', category: 'Organizational', description: 'Security roles and responsibilities are defined', framework: 'iso27001' },
  { id: 'iso-a7.1', name: 'Asset Inventory', category: 'Asset Management', description: 'All assets are identified and inventoried', framework: 'iso27001' },
  { id: 'iso-a7.2', name: 'Asset Classification', category: 'Asset Management', description: 'Assets are classified by sensitivity', framework: 'iso27001' },
  { id: 'iso-a8.1', name: 'Access Control Policy', category: 'Access Control', description: 'Access control policy is established', framework: 'iso27001' },
  { id: 'iso-a8.2', name: 'User Access Management', category: 'Access Control', description: 'User access is managed throughout lifecycle', framework: 'iso27001' },
  { id: 'iso-a8.3', name: 'Privileged Access', category: 'Access Control', description: 'Privileged access is restricted and monitored', framework: 'iso27001' },
  { id: 'iso-a10.1', name: 'Cryptographic Controls', category: 'Cryptography', description: 'Cryptographic controls are implemented', framework: 'iso27001' },
  { id: 'iso-a12.1', name: 'Operating Procedures', category: 'Operations', description: 'Operating procedures are documented', framework: 'iso27001' },
  { id: 'iso-a12.4', name: 'Event Logging', category: 'Operations', description: 'Security events are logged and monitored', framework: 'iso27001' },
  { id: 'iso-a12.6', name: 'Technical Vulnerability Management', category: 'Operations', description: 'Technical vulnerabilities are managed', framework: 'iso27001' },
  { id: 'iso-a13.1', name: 'Network Security', category: 'Communications', description: 'Networks are managed and controlled', framework: 'iso27001' },
  { id: 'iso-a16.1', name: 'Incident Management', category: 'Incident Management', description: 'Security incidents are managed effectively', framework: 'iso27001' },
  { id: 'iso-a17.1', name: 'Business Continuity', category: 'Continuity', description: 'Information security continuity is planned', framework: 'iso27001' },
  { id: 'iso-a18.1', name: 'Compliance Monitoring', category: 'Compliance', description: 'Compliance with policies is regularly reviewed', framework: 'iso27001' },
];

export const CIS_CONTROLS: ComplianceControl[] = [
  { id: 'cis-1.1', name: 'Hardware Asset Inventory', category: 'Inventory', description: 'Maintain inventory of hardware assets', framework: 'cis' },
  { id: 'cis-2.1', name: 'Software Asset Inventory', category: 'Inventory', description: 'Maintain inventory of software assets', framework: 'cis' },
  { id: 'cis-3.1', name: 'Data Classification', category: 'Data Protection', description: 'Establish data classification scheme', framework: 'cis' },
  { id: 'cis-3.6', name: 'Data Encryption', category: 'Data Protection', description: 'Encrypt data on end-user devices', framework: 'cis' },
  { id: 'cis-4.1', name: 'Secure Configuration', category: 'Secure Configuration', description: 'Establish secure configuration processes', framework: 'cis' },
  { id: 'cis-4.7', name: 'Firewall Configuration', category: 'Secure Configuration', description: 'Manage default deny firewall rules', framework: 'cis' },
  { id: 'cis-5.1', name: 'Account Management', category: 'Account Management', description: 'Establish account management process', framework: 'cis' },
  { id: 'cis-5.4', name: 'MFA Implementation', category: 'Account Management', description: 'Require MFA for administrative access', framework: 'cis' },
  { id: 'cis-6.1', name: 'Access Control', category: 'Access Control', description: 'Establish access granting process', framework: 'cis' },
  { id: 'cis-7.1', name: 'Vulnerability Management', category: 'Vulnerability Management', description: 'Establish vulnerability management process', framework: 'cis' },
  { id: 'cis-7.5', name: 'Automated Patching', category: 'Vulnerability Management', description: 'Perform automated patch management', framework: 'cis' },
  { id: 'cis-8.1', name: 'Audit Log Management', category: 'Audit Logging', description: 'Establish audit log management process', framework: 'cis' },
  { id: 'cis-8.5', name: 'Log Collection', category: 'Audit Logging', description: 'Collect detailed audit logs', framework: 'cis' },
  { id: 'cis-9.1', name: 'Network Protection', category: 'Network', description: 'Establish network monitoring and defense', framework: 'cis' },
  { id: 'cis-17.1', name: 'Incident Response Plan', category: 'Incident Response', description: 'Designate incident response personnel', framework: 'cis' },
];

export const COMPLIANCE_FRAMEWORKS = {
  soc2: { name: 'SOC 2 Type II', controls: SOC2_CONTROLS },
  iso27001: { name: 'ISO 27001:2022', controls: ISO27001_CONTROLS },
  cis: { name: 'CIS Controls v8', controls: CIS_CONTROLS },
  hipaa: { name: 'HIPAA', controls: HIPAA_CONTROLS },
  gdpr: { name: 'GDPR', controls: GDPR_CONTROLS },
  nist_csf: { name: 'NIST CSF', controls: NIST_CSF_CONTROLS },
  pci_dss: { name: 'PCI-DSS v4.0', controls: PCI_DSS_CONTROLS },
} as const;
