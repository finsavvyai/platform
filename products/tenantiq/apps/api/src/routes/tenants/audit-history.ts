/**
 * Audit History Routes — role changes and policy modifications.
 * GET /audit/role-history   — admin role assignment changes from Graph audit logs
 * GET /audit/policy-history — CA policy and compliance policy changes
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { GraphClient } from '../../lib/graph-client';

const app = new Hono<AppEnv>();

app.use('*', authMiddleware);
app.use('*', tenantMiddleware);

/** Helper to create Graph client for the current tenant, scoped to org. */
async function getGraph(c: Context<AppEnv>): Promise<GraphClient | null> {
	try {
		const tenantId = c.get('tenantId');
		const user = c.get('user');
		if (!tenantId || !user?.orgId) return null;
		const tenant = (await c.env.DB.prepare(
			'SELECT azure_tenant_id FROM tenants WHERE id = ? AND organization_id = ?',
		).bind(tenantId, user.orgId).first()) as { azure_tenant_id: string } | null;
		if (tenant?.azure_tenant_id) {
			return new GraphClient(c.env, tenant.azure_tenant_id);
		}
	} catch { /* proceed without graph */ }
	return null;
}

/**
 * GET /role-history — Fetch directory role assignment changes
 * Pulls from Graph directoryAudits filtering on role management activities.
 */
