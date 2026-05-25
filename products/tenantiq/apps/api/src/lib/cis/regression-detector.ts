/**
 * CIS regression detector: compare two scan results, detect score decreases.
 * Flags regressions by section when score drops below threshold.
 */

export interface ScanSnapshot {
  overallScore: number;
  sections: SectionScore[];
}

export interface SectionScore {
  id: string;
  name: string;
  score: number;
  passCount: number;
  failCount: number;
}

export interface SectionRegression {
  sectionId: string;
  sectionName: string;
  beforeScore: number;
  afterScore: number;
  delta: number;
  newFailures: number;
}

export interface RegressionResult {
  regressed: boolean;
  scoreDelta: number;
  beforeScore: number;
  afterScore: number;
  sections: SectionRegression[];
}

/** Default threshold: flag regression when overall score drops by more than this. */
const DEFAULT_THRESHOLD = 5;

/**
 * Compare two CIS scan snapshots and detect regressions.
 * @param before - The baseline scan result (e.g., pre-deploy)
 * @param after  - The new scan result (e.g., post-deploy)
 * @param threshold - Minimum score decrease to flag as regression (default: 5)
 */
export function detectRegressions(
  before: ScanSnapshot,
  after: ScanSnapshot,
  threshold = DEFAULT_THRESHOLD,
): RegressionResult {
  const scoreDelta = after.overallScore - before.overallScore;
  const sectionRegressions = findSectionRegressions(before, after);

  const regressed = scoreDelta <= -threshold || sectionRegressions.length > 0;

  return {
    regressed,
    scoreDelta,
    beforeScore: before.overallScore,
    afterScore: after.overallScore,
    sections: sectionRegressions,
  };
}

function findSectionRegressions(
  before: ScanSnapshot,
  after: ScanSnapshot,
): SectionRegression[] {
  const beforeMap = new Map(before.sections.map((s) => [s.id, s]));
  const regressions: SectionRegression[] = [];

  for (const afterSection of after.sections) {
    const beforeSection = beforeMap.get(afterSection.id);
    if (!beforeSection) continue;

    const delta = afterSection.score - beforeSection.score;
    const newFailures = afterSection.failCount - beforeSection.failCount;

    if (delta < 0) {
      regressions.push({
        sectionId: afterSection.id,
        sectionName: afterSection.name,
        beforeScore: beforeSection.score,
        afterScore: afterSection.score,
        delta,
        newFailures: Math.max(0, newFailures),
      });
    }
  }

  return regressions.sort((a, b) => a.delta - b.delta);
}
