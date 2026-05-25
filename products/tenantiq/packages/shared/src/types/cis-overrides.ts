/**
 * Per-tenant CIS control overrides (config-as-code, ScubaGear-style).
 *
 *  - accepted_risk: tenant admin acknowledges a fail; scanner reports the control as
 *    pass with provenance (original status preserved on the result).
 *  - omit:          control excluded from evaluation and from scoring totals.
 *
 * Mirrored 1:1 in `cis_tenant_overrides` (migration 0012).
 */

export type CisOverrideDecision = 'accepted_risk' | 'omit';

export interface CisTenantOverride {
	id: string;
	tenantId: string;
	controlId: string;
	decision: CisOverrideDecision;
	justification: string;
	expiresAt: string | null;
	createdAt: string;
	createdBy: string;
}

export interface CisOverrideUpsertInput {
	controlId: string;
	decision: CisOverrideDecision;
	justification: string;
	expiresAt?: string | null;
}
