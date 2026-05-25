export const FRAMEWORKS = [
  'SOC 2', 'ISO 27001', 'NIST CSF', 'CIS', 'HIPAA',
  'GDPR', 'PCI-DSS', 'OASF', 'FedRAMP', 'Custom',
] as const;

export type Framework = (typeof FRAMEWORKS)[number];

export const CATEGORIES = [
  'Access Control', 'Data Protection', 'Incident Response', 'Monitoring',
  'Network Security', 'Asset Management', 'Risk Management', 'Configuration',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ControlDetail {
  name: string;
  status: 'pass' | 'fail' | 'partial';
  evidenceCount: number;
  lastAssessed: string;
}

export interface CellData {
  score: number;
  applicable: boolean;
  controls: ControlDetail[];
}

export type HeatmapData = Record<Framework, Record<Category, CellData>>;
