/**
 * OpenSyber outbound dispatch glue for the alert handler.
 *
 * Looks up active tf_opensyber_integrations rows for the org and forwards
 * tenantiq alert candidates to each configured OpenSyber receiver via the
 * shared dispatcher in @tenantiq/webhooks.
 */

import { eq, and } from 'drizzle-orm';
import {
	dispatchToOpenSyber,
	buildTenantiqPayload,
	type DispatchableCandidate,
	type TenantiqWireSource,
	type TenantiqWireSeverity,
	type TenantiqWireCategory,
} from '@tenantiq/webhooks';
import { tfOpensyberIntegrations } from '../../drizzle/schema/opensyber-integrations.schema';
import { getCategoryFromRule, getSeverityFromRule } from './scan-types';
import type { Env } from '../index';
import type { ScanMessage } from './scan-types';

interface AnyCandidate {
	ruleId: string;
	title: string;
	description: string;
	businessImpact: string | null;
	recommendedAction: string | null;
	affectedResources?: unknown[];
	severity?: string;
	category?: string;
}

const ALLOWED_SEVERITIES: ReadonlySet<string> = new Set(['critical', 'high', 'medium', 'low']);
const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set([
	'security',
	'optimization',
	'compliance',
	'operational',
]);

function toWireCandidate(c: AnyCandidate): DispatchableCandidate {
	const rawSev = c.severity ?? getSeverityFromRule(c.ruleId);
	const rawCat = c.category ?? getCategoryFromRule(c.ruleId);
	const severity = (ALLOWED_SEVERITIES.has(rawSev) ? rawSev : 'medium') as TenantiqWireSeverity;
	const category = (ALLOWED_CATEGORIES.has(rawCat) ? rawCat : 'security') as TenantiqWireCategory;
	return {
		ruleId: c.ruleId,
		title: c.title,
		description: c.description,
		businessImpact: c.businessImpact,
		recommendedAction: c.recommendedAction,
		affectedResources: c.affectedResources,
		severity,
		category,
	};
}

function pickSource(msg: ScanMessage): TenantiqWireSource {
	const s = (msg as { source?: string }).source;
	if (s === 'remediation' || s === 'compliance-scan' || s === 'drift-detection') return s;
	return 'intel-engine';
}

/**
 * For each active OpenSyber integration in the given org, dispatch the
 * candidate batch. Errors are swallowed and logged so a misconfigured
 * receiver never blocks alert ingestion.
 */
export async function dispatchAlertCandidatesToOpenSyber(
	db: any, // drizzle d1 instance from getDb(env); typed as any to avoid coupling
	env: Env,
	msg: ScanMessage,
): Promise<void> {
	if (!msg.candidates || msg.candidates.length === 0) return;

	// tenantId is the org-scope key (per AlertHandler convention).
	const orgId = msg.tenantId;
	let integrations: Array<{
		id: string;
		opensyberUrl: string;
		secretEncrypted: string;
		connectionName: string;
	}>;
	try {
		integrations = await db
			.select({
				id: tfOpensyberIntegrations.id,
				opensyberUrl: tfOpensyberIntegrations.opensyberUrl,
				secretEncrypted: tfOpensyberIntegrations.secretEncrypted,
				connectionName: tfOpensyberIntegrations.connectionName,
			})
			.from(tfOpensyberIntegrations)
			.where(
				and(
					eq(tfOpensyberIntegrations.orgId, orgId),
					eq(tfOpensyberIntegrations.status, 'active'),
				),
			);
	} catch (err) {
		console.warn('[OpenSyberDispatch] integration lookup failed:', err);
		return;
	}
	if (integrations.length === 0) return;

	const source = pickSource(msg);
	const candidates = (msg.candidates as AnyCandidate[]).map(toWireCandidate);
	const tenantId = (msg as { wireTenantId?: string }).wireTenantId ?? orgId;

	for (const ig of integrations) {
		try {
			const payload = buildTenantiqPayload(
				candidates,
				tenantId,
				source,
				ig.connectionName,
			);
			const res = await dispatchToOpenSyber(
				{
					opensyber_url: ig.opensyberUrl,
					secret: ig.secretEncrypted,
					connection_name: ig.connectionName,
				},
				payload,
			);
			if (!res.ok) {
				console.warn(
					`[OpenSyberDispatch] integration=${ig.id} status=${res.status} attempts=${res.attempts} err=${res.error ?? ''}`,
				);
			} else {
				console.log(
					`[OpenSyberDispatch] integration=${ig.id} delivered alerts=${candidates.length} status=${res.status}`,
				);
			}
		} catch (err) {
			console.error(`[OpenSyberDispatch] integration=${ig.id} threw:`, err);
		}
	}
}
