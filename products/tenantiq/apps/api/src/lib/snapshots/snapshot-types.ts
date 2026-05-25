/**
 * Shared TypeScript types for the Config Snapshot & Drift Detection feature.
 */

export interface SnapshotRow {
	id: string;
	tenant_id: string;
	label: string;
	snapshot_type: string;
	category_count: number;
	object_count: number;
	error_count: number;
	baseline: number;
	created_by: string;
	created_at: string;
}

export interface DriftRow {
	id: string;
	tenant_id: string;
	snapshot_id: string;
	baseline_id: string;
	category: string;
	path: string;
	old_value: string | null;
	new_value: string | null;
	severity: 'info' | 'warning' | 'critical';
	acknowledged: number;
	detected_at: string;
}

export type DriftSeverity = 'info' | 'warning' | 'critical';

/** Categories that yield critical drift severity when changed */
export const CRITICAL_CATEGORIES = [
	'conditional_access',
	'authorization',
	'security_defaults',
] as const;

/** Categories that yield warning drift severity when changed */
export const WARNING_CATEGORIES = [
	'auth_methods',
	'app_consent',
	'cross_tenant',
] as const;

/** Map category to drift severity */
export function categoryToSeverity(categoryId: string): DriftSeverity {
	if ((CRITICAL_CATEGORIES as readonly string[]).includes(categoryId)) return 'critical';
	if ((WARNING_CATEGORIES as readonly string[]).includes(categoryId)) return 'warning';
	return 'info';
}
