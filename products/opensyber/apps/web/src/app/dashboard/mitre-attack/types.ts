export interface Technique {
  id: string;
  name: string;
  coverage: 'full' | 'partial' | 'none';
  detections: number;
  lastSeen: string | null;
}

export interface Tactic {
  id: string;
  name: string;
  techniques: Technique[];
}

export const COVERAGE_COLORS: Record<Technique['coverage'], string> = {
  full: 'green-500',
  partial: 'amber-500',
  none: 'neutral-700',
};

export interface MitreStats {
  totalTechniques: number;
  fullCoverage: number;
  partialCoverage: number;
  noCoverage: number;
}

export function computeStats(tactics: Tactic[]): MitreStats {
  let total = 0;
  let full = 0;
  let partial = 0;
  let none = 0;
  for (const t of tactics) {
    for (const tech of t.techniques) {
      total++;
      if (tech.coverage === 'full') full++;
      else if (tech.coverage === 'partial') partial++;
      else none++;
    }
  }
  return { totalTechniques: total, fullCoverage: full, partialCoverage: partial, noCoverage: none };
}
