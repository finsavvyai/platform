import type { ComplianceControl } from '../types/security.js';

export const HIPAA_CONTROLS: ComplianceControl[] = [
  { id: 'hipaa-164.308a1', name: 'Security Management Process', category: 'Administrative Safeguards', description: 'Implement policies to prevent, detect, and correct security violations', framework: 'hipaa' },
  { id: 'hipaa-164.308a3', name: 'Workforce Security', category: 'Administrative Safeguards', description: 'Implement policies to ensure appropriate workforce access', framework: 'hipaa' },
  { id: 'hipaa-164.308a4', name: 'Information Access Management', category: 'Administrative Safeguards', description: 'Implement policies authorizing access to ePHI', framework: 'hipaa' },
  { id: 'hipaa-164.308a5', name: 'Security Awareness Training', category: 'Administrative Safeguards', description: 'Security awareness and training for all workforce', framework: 'hipaa' },
  { id: 'hipaa-164.308a6', name: 'Security Incident Procedures', category: 'Administrative Safeguards', description: 'Implement policies to address security incidents', framework: 'hipaa' },
  { id: 'hipaa-164.308a7', name: 'Contingency Plan', category: 'Administrative Safeguards', description: 'Establish policies for responding to emergencies', framework: 'hipaa' },
  { id: 'hipaa-164.308a8', name: 'Evaluation', category: 'Administrative Safeguards', description: 'Perform periodic technical and non-technical evaluation', framework: 'hipaa' },
  { id: 'hipaa-164.310a1', name: 'Facility Access Controls', category: 'Physical Safeguards', description: 'Limit physical access to electronic information systems', framework: 'hipaa' },
  { id: 'hipaa-164.310d1', name: 'Device and Media Controls', category: 'Physical Safeguards', description: 'Implement policies governing disposal and reuse of media', framework: 'hipaa' },
  { id: 'hipaa-164.312a1', name: 'Access Control', category: 'Technical Safeguards', description: 'Implement technical policies to limit ePHI access', framework: 'hipaa' },
  { id: 'hipaa-164.312b', name: 'Audit Controls', category: 'Technical Safeguards', description: 'Implement mechanisms to record and examine access', framework: 'hipaa' },
  { id: 'hipaa-164.312c1', name: 'Integrity Controls', category: 'Technical Safeguards', description: 'Implement policies to protect ePHI from improper alteration', framework: 'hipaa' },
  { id: 'hipaa-164.312d', name: 'Person Authentication', category: 'Technical Safeguards', description: 'Implement procedures to verify person seeking access', framework: 'hipaa' },
  { id: 'hipaa-164.312e1', name: 'Transmission Security', category: 'Technical Safeguards', description: 'Implement measures to guard against unauthorized access during transmission', framework: 'hipaa' },
  { id: 'hipaa-164.316', name: 'Policies and Documentation', category: 'Documentation', description: 'Implement policies, maintain documentation for 6 years', framework: 'hipaa' },
];
