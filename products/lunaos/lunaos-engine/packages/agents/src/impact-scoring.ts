/**
 * Impact scoring primitive — rank agent chain outputs and recommendations
 * across business / product / usability / environmental dimensions.
 *
 * Mirrors (and extends) the scoring primitive popularized by Cepien AI.
 * Used by:
 *   - chain-output post-processing (engine)
 *   - ll-insights skill (openclaw-skills/ll-insights)
 *   - Studio impact-aware node types
 */

export type ImpactDimension =
    | 'business'
    | 'product'
    | 'usability'
    | 'environmental'
    | 'combined';

export interface ImpactScore {
    business: number;
    product: number;
    usability: number;
    environmental?: number;
    combined: number;
}

export interface ImpactWeights {
    business: number;
    product: number;
    usability: number;
    environmental: number;
}

export const DEFAULT_WEIGHTS: ImpactWeights = {
    business: 0.35,
    product: 0.30,
    usability: 0.25,
    environmental: 0.10,
};

export interface ScoredItem<T = unknown> {
    item: T;
    impact: ImpactScore;
    effortHours?: number;
    confidence?: number;
}

function clamp(value: number, min = 0, max = 100): number {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
}

export function normalizeWeights(weights: Partial<ImpactWeights>): ImpactWeights {
    if (Object.keys(weights).length === 0) return { ...DEFAULT_WEIGHTS };
    const merged = { ...DEFAULT_WEIGHTS, ...weights };
    const sum = merged.business + merged.product + merged.usability + merged.environmental;
    if (sum <= 0) return { ...DEFAULT_WEIGHTS };
    return {
        business: merged.business / sum,
        product: merged.product / sum,
        usability: merged.usability / sum,
        environmental: merged.environmental / sum,
    };
}

export function computeCombined(
    dimensions: Omit<ImpactScore, 'combined'>,
    weights: Partial<ImpactWeights> = {},
): number {
    const w = normalizeWeights(weights);
    const env = dimensions.environmental ?? 0;
    const raw =
        clamp(dimensions.business) * w.business +
        clamp(dimensions.product) * w.product +
        clamp(dimensions.usability) * w.usability +
        clamp(env) * w.environmental;
    return Math.round(raw * 100) / 100;
}

export function scoreItem<T>(
    item: T,
    dimensions: Omit<ImpactScore, 'combined'>,
    opts: { weights?: Partial<ImpactWeights>; effortHours?: number; confidence?: number } = {},
): ScoredItem<T> {
    const combined = computeCombined(dimensions, opts.weights);
    return {
        item,
        impact: {
            business: clamp(dimensions.business),
            product: clamp(dimensions.product),
            usability: clamp(dimensions.usability),
            environmental: dimensions.environmental !== undefined ? clamp(dimensions.environmental) : undefined,
            combined,
        },
        effortHours: opts.effortHours,
        confidence: opts.confidence,
    };
}

export function rankByImpact<T>(
    items: ScoredItem<T>[],
    dimension: ImpactDimension = 'combined',
): ScoredItem<T>[] {
    const pick = (s: ImpactScore): number =>
        dimension === 'environmental' ? s.environmental ?? 0 : s[dimension] ?? 0;
    return [...items].sort((a, b) => pick(b.impact) - pick(a.impact));
}

export function filterByMinScore<T>(
    items: ScoredItem<T>[],
    minScore: number,
    dimension: ImpactDimension = 'combined',
): ScoredItem<T>[] {
    const pick = (s: ImpactScore): number =>
        dimension === 'environmental' ? s.environmental ?? 0 : s[dimension] ?? 0;
    return items.filter((s) => pick(s.impact) >= minScore);
}

export function impactToRoi(scored: ScoredItem): number | null {
    if (!scored.effortHours || scored.effortHours <= 0) return null;
    return Math.round((scored.impact.combined / scored.effortHours) * 100) / 100;
}
