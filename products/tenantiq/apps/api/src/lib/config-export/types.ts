/**
 * Configuration-as-Code export types.
 * Used for GitOps-style config export and diff.
 */

export interface ConfigExport {
	version: string;
	exportedAt: string;
	tenant: { id: string; displayName: string };
	categories: Record<string, unknown>;
}

export type ConfigCategory =
	| 'conditionalAccess'
	| 'authMethods'
	| 'securityDefaults'
	| 'dlpPolicies'
	| 'sharingSettings';

export const ALL_CATEGORIES: ConfigCategory[] = [
	'conditionalAccess',
	'authMethods',
	'securityDefaults',
	'dlpPolicies',
	'sharingSettings',
];

export interface ConfigDiffResult {
	category: string;
	path: string;
	oldValue: unknown;
	newValue: unknown;
}
