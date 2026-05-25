/**
 * SOC2 Evidence Collector Tests
 */
import { describe, it, expect } from 'vitest';
import { collectPlatformEvidence, summarizeEvidence } from './soc2-evidence-collector.js';

describe('SOC2 Evidence Collector', () => {
  it('collects platform evidence items', () => {
    const items = collectPlatformEvidence();
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0]!.controlId).toMatch(/^OASF-/);
    expect(items[0]!.tsc).toMatch(/^CC/);
  });

  it('summarizes evidence by TSC', () => {
    const items = collectPlatformEvidence();
    const summary = summarizeEvidence(items);
    expect(summary.totalEvidence).toBe(items.length);
    expect(Object.keys(summary.byTsc).length).toBeGreaterThan(0);
    expect(summary.coveragePercent).toBeGreaterThan(0);
  });

  it('handles empty evidence list', () => {
    const summary = summarizeEvidence([]);
    expect(summary.totalEvidence).toBe(0);
    expect(summary.coveragePercent).toBe(0);
  });

  it('calculates coverage percentage', () => {
    const items = collectPlatformEvidence();
    const summary = summarizeEvidence(items);
    // 5 items cover 5 unique TSCs out of 15 total = 33%
    expect(summary.coveragePercent).toBe(33);
  });
});
