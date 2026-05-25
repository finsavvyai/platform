/**
 * Anomaly Detection — Shared Helper Functions
 */

export function detectMetricAnomaly(
	label: string,
	current: number,
	baseline: number,
	stdDevMultiplier: number = 2
): { isAnomaly: boolean; deviation: number; direction: 'above' | 'below' } {
	const stdDev = Math.max(baseline * 0.2, 1); // estimated stddev as 20% of baseline
	const deviation = baseline > 0 ? (current - baseline) / stdDev : 0;
	return {
		isAnomaly: Math.abs(deviation) > stdDevMultiplier,
		deviation: Math.round(deviation * 10) / 10,
		direction: current > baseline ? 'above' : 'below',
	};
}

export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371; // km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateId(): string {
	return `anom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
