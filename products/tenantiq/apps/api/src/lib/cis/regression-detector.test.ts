import { describe, expect, it } from 'vitest';
import { detectRegressions, type ScanSnapshot } from './regression-detector';

const baseline: ScanSnapshot = {
  overallScore: 85,
  sections: [
    { id: 's1', name: 'Identity', score: 90, passCount: 9, failCount: 1 },
    { id: 's2', name: 'Data Protection', score: 80, passCount: 8, failCount: 2 },
    { id: 's3', name: 'Access Control', score: 85, passCount: 17, failCount: 3 },
  ],
};

describe('CIS Regression Detector', () => {
  it('should detect no regression when scores improve', () => {
    const after: ScanSnapshot = {
      overallScore: 90,
      sections: [
        { id: 's1', name: 'Identity', score: 95, passCount: 10, failCount: 0 },
        { id: 's2', name: 'Data Protection', score: 85, passCount: 9, failCount: 1 },
        { id: 's3', name: 'Access Control', score: 90, passCount: 18, failCount: 2 },
      ],
    };
    const result = detectRegressions(baseline, after);
    expect(result.regressed).toBe(false);
    expect(result.scoreDelta).toBe(5);
    expect(result.sections).toHaveLength(0);
  });

  it('should detect regression when overall score drops past threshold', () => {
    const after: ScanSnapshot = {
      overallScore: 78,
      sections: [
        { id: 's1', name: 'Identity', score: 70, passCount: 7, failCount: 3 },
        { id: 's2', name: 'Data Protection', score: 80, passCount: 8, failCount: 2 },
        { id: 's3', name: 'Access Control', score: 85, passCount: 17, failCount: 3 },
      ],
    };
    const result = detectRegressions(baseline, after);
    expect(result.regressed).toBe(true);
    expect(result.scoreDelta).toBe(-7);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].sectionId).toBe('s1');
  });

  it('should flag individual section regressions even with small overall drop', () => {
    const after: ScanSnapshot = {
      overallScore: 83,
      sections: [
        { id: 's1', name: 'Identity', score: 85, passCount: 8, failCount: 2 },
        { id: 's2', name: 'Data Protection', score: 75, passCount: 7, failCount: 3 },
        { id: 's3', name: 'Access Control', score: 85, passCount: 17, failCount: 3 },
      ],
    };
    const result = detectRegressions(baseline, after);
    expect(result.regressed).toBe(true);
    expect(result.sections).toHaveLength(2);
  });

  it('should respect custom threshold', () => {
    const after: ScanSnapshot = {
      overallScore: 82,
      sections: baseline.sections,
    };
    // Default threshold=5, delta=-3 should not trigger
    const result = detectRegressions(baseline, after, 10);
    expect(result.regressed).toBe(false);
    expect(result.scoreDelta).toBe(-3);
  });

  it('should sort regressions by worst delta first', () => {
    const after: ScanSnapshot = {
      overallScore: 70,
      sections: [
        { id: 's1', name: 'Identity', score: 80, passCount: 8, failCount: 2 },
        { id: 's2', name: 'Data Protection', score: 50, passCount: 5, failCount: 5 },
        { id: 's3', name: 'Access Control', score: 75, passCount: 15, failCount: 5 },
      ],
    };
    const result = detectRegressions(baseline, after);
    expect(result.sections[0].sectionId).toBe('s2');
    expect(result.sections[0].delta).toBe(-30);
  });

  it('should handle new sections gracefully', () => {
    const after: ScanSnapshot = {
      overallScore: 85,
      sections: [
        ...baseline.sections,
        { id: 's4', name: 'Logging', score: 60, passCount: 3, failCount: 2 },
      ],
    };
    const result = detectRegressions(baseline, after);
    expect(result.regressed).toBe(false);
  });

  it('should include correct before/after scores in result', () => {
    const after: ScanSnapshot = { overallScore: 75, sections: baseline.sections };
    const result = detectRegressions(baseline, after);
    expect(result.beforeScore).toBe(85);
    expect(result.afterScore).toBe(75);
  });
});
