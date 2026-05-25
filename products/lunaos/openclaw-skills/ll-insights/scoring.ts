import type {
    BacklogItem,
    ClusteredIssue,
    ImpactDimension,
    ImpactWeights,
} from './types';

export const DEFAULT_WEIGHTS: ImpactWeights = {
    business: 0.35,
    product: 0.30,
    usability: 0.25,
    environmental: 0.10,
};

function clamp(v: number, min = 0, max = 100): number {
    if (Number.isNaN(v)) return min;
    return Math.min(Math.max(v, min), max);
}

export function normalizeWeights(w: Partial<ImpactWeights>): ImpactWeights {
    if (Object.keys(w).length === 0) return { ...DEFAULT_WEIGHTS };
    const m = { ...DEFAULT_WEIGHTS, ...w };
    const sum = m.business + m.product + m.usability + m.environmental;
    if (sum <= 0) return { ...DEFAULT_WEIGHTS };
    return {
        business: m.business / sum,
        product: m.product / sum,
        usability: m.usability / sum,
        environmental: m.environmental / sum,
    };
}

export function combinedScore(
    dims: { business: number; product: number; usability: number; environmental?: number },
    weights: Partial<ImpactWeights> = {},
): number {
    const w = normalizeWeights(weights);
    const env = dims.environmental ?? 0;
    const raw =
        clamp(dims.business) * w.business +
        clamp(dims.product) * w.product +
        clamp(dims.usability) * w.usability +
        clamp(env) * w.environmental;
    return Math.round(raw * 100) / 100;
}

function pickScore(item: BacklogItem, dim: ImpactDimension): number {
    const i = item.impact;
    if (dim === 'environmental') return i.environmental ?? 0;
    return i[dim] ?? 0;
}

export function scoreIssues(
    issues: ClusteredIssue[],
    rawScores: Array<{
        business: number;
        product: number;
        usability: number;
        environmental?: number;
        effortHours?: number;
    }>,
    weights: Partial<ImpactWeights> = {},
): BacklogItem[] {
    return issues.map((issue, i) => {
        const raw = rawScores[i] ?? { business: 0, product: 0, usability: 0 };
        const combined = combinedScore(raw, weights);
        const roi =
            raw.effortHours && raw.effortHours > 0
                ? Math.round((combined / raw.effortHours) * 100) / 100
                : undefined;
        return {
            ...issue,
            impact: {
                business: clamp(raw.business),
                product: clamp(raw.product),
                usability: clamp(raw.usability),
                environmental: raw.environmental !== undefined ? clamp(raw.environmental) : undefined,
                combined,
            },
            effortHours: raw.effortHours,
            roi,
        };
    });
}

export function filterAndRank(
    items: BacklogItem[],
    minScore: number,
    dimension: ImpactDimension = 'combined',
    limit = 20,
): BacklogItem[] {
    const kept = items.filter((i) => pickScore(i, dimension) >= minScore);
    kept.sort((a, b) => pickScore(b, dimension) - pickScore(a, dimension));
    return kept.slice(0, Math.max(0, limit));
}
