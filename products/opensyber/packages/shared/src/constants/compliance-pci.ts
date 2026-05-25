import type { ComplianceControl } from '../types/security.js';

export const PCI_DSS_CONTROLS: ComplianceControl[] = [
  { id: 'pci-1', name: 'Network Security Controls', category: 'Network Security', description: 'Install and maintain network security controls', framework: 'pci_dss' },
  { id: 'pci-2', name: 'Secure Configuration', category: 'Secure Configuration', description: 'Apply secure configurations to all system components', framework: 'pci_dss' },
  { id: 'pci-3', name: 'Protect Stored Data', category: 'Data Protection', description: 'Protect stored account data with strong cryptography', framework: 'pci_dss' },
  { id: 'pci-4', name: 'Encrypt Transmissions', category: 'Data Protection', description: 'Protect cardholder data with strong cryptography during transmission', framework: 'pci_dss' },
  { id: 'pci-5', name: 'Anti-Malware', category: 'Malware Protection', description: 'Protect systems against malicious software', framework: 'pci_dss' },
  { id: 'pci-6', name: 'Secure Development', category: 'Secure Development', description: 'Develop and maintain secure systems and software', framework: 'pci_dss' },
  { id: 'pci-7', name: 'Restrict Access', category: 'Access Control', description: 'Restrict access to system components by business need-to-know', framework: 'pci_dss' },
  { id: 'pci-8', name: 'Identify and Authenticate', category: 'Access Control', description: 'Identify users and authenticate access to system components', framework: 'pci_dss' },
  { id: 'pci-9', name: 'Physical Access', category: 'Physical Security', description: 'Restrict physical access to cardholder data', framework: 'pci_dss' },
  { id: 'pci-10', name: 'Logging and Monitoring', category: 'Monitoring', description: 'Log and monitor all access to system components and data', framework: 'pci_dss' },
  { id: 'pci-11', name: 'Security Testing', category: 'Testing', description: 'Test security of systems and networks regularly', framework: 'pci_dss' },
  { id: 'pci-12', name: 'Security Policy', category: 'Policy', description: 'Support information security with organizational policies', framework: 'pci_dss' },
];
