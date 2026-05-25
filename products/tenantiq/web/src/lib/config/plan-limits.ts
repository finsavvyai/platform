/** Plan-based feature limits — 4-tier boutique pricing. */

export type PlanKey = 'trial' | 'free' | 'core' | 'professional' | 'security_suite' | 'enterprise';
export type FeatureKey = keyof (typeof PLAN_LIMITS)['trial'];

export const PLAN_LIMITS = {
	trial: {
		tenants: 1,
		cisControls: 10,
		alerts: 5,
		users: 25,
		licenses: 10,
		complianceFrameworks: 1,
		remediations: 0,
		aiQueries: 5,
		reports: 1,
		backups: 0,
		hardening: 0,
		driftMonitoring: 0,
		securityStack: 0,
	},
	free: {
		tenants: 1,
		cisControls: 10,
		alerts: 5,
		users: 25,
		licenses: 10,
		complianceFrameworks: 1,
		remediations: 0,
		aiQueries: 5,
		reports: 1,
		backups: 0,
		hardening: 0,
		driftMonitoring: 0,
		securityStack: 0,
	},
	core: {
		tenants: 5,
		cisControls: Infinity,
		alerts: Infinity,
		users: Infinity,
		licenses: Infinity,
		complianceFrameworks: 1,
		remediations: 3,
		aiQueries: 25,
		reports: 5,
		backups: 1,
		hardening: 0,
		driftMonitoring: 0,
		securityStack: 0,
	},
	professional: {
		tenants: 25,
		cisControls: Infinity,
		alerts: Infinity,
		users: Infinity,
		licenses: Infinity,
		complianceFrameworks: 3,
		remediations: Infinity,
		aiQueries: Infinity,
		reports: Infinity,
		backups: Infinity,
		hardening: 1,
		driftMonitoring: 0,
		securityStack: 0,
	},
	security_suite: {
		tenants: 50,
		cisControls: Infinity,
		alerts: Infinity,
		users: Infinity,
		licenses: Infinity,
		complianceFrameworks: Infinity,
		remediations: Infinity,
		aiQueries: Infinity,
		reports: Infinity,
		backups: Infinity,
		hardening: Infinity,
		driftMonitoring: Infinity,
		securityStack: Infinity,
	},
	enterprise: {
		tenants: Infinity,
		cisControls: Infinity,
		alerts: Infinity,
		users: Infinity,
		licenses: Infinity,
		complianceFrameworks: Infinity,
		remediations: Infinity,
		aiQueries: Infinity,
		reports: Infinity,
		backups: Infinity,
		hardening: Infinity,
		driftMonitoring: Infinity,
		securityStack: Infinity,
	},
} as const;

const PLAN_HIERARCHY: PlanKey[] = ['trial', 'free', 'core', 'professional', 'security_suite', 'enterprise'];

/** Check if a plan can access a feature (optionally at a given count). */
export function canAccess(plan: string, feature: FeatureKey, count?: number): boolean {
	const limits = PLAN_LIMITS[plan as PlanKey];
	if (!limits) return false;
	const limit = limits[feature];
	if (count !== undefined) return count <= limit;
	return limit > 0;
}

/** Get the numeric limit for a plan + feature. */
export function getLimit(plan: string, feature: FeatureKey): number {
	const limits = PLAN_LIMITS[plan as PlanKey];
	if (!limits) return 0;
	return limits[feature];
}

/** Returns true if the plan is trial or free tier. */
export function isTrialOrFree(plan: string): boolean {
	return plan === 'trial' || plan === 'free';
}

/** Returns true if planA meets or exceeds planB in hierarchy. */
export function meetsMinimumPlan(current: string, required: string): boolean {
	const currentIdx = PLAN_HIERARCHY.indexOf(current as PlanKey);
	const requiredIdx = PLAN_HIERARCHY.indexOf(required as PlanKey);
	if (currentIdx === -1 || requiredIdx === -1) return false;
	return currentIdx >= requiredIdx;
}
