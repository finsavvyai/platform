import { describe, it, expect } from 'vitest';
import {
    DEFAULT_WEIGHTS,
    combinedScore,
    filterAndRank,
    normalizeWeights,
    scoreIssues,
} from '../scoring';
import type { BacklogItem, ClusteredIssue } from '../types';

function mkIssue(id: string): ClusteredIssue {
    return { id, title: `i ${id}`, tags: [], evidence: [], cluster_size: 1 };
}

function mkItem(id: string, combined: number, env?: number): BacklogItem {
    return {
        ...mkIssue(id),
        impact: { business: combined, product: combined, usability: combined, environmental: env, combined },
    };
}

describe('normalizeWeights', () => {
    it('returns defaults on empty input', () => {
        expect(normalizeWeights({})).toEqual(DEFAULT_WEIGHTS);
    });
    it('normalizes to sum=1', () => {
        const w = normalizeWeights({ business: 10, product: 10, usability: 10, environmental: 10 });
        expect(w.business + w.product + w.usability + w.environmental).toBeCloseTo(1, 5);
    });
    it('falls back when sum is zero', () => {
        expect(normalizeWeights({ business: 0, product: 0, usability: 0, environmental: 0 }))
            .toEqual(DEFAULT_WEIGHTS);
    });
});

describe('combinedScore', () => {
    it('clamps out-of-range inputs', () => {
        const c = combinedScore({ business: 500, product: -20, usability: 50 });
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(100);
    });
    it('includes environmental dimension when present', () => {
        const a = combinedScore({ business: 0, product: 0, usability: 0, environmental: 100 });
        expect(a).toBeGreaterThan(0);
    });
});

describe('scoreIssues', () => {
    it('attaches impact, effort, and ROI', () => {
        const issues = [mkIssue('a')];
        const [scored] = scoreIssues(issues, [
            { business: 80, product: 70, usability: 60, effortHours: 10 },
        ]);
        expect(scored!.impact.combined).toBeGreaterThan(0);
        expect(scored!.effortHours).toBe(10);
        expect(scored!.roi).toBeGreaterThan(0);
    });
    it('omits ROI when effort missing or zero', () => {
        const [a] = scoreIssues([mkIssue('a')], [{ business: 80, product: 80, usability: 80 }]);
        const [b] = scoreIssues(
            [mkIssue('b')],
            [{ business: 80, product: 80, usability: 80, effortHours: 0 }],
        );
        expect(a!.roi).toBeUndefined();
        expect(b!.roi).toBeUndefined();
    });
    it('pads with zeros when rawScores is shorter', () => {
        const issues = [mkIssue('a'), mkIssue('b')];
        const scored = scoreIssues(issues, [{ business: 90, product: 90, usability: 90 }]);
        expect(scored[0]!.impact.combined).toBeGreaterThan(0);
        expect(scored[1]!.impact.combined).toBe(0);
    });
});

describe('filterAndRank', () => {
    it('sorts by combined score and respects limit', () => {
        const items = [mkItem('low', 40), mkItem('high', 95), mkItem('mid', 75)];
        const out = filterAndRank(items, 50, 'combined', 2);
        expect(out.map((i) => i.id)).toEqual(['high', 'mid']);
    });

    it('ranks by environmental dimension', () => {
        const items = [mkItem('eco', 10, 90), mkItem('biz', 95)];
        const out = filterAndRank(items, 50, 'environmental', 5);
        expect(out.map((i) => i.id)).toEqual(['eco']);
    });

    it('returns empty when limit is 0', () => {
        expect(filterAndRank([mkItem('a', 99)], 0, 'combined', 0)).toEqual([]);
    });
});
