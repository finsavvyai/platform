export type Severity = 'critical' | 'high' | 'medium';

export interface RiskNode {
  id: string;
  label: string;
  severity: Severity;
  category: string;
}

export interface ToxicCombination {
  id: string;
  title: string;
  severity: Severity;
  blastRadius: { assets: number; dataStores: number };
  chain: RiskNode[];
  detectedAt: string;
  assetType: string;
}
