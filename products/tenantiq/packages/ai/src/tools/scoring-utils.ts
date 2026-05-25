/**
 * Shared scoring utility functions for health score computation
 */

import type { HealthFactor } from './health-score-types';

export function scoreToGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
	if (score >= 95) return 'A+';
	if (score >= 85) return 'A';
	if (score >= 70) return 'B';
	if (score >= 55) return 'C';
	if (score >= 40) return 'D';
	return 'F';
}

export function factorStatus(score: number, max: number): HealthFactor['status'] {
	const pct = (score / max) * 100;
	if (pct >= 90) return 'excellent';
	if (pct >= 70) return 'good';
	if (pct >= 50) return 'needs_attention';
	return 'critical';
}

/** Error function approximation for percentile computation */
function erf(x: number): number {
	const a1 = 0.254829592,
		a2 = -0.284496736,
		a3 = 1.421413741,
		a4 = -1.453152027,
		a5 = 1.061405429,
		p = 0.3275911;
	const sign = x < 0 ? -1 : 1;
	x = Math.abs(x);
	const t = 1.0 / (1.0 + p * x);
	const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
	return sign * y;
}

/** Simulated industry benchmark percentile (mean=62, stddev=15) */
export function computePercentile(score: number): number {
	const z = (score - 62) / 15;
	const p = 0.5 * (1 + erf(z / Math.SQRT2));
	return Math.round(p * 100);
}