app.get('/role-history', async (c) => {
	const graph = await getGraph(c);
	const changes: any[] = [];

	if (graph) {
		try {
			// Query directory audit logs for role-related activities
			const filter = "activityDisplayName eq 'Add member to role' or activityDisplayName eq 'Remove member from role' or activityDisplayName eq 'Add eligible member to role' or activityDisplayName eq 'Remove eligible member from role'";
			const data = await graph.fetch(
				`/auditLogs/directoryAudits?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=activityDateTime desc`
			);
			const audits = data.value || [];

			for (const audit of audits) {
				const targetUser = audit.targetResources?.find((r: any) => r.type === 'User');
				const targetRole = audit.targetResources?.find((r: any) => r.type === 'Role');
				const modifiedProps = targetUser?.modifiedProperties || targetRole?.modifiedProperties || [];
				const roleProp = modifiedProps.find((p: any) => p.displayName === 'Role.DisplayName');
				const roleName = roleProp?.newValue?.replace(/"/g, '') || targetRole?.displayName || 'Unknown Role';

				const isRevoke = audit.activityDisplayName?.toLowerCase().includes('remove');

				changes.push({
					id: audit.id || crypto.randomUUID(),
					userDisplayName: targetUser?.displayName || 'Unknown User',
					userEmail: targetUser?.userPrincipalName || '',
					roleName,
					action: isRevoke ? 'revoked' : 'granted',
					grantedBy: audit.initiatedBy?.user?.displayName || audit.initiatedBy?.app?.displayName || 'System',
					effectiveAt: audit.activityDateTime || new Date().toISOString(),
					revokedAt: isRevoke ? audit.activityDateTime : null,
				});
			}
		} catch (err) {
			console.warn('[audit-history] Failed to fetch role changes from Graph:', err);
		}
	}

	// Also pull from local audit_logs table if available
	try {
		const tenantId = c.get('tenantId');
		const localLogs = await c.env.DB.prepare(
			"SELECT * FROM audit_logs WHERE tenant_id = ? AND event_type IN ('role_assigned', 'role_revoked', 'role_changed') ORDER BY timestamp DESC LIMIT 50"
		).bind(tenantId).all();

		for (const log of localLogs.results || []) {
			const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
			changes.push({
				id: log.id as string,
				userDisplayName: details.userDisplayName || details.targetUser || 'Unknown',
				userEmail: details.userEmail || '',
				roleName: details.roleName || details.role || 'Unknown',
				action: (log.event_type as string)?.includes('revok') ? 'revoked' : 'granted',
				grantedBy: log.actor_id as string || 'System',
				effectiveAt: log.timestamp as string,
				revokedAt: (log.event_type as string)?.includes('revok') ? log.timestamp as string : null,
			});
		}
	} catch { /* audit_logs table may not have role events */ }

	// Deduplicate by id and sort
	const seen = new Set<string>();
	const unique = changes.filter(ch => {
		if (seen.has(ch.id)) return false;
		seen.add(ch.id);
		return true;
	});
	unique.sort((a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime());

	return c.json({ changes: unique });
});

/**
 * GET /policy-history — Fetch policy change audit trail
 * Pulls CA policy changes and compliance policy modifications from Graph.
 */
app.get('/policy-history', async (c) => {
	const graph = await getGraph(c);
	const snapshots: any[] = [];

	if (graph) {
		try {
			// Query audit logs for conditional access and policy changes
			const filter = "activityDisplayName eq 'Update conditional access policy' or activityDisplayName eq 'Add conditional access policy' or activityDisplayName eq 'Delete conditional access policy' or activityDisplayName eq 'Update policy'";
			const data = await graph.fetch(
				`/auditLogs/directoryAudits?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=activityDateTime desc`
			);
			const audits = data.value || [];

			for (const audit of audits) {
				const target = audit.targetResources?.[0];
				const modifiedProps = target?.modifiedProperties || [];
				const previousSettings: Record<string, unknown> = {};
				const newSettings: Record<string, unknown> = {};

				for (const prop of modifiedProps) {
					if (prop.oldValue) previousSettings[prop.displayName] = prop.oldValue;
					if (prop.newValue) newSettings[prop.displayName] = prop.newValue;
				}

				let action: string = 'modified';
				const activity = (audit.activityDisplayName || '').toLowerCase();
				if (activity.includes('add') || activity.includes('create')) action = 'created';
				else if (activity.includes('delete')) action = 'deleted';
				else if (activity.includes('enable')) action = 'enabled';
				else if (activity.includes('disable')) action = 'disabled';

				const policyType = activity.includes('conditional') ? 'Conditional Access'
					: activity.includes('compliance') ? 'Compliance'
					: 'Security';

				snapshots.push({
					id: audit.id || crypto.randomUUID(),
					policyName: target?.displayName || 'Unknown Policy',
					policyType,
					action,
					changedBy: audit.initiatedBy?.user?.displayName || audit.initiatedBy?.app?.displayName || 'System',
					changedAt: audit.activityDateTime || new Date().toISOString(),
					previousSettings: Object.keys(previousSettings).length > 0 ? previousSettings : null,
					newSettings,
				});
			}
		} catch (err) {
			console.warn('[audit-history] Failed to fetch policy changes from Graph:', err);
		}
	}

	// Also pull from local audit_logs table
	try {
		const tenantId = c.get('tenantId');
		const localLogs = await c.env.DB.prepare(
			"SELECT * FROM audit_logs WHERE tenant_id = ? AND event_type IN ('policy_created', 'policy_modified', 'policy_deleted', 'policy_enabled', 'policy_disabled') ORDER BY timestamp DESC LIMIT 50"
		).bind(tenantId).all();

		for (const log of localLogs.results || []) {
			const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
			snapshots.push({
				id: log.id as string,
				policyName: details.policyName || 'Unknown Policy',
				policyType: details.policyType || 'Security',
				action: (log.event_type as string)?.replace('policy_', '') || 'modified',
				changedBy: log.actor_id as string || 'System',
				changedAt: log.timestamp as string,
				previousSettings: details.previousSettings || null,
				newSettings: details.newSettings || {},
			});
		}
	} catch { /* audit_logs table may not have policy events */ }

	// Deduplicate and sort
	const seen = new Set<string>();
	const unique = snapshots.filter(s => {
		if (seen.has(s.id)) return false;
		seen.add(s.id);
		return true;
	});
	unique.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

	return c.json({ snapshots: unique });
});

export default app;
