/**
 * Guard: asserts that orgId is a non-empty string before any DB query runs.
 * Enforces multi-tenant isolation in cron handlers and queue processors.
 * Throws at runtime instead of silently executing cross-org queries.
 */
export function assertOrgId(
	orgId: string | null | undefined,
	context: string
): asserts orgId is string {
	if (!orgId) {
		throw new Error(
			`[${context}] org_id scope required — no query may run without tenant context`
		);
	}
}
