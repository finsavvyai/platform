/**
 * Purview data — types and simple Graph data fetchers.
 * Heavy feature scanning logic lives in purview-features.ts.
 */

import type { GraphClient } from '../../lib/graph-client';

// Re-export the main feature scanner so existing imports keep working
export { getPurviewFeatures } from './purview-features';

export interface PurviewFeature {
	category: string; name: string; description: string;
	status: 'configured' | 'partial' | 'not_configured' | 'disabled';
	severity: 'critical' | 'high' | 'medium' | 'low';
	details: { current: string; recommended: string; gap: string };
	regulations: string[]; remediationSteps: string[];
	policies?: Array<{ name: string; state: string; target: string; controls: string[] }>;
}

export interface DlpPolicy {
	name: string; status: 'active' | 'test' | 'disabled' | 'not_created';
	sensitiveTypes: string[]; locations: string[]; actions: string[];
	matchCount: number; falsePositiveRate: number;
}

export interface SensitivityLabel {
	name: string; scope: string; encryption: boolean;
	autoLabeling: boolean; usageCount: number;
}

export async function getDlpPolicies(graph: GraphClient | null): Promise<DlpPolicy[]> {
	if (!graph) return [];
	try {
		const data = await graph.fetch('/security/informationProtection/policy/dlpPolicies');
		return (data.value || []).map((p: any) => ({
			name: p.displayName || 'Unnamed', status: p.isEnabled ? 'active' : 'disabled',
			sensitiveTypes: p.sensitiveTypeIds || [], locations: p.locations || [],
			actions: p.actions || [], matchCount: 0, falsePositiveRate: 0,
		}));
	} catch { return []; }
}

export async function getSensitivityLabels(graph: GraphClient | null): Promise<SensitivityLabel[]> {
	if (!graph) return [];
	try {
		const data = await graph.fetch('/informationProtection/policy/labels');
		return (data.value || []).map((l: any) => ({
			name: l.name || l.displayName || 'Unnamed', scope: l.tooltip || 'All',
			encryption: l.isEncryptionEnabled ?? false, autoLabeling: l.isAutoLabelingEnabled ?? false, usageCount: 0,
		}));
	} catch { return []; }
}
