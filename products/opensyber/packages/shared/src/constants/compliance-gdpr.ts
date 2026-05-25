import type { ComplianceControl } from '../types/security.js';

export const GDPR_CONTROLS: ComplianceControl[] = [
  { id: 'gdpr-art5', name: 'Principles of Processing', category: 'Core Principles', description: 'Personal data processed lawfully, fairly, and transparently', framework: 'gdpr' },
  { id: 'gdpr-art6', name: 'Lawfulness of Processing', category: 'Core Principles', description: 'Processing has valid legal basis', framework: 'gdpr' },
  { id: 'gdpr-art25', name: 'Data Protection by Design', category: 'Design & Default', description: 'Data protection integrated into processing activities', framework: 'gdpr' },
  { id: 'gdpr-art30', name: 'Records of Processing', category: 'Accountability', description: 'Maintain records of processing activities', framework: 'gdpr' },
  { id: 'gdpr-art32a', name: 'Encryption of Data', category: 'Security', description: 'Implement pseudonymization and encryption of personal data', framework: 'gdpr' },
  { id: 'gdpr-art32b', name: 'Confidentiality and Integrity', category: 'Security', description: 'Ensure ongoing confidentiality, integrity, and availability', framework: 'gdpr' },
  { id: 'gdpr-art32c', name: 'Resilience of Systems', category: 'Security', description: 'Ability to restore access to personal data after incident', framework: 'gdpr' },
  { id: 'gdpr-art32d', name: 'Testing and Evaluation', category: 'Security', description: 'Process for regularly testing security of processing', framework: 'gdpr' },
  { id: 'gdpr-art33', name: 'Breach Notification', category: 'Breach Response', description: 'Notify supervisory authority within 72 hours of breach', framework: 'gdpr' },
  { id: 'gdpr-art34', name: 'Communication to Data Subjects', category: 'Breach Response', description: 'Communicate breach to affected data subjects', framework: 'gdpr' },
  { id: 'gdpr-art35', name: 'Data Protection Impact Assessment', category: 'Risk Management', description: 'Perform DPIA for high-risk processing operations', framework: 'gdpr' },
  { id: 'gdpr-art37', name: 'Data Protection Officer', category: 'Governance', description: 'Designate DPO where required by regulation', framework: 'gdpr' },
];
