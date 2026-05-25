import type { GraphClient } from '@tenantiq/graph';
import {
	getUsersByTenant,
	getInactiveUsers,
	getGuestUsers,
	getLicensesByTenant,
	getAlertsByTenant,
	getAlertCountsByTenant,
	getAuditLog
} from '@tenantiq/db';
import type { Database } from '@tenantiq/db';
import { GroupOperations, LicenseOperations } from '@tenantiq/graph';

export interface ToolContext {
	db: Database;
	graphClient: GraphClient;
	tenantId: string;
	azureTenantId: string;
	remediationQueue: Queue;
	executedBy: string;
}

export async function handleToolCall(
	toolName: string,
	input: Record<string, unknown>,
	ctx: ToolContext
): Promise<unknown> {
	switch (toolName) {
		case 'query_users':
			return handleQueryUsers(input, ctx);
		case 'query_licenses':
			return handleQueryLicenses(input, ctx);
		case 'query_alerts':
			return handleQueryAlerts(input, ctx);
		case 'query_security':
			return handleQuerySecurity(ctx);
		case 'query_groups':
			return handleQueryGroups(ctx);
		case 'query_audit_log':
			return handleQueryAuditLog(input, ctx);
		case 'execute_remediation':
			return handleExecuteRemediation(input, ctx);
		case 'assign_license':
			return handleAssignLicense(input, ctx);
		case 'create_group':
			return handleCreateGroup(input, ctx);
		default:
			return { error: `Unknown tool: ${toolName}` };
	}
}

async function handleQueryUsers(input: Record<string, unknown>, ctx: ToolContext) {
	const filter = input.filter as string;
	const limit = (input.limit as number) || 20;
	const inactiveDays = (input.inactiveDays as number) || 30;

	if (filter === 'inactive') {
		const users = await getInactiveUsers(ctx.db, ctx.tenantId, inactiveDays);
		return { users: users.slice(0, limit), total: users.length };
	}
	if (filter === 'guests') {
		const users = await getGuestUsers(ctx.db, ctx.tenantId);
		return { users: users.slice(0, limit), total: users.length };
	}

	// General search or all users
	const users = await getUsersByTenant(ctx.db, ctx.tenantId, { limit });
	if (filter && filter !== 'all') {
		const filtered = users.filter(
			(u) =>
				u.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
				u.email?.toLowerCase().includes(filter.toLowerCase())
		);
		return { users: filtered, total: filtered.length };
	}
	return { users, total: users.length };
}

async function handleQueryLicenses(input: Record<string, unknown>, ctx: ToolContext) {
	const licenses = await getLicensesByTenant(ctx.db, ctx.tenantId);
	const totalSpend = licenses.reduce((sum, l) => sum + (l.costPerUnit ? Number(l.costPerUnit) * l.assigned : 0), 0);
	const totalWaste = licenses.reduce((sum, l) => sum + (l.costPerUnit ? Number(l.costPerUnit) * (l.total - l.assigned) : 0), 0);

	return {
		licenses: licenses.map((l) => ({
			skuId: l.skuId,
			skuName: l.skuName,
			total: l.total,
			assigned: l.assigned,
			available: l.total - l.assigned,
			costPerUnit: l.costPerUnit ? Number(l.costPerUnit) : null,
			monthlyWaste: l.costPerUnit ? Number(l.costPerUnit) * (l.total - l.assigned) : null
		})),
		summary: { totalLicenses: licenses.length, totalMonthlySpend: totalSpend, totalMonthlyWaste: totalWaste }
	};
}

async function handleQueryAlerts(input: Record<string, unknown>, ctx: ToolContext) {
	const alerts = await getAlertsByTenant(ctx.db, ctx.tenantId, {
		severity: input.severity as string | undefined,
		category: input.category as string | undefined,
		status: (input.status as string) || 'active',
		limit: 50
	});
	return { alerts, total: alerts.length };
}

async function handleQuerySecurity(ctx: ToolContext) {
	const [alertCounts, users] = await Promise.all([
		getAlertCountsByTenant(ctx.db, ctx.tenantId),
		getUsersByTenant(ctx.db, ctx.tenantId, { limit: 50000 })
	]);

	const guests = users.filter((u) => u.userType === 'guest');
	const enabled = users.filter((u) => u.accountEnabled);

	return {
		alertCounts,
		totalUsers: users.length,
		enabledUsers: enabled.length,
		guestUsers: guests.length,
		guestRatio: users.length > 0 ? `${Math.round((guests.length / users.length) * 100)}%` : '0%'
	};
}

async function handleQueryGroups(ctx: ToolContext) {
	const groupOps = new GroupOperations(ctx.graphClient);
	const groups = await groupOps.listWithOwners(ctx.azureTenantId);
	return { groups: (groups as unknown[]).slice(0, 50), total: (groups as unknown[]).length };
}

async function handleQueryAuditLog(input: Record<string, unknown>, ctx: ToolContext) {
	const days = (input.days as number) || 7;
	const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const entries = await getAuditLog(ctx.db, ctx.tenantId, {
		actor: input.actor as string | undefined,
		action: input.action as string | undefined,
		dateFrom,
		limit: 50
	});
	return { entries, total: entries.length };
}

async function handleExecuteRemediation(input: Record<string, unknown>, ctx: ToolContext) {
	const actionId = input.actionId as string;
	const resourceIds = input.resourceIds as string[];
	const dryRun = (input.dryRun as boolean) ?? true;

	if (dryRun) {
		return {
			status: 'dry_run',
			message: `Would execute ${actionId} on ${resourceIds.length} resource(s). Set dryRun to false to execute.`,
			actionId,
			resourceCount: resourceIds.length
		};
	}

	await ctx.remediationQueue.send({
		actionId,
		tenantId: ctx.tenantId,
		affectedResources: resourceIds.map((id) => ({ id })),
		executedBy: ctx.executedBy
	});

	return { status: 'queued', message: `Remediation ${actionId} queued for execution on ${resourceIds.length} resource(s).` };
}

async function handleAssignLicense(input: Record<string, unknown>, ctx: ToolContext) {
	const userId = input.userId as string;
	const addSkuId = input.addSkuId as string | undefined;
	const removeSkuId = input.removeSkuId as string | undefined;

	const licenseOps = new LicenseOperations(ctx.graphClient);
	const addLicenses = addSkuId ? [{ skuId: addSkuId }] : [];
	const removeLicenses = removeSkuId ? [removeSkuId] : [];

	await licenseOps.assignLicense(ctx.azureTenantId, userId, addLicenses, removeLicenses);
	return { success: true, userId, added: addSkuId ?? null, removed: removeSkuId ?? null };
}

async function handleCreateGroup(input: Record<string, unknown>, ctx: ToolContext) {
	const displayName = input.displayName as string;
	const type = input.type as 'security' | 'microsoft365';

	const groupOps = new GroupOperations(ctx.graphClient);
	const group = await groupOps.createGroup(ctx.azureTenantId, {
		displayName,
		mailEnabled: type === 'microsoft365',
		securityEnabled: true,
		mailNickname: displayName.replace(/\s+/g, '-').toLowerCase(),
		groupTypes: type === 'microsoft365' ? ['Unified'] : []
	});

	return { success: true, group };
}
