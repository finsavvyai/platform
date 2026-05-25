import type { Env } from '../index';
import { getDb } from '../lib/db';
import {
	createRemediationEntry,
	updateRemediationStatus,
	updateAlertStatus,
	createAuditEntry,
	getRemediationById
} from '@tenantiq/db';
import { createGraphClient } from '../cron/user-sync';
import { RemediationExecutor } from '@tenantiq/remediation';
import { decommissionUser } from '@tenantiq/remediation';
import { enableMfa } from '@tenantiq/remediation';
import { blockIp } from '@tenantiq/remediation';
import { downgradeLicense } from '@tenantiq/remediation';
import { revokeSessions } from '@tenantiq/remediation';
import { removeGuest } from '@tenantiq/remediation';
import { forcePasswordReset } from '@tenantiq/remediation';
import { restrictSharing } from '@tenantiq/remediation';
import { enableConditionalAccess } from '@tenantiq/remediation';

interface RemediationMessage {
	type?: string;
	alertId?: string;
	tenantId: string;
	ruleId?: string;
	actionId?: string;
	actionType?: string;
	affectedResources?: unknown[];
	executedBy: string;
	remediationId?: string;
	rollbackId?: string;
	beforeState?: unknown;
	afterState?: unknown;
}

export async function executeRemediation(message: unknown, env: Env) {
	const msg = message as RemediationMessage;
	const db = getDb(env);
	const graphClient = createGraphClient(env);

	// Build executor with all registered actions
	const executor = new RemediationExecutor();
	executor.register(decommissionUser);
	executor.register(enableMfa);
	executor.register(blockIp);
	executor.register(downgradeLicense);
	executor.register(revokeSessions);
	executor.register(removeGuest);
	executor.register(forcePasswordReset);
	executor.register(restrictSharing);
	executor.register(enableConditionalAccess);

	if (msg.type === 'rollback' && msg.remediationId) {
		console.log(`[Remediation] Rolling back: ${msg.remediationId}`);

		const entry = await getRemediationById(db, msg.remediationId);
		if (!entry) {
			console.error(`[Remediation] Rollback entry not found: ${msg.remediationId}`);
			return;
		}

		// Both states are needed: beforeState for restoring, afterState for cleanup
		const beforeState = entry.beforeState ?? msg.beforeState ?? null;
		const afterState = entry.afterState ?? msg.afterState ?? null;

		if (beforeState == null && afterState == null) {
			console.error(`[Remediation] Rollback missing state for ${entry.actionId}`);
			await updateRemediationStatus(db, msg.remediationId, 'failed', null, 'Cannot rollback: missing state');
			await createAuditEntry(db, {
				tenantId: msg.tenantId,
				actor: msg.executedBy,
				action: 'remediation.rollback.failed',
				resourceType: 'remediation',
				resourceId: msg.remediationId,
				details: { actionId: entry.actionId, error: 'Missing state' }
			});
			return;
		}

		const { executeRollback } = await import('@tenantiq/remediation');
		const result = await executeRollback(msg.tenantId, entry.actionId, beforeState, graphClient, afterState);

		await updateRemediationStatus(db, msg.remediationId, result.success ? 'rolled_back' : 'failed', null, result.error);

		await createAuditEntry(db, {
			tenantId: msg.tenantId,
			actor: msg.executedBy,
			action: result.success ? 'remediation.rollback.success' : 'remediation.rollback.failed',
			resourceType: 'remediation',
			resourceId: msg.remediationId,
			details: { actionId: entry.actionId, error: result.error }
		});
		return;
	}

	// Map rule ID to remediation action ID
	const actionId = msg.actionId ?? ruleToActionId(msg.ruleId ?? '');
	if (!actionId) {
		console.error(`[Remediation] No action mapping for rule: ${msg.ruleId}`);
		return;
	}

	// Create remediation log entry
	const entry = await createRemediationEntry(db, {
		tenantId: msg.tenantId,
		actor: msg.executedBy,
		actionType: actionId,
		targetResource: msg.alertId,
		status: 'executing',
	});

	try {
		const result = await executor.execute(
			actionId,
			msg.tenantId,
			msg.affectedResources ?? [],
			graphClient
		);

		if (result.success) {
			await updateRemediationStatus(db, entry.id, 'success', result.afterState);
			if (msg.alertId) {
				await updateAlertStatus(db, msg.alertId, 'resolved', msg.executedBy);
			}
		} else {
			await updateRemediationStatus(db, entry.id, 'failed', null, result.error);
		}

		await createAuditEntry(db, {
			tenantId: msg.tenantId,
			actor: msg.executedBy,
			action: result.success ? 'remediation.success' : 'remediation.failed',
			resourceType: 'remediation',
			resourceId: entry.id,
			details: { actionId, alertId: msg.alertId }
		});

		// Broadcast update
		const durableId = env.TENANT_EVENTS.idFromName(msg.tenantId);
		const stub = env.TENANT_EVENTS.get(durableId);
		await stub.fetch(new Request('https://internal/broadcast', {
			method: 'POST',
			body: JSON.stringify({
				type: 'remediation_update',
				remediationId: entry.id,
				status: result.success ? 'success' : 'failed'
			})
		}));

		console.log(`[Remediation] ${actionId}: ${result.success ? 'success' : 'failed'}`);
	} catch (err) {
		await updateRemediationStatus(db, entry.id, 'failed', null, String(err));
		console.error(`[Remediation] ${actionId} error:`, err);
	}
}

function ruleToActionId(ruleId: string): string | null {
	const map: Record<string, string> = {
		'OPT-001': 'REM-001', // Inactive users -> Decommission
		'SEC-001': 'REM-002', // MFA not enforced -> Enable MFA
		'SEC-004': 'REM-003', // Failed login spike -> Block IP
		'OPT-002': 'REM-004', // Underutilized E5 -> Downgrade
		'SEC-003': 'REM-005', // Impossible travel -> Revoke sessions
		'SEC-005': 'REM-005', // Risky sign-ins -> Revoke sessions
		'CMP-001': 'REM-007', // Stale guests -> Remove guest
		'CMP-003': 'REM-009'  // Disabled CA -> Enable CA
	};
	return map[ruleId] ?? null;
}
