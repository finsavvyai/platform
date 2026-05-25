/**
 * Drift Suppression — check if a drift path matches any suppression rule.
 */

export interface SuppressionRule {
	category: string;
	path_pattern: string;
}

/** Check if a drift is suppressed by any suppression rule */
export function isPathSuppressed(
	category: string,
	path: string,
	rules: SuppressionRule[],
): boolean {
	return rules.some((rule) => {
		if (rule.category !== '*' && rule.category !== category) return false;
		const pattern = rule.path_pattern;
		if (pattern === '*') return true;
		if (pattern.endsWith('*')) {
			return path.startsWith(pattern.slice(0, -1));
		}
		return path === pattern;
	});
}

/** Load suppression rules for a tenant from D1 */
export async function loadSuppressionRules(
	db: D1Database,
	tenantId: string,
): Promise<SuppressionRule[]> {
	const result = await db.prepare(
		'SELECT category, path_pattern FROM drift_suppression_rules WHERE tenant_id = ?',
	).bind(tenantId).all<SuppressionRule>().catch(() => ({ results: [] as SuppressionRule[] }));
	return result.results;
}
