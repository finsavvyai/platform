import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAlertsByTenant, createAuditEntry } from '@tenantiq/db';
import { alerts } from '../../drizzle/schema/alerts.schema';
import type { ScanMessage } from './scan-types';
import { getSeverityFromRule, getCategoryFromRule, getRemediationType } from './scan-types';
import { assertOrgId } from '../lib/org-scope-assert';
import { dispatchAlertCandidatesToOpenSyber } from './opensyber-dispatch';

export async function processAlertCandidates(msg: ScanMessage, env: Env) {
	if (!msg.candidates) return;

	// tenantId is the org-scope key for all alert DB writes in this handler
	assertOrgId(msg.tenantId, 'AlertHandler');

	const db = getDb(env);
	let created = 0;

	for (const candidate of msg.candidates) {
		const existing = await getAlertsByTenant(db, msg.tenantId, {
			status: 'active',
			limit: 1000
		});

		const isDuplicate = existing.some(
			(a) => a.ruleId === candidate.ruleId && a.status === 'active'
		);

		if (!isDuplicate) {
			const severity = candidate.severity ?? getSeverityFromRule(candidate.ruleId);
			const category = candidate.category ?? getCategoryFromRule(candidate.ruleId);

			const now = new Date().toISOString();
			await db.insert(alerts).values({
				id: crypto.randomUUID(),
				tenantId: msg.tenantId,
				type: category,
				severity,
				title: candidate.title,
				description: candidate.description,
				source: 'intelligence_engine',
				status: 'active',
				createdAt: now,
				updatedAt: now,
				metadata: JSON.stringify({
					ruleId: candidate.ruleId,
					businessImpact: candidate.businessImpact,
					affectedResources: candidate.affectedResources,
					remediationType: getRemediationType(candidate.ruleId),
				}),
				recommendations: candidate.recommendedAction ? JSON.stringify([candidate.recommendedAction]) : null,
			});
			created++;
		}
	}

	if (created > 0) {
		await broadcastAlerts(env, msg, created);

		await createAuditEntry(db, {
			tenantId: msg.tenantId,
			actor: 'system',
			action: 'alerts.created',
			details: { count: created }
		});
	}

	// Forward to any configured OpenSyber receivers (best-effort, never throws).
	try {
		await dispatchAlertCandidatesToOpenSyber(db, env, msg);
	} catch (err) {
		console.error('[ScanProcessor] OpenSyber dispatch failed:', err);
	}

	console.log(`[ScanProcessor] Created ${created} alerts for tenant ${msg.tenantId}`);
}

async function broadcastAlerts(env: Env, msg: ScanMessage, created: number) {
	const durableId = env.TENANT_EVENTS.idFromName(msg.tenantId);
	const stub = env.TENANT_EVENTS.get(durableId);
	await stub.fetch(new Request('https://internal/broadcast', {
		method: 'POST',
		body: JSON.stringify({
			type: 'alerts_updated',
			tenantId: msg.tenantId,
			newAlerts: created
		})
	}));

	const criticalCount = msg.candidates!.filter(
		(c) => (c.severity ?? getSeverityFromRule(c.ruleId)) === 'critical'
	).length;

	if (criticalCount > 0) {
		await env.NOTIFICATION_QUEUE.send({
			type: 'critical_alerts',
			tenantId: msg.tenantId,
			count: criticalCount
		});
	}
}
