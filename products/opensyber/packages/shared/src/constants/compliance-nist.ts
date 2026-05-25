import type { ComplianceControl } from '../types/security.js';

export const NIST_CSF_CONTROLS: ComplianceControl[] = [
  { id: 'nist-id.am', name: 'Asset Management', category: 'Identify', description: 'Physical and software assets are inventoried', framework: 'nist_csf' },
  { id: 'nist-id.ra', name: 'Risk Assessment', category: 'Identify', description: 'Organization understands cybersecurity risk', framework: 'nist_csf' },
  { id: 'nist-id.gv', name: 'Governance', category: 'Identify', description: 'Policies and procedures manage cybersecurity risk', framework: 'nist_csf' },
  { id: 'nist-pr.ac', name: 'Access Control', category: 'Protect', description: 'Access to assets is managed and limited', framework: 'nist_csf' },
  { id: 'nist-pr.at', name: 'Awareness and Training', category: 'Protect', description: 'Personnel are trained for security responsibilities', framework: 'nist_csf' },
  { id: 'nist-pr.ds', name: 'Data Security', category: 'Protect', description: 'Data is managed consistent with risk strategy', framework: 'nist_csf' },
  { id: 'nist-pr.ip', name: 'Information Protection', category: 'Protect', description: 'Security policies and protections are maintained', framework: 'nist_csf' },
  { id: 'nist-pr.ma', name: 'Maintenance', category: 'Protect', description: 'Maintenance and repairs are performed consistently', framework: 'nist_csf' },
  { id: 'nist-pr.pt', name: 'Protective Technology', category: 'Protect', description: 'Technical solutions manage security of systems', framework: 'nist_csf' },
  { id: 'nist-de.ae', name: 'Anomalies and Events', category: 'Detect', description: 'Anomalous activity is detected and analyzed', framework: 'nist_csf' },
  { id: 'nist-de.cm', name: 'Continuous Monitoring', category: 'Detect', description: 'Systems are monitored to identify events', framework: 'nist_csf' },
  { id: 'nist-de.dp', name: 'Detection Processes', category: 'Detect', description: 'Detection processes are maintained and tested', framework: 'nist_csf' },
  { id: 'nist-rs.rp', name: 'Response Planning', category: 'Respond', description: 'Response processes are executed during incidents', framework: 'nist_csf' },
  { id: 'nist-rs.co', name: 'Communications', category: 'Respond', description: 'Response activities are coordinated with stakeholders', framework: 'nist_csf' },
  { id: 'nist-rc.rp', name: 'Recovery Planning', category: 'Recover', description: 'Recovery processes are executed and maintained', framework: 'nist_csf' },
];
