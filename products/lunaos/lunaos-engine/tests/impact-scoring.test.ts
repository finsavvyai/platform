import {
    DEFAULT_WEIGHTS,
    computeCombined,
    filterByMinScore,
    impactToRoi,
    normalizeWeights,
    rankByImpact,
    scoreItem,
} from '../packages/agents/src/impact-scoring';

describe('normalizeWeights', () => {
    it('returns defaults when no input', () => {
        expect(normalizeWeights({})).toEqual(DEFAULT_WEIGHTS);
    });

    it('normalizes partial weights to sum to 1', () => {
        const w = normalizeWeights({ business: 2, product: 2, usability: 2, environmental: 2 });
        const sum = w.business + w.product + w.usability + w.environmental;
        expect(sum).toBeCloseTo(1, 5);
    });

    it('falls back to defaults when sum is zero', () => {
        const w = normalizeWeights({ business: 0, product: 0, usability: 0, environmental: 0 });
        expect(w).toEqual(DEFAULT_WEIGHTS);
    });
});

describe('computeCombined', () => {
    it('clamps out-of-range scores', () => {
        const c = computeCombined({ business: 200, product: -50, usability: 50 });
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(100);
    });

    it('weights business higher than usability by default', () => {
        const bizHeavy = computeCombined({ business: 100, product: 0, usability: 0 });
        const usaHeavy = computeCombined({ business: 0, product: 0, usability: 100 });
        expect(bizHeavy).toBeGreaterThan(usaHeavy);
    });

    it('uses env dimension when present', () => {
        const withEnv = computeCombined({
            business: 0,
            product: 0,
            usability: 0,
            environmental: 100,
        });
        expect(withEnv).toBeGreaterThan(0);
    });
});

describe('scoreItem', () => {
    it('attaches clamped impact and combined score', () => {
        const s = scoreItem('rec-1', { business: 80, product: 70, usability: 60 });
        expect(s.item).toBe('rec-1');
        expect(s.impact.combined).toBeGreaterThan(0);
        expect(s.impact.business).toBe(80);
    });

    it('passes through effort and confidence', () => {
        const s = scoreItem(
            { id: 'x' },
            { business: 50, product: 50, usability: 50 },
            { effortHours: 10, confidence: 0.8 },
        );
        expect(s.effortHours).toBe(10);
        expect(s.confidence).toBe(0.8);
    });
});

describe('rankByImpact', () => {
    const items = [
        scoreItem('a', { business: 40, product: 50, usability: 60 }),
        scoreItem('b', { business: 90, product: 80, usability: 70 }),
        scoreItem('c', { business: 20, product: 30, usability: 40 }),
    ];

    it('sorts by combined impact descending by default', () => {
        const order = rankByImpact(items).map((s) => s.item);
        expect(order).toEqual(['b', 'a', 'c']);
    });

    it('sorts by arbitrary dimension', () => {
        const order = rankByImpact(items, 'usability').map((s) => s.item);
        expect(order[0]).toBe('b');
    });

    it('does not mutate input', () => {
        const copy = [...items];
        rankByImpact(items);
        expect(items).toEqual(copy);
    });
});

describe('filterByMinScore', () => {
    it('keeps items above threshold on combined dim', () => {
        const a = scoreItem('a', { business: 95, product: 95, usability: 95 });
        const b = scoreItem('b', { business: 10, product: 10, usability: 10 });
        const kept = filterByMinScore([a, b], 50);
        expect(kept).toHaveLength(1);
        expect(kept[0]!.item).toBe('a');
    });

    it('filters on environmental dimension correctly', () => {
        const a = scoreItem('a', { business: 0, product: 0, usability: 0, environmental: 90 });
        const b = scoreItem('b', { business: 99, product: 99, usability: 99 });
        const kept = filterByMinScore([a, b], 80, 'environmental');
        expect(kept.map((s) => s.item)).toEqual(['a']);
    });
});

describe('impactToRoi', () => {
    it('returns null when effort is missing or zero', () => {
        const s = scoreItem('x', { business: 80, product: 80, usability: 80 });
        expect(impactToRoi(s)).toBeNull();
        const s2 = scoreItem('y', { business: 80, product: 80, usability: 80 }, { effortHours: 0 });
        expect(impactToRoi(s2)).toBeNull();
    });

    it('computes impact-per-hour ratio', () => {
        const s = scoreItem(
            'x',
            { business: 100, product: 100, usability: 100 },
            { effortHours: 10 },
        );
        const roi = impactToRoi(s);
        expect(roi).toBeGreaterThan(0);
    });
});
