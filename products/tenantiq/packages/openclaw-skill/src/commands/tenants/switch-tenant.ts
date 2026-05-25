/**
 * Switch Tenant Command — change active tenant context
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

export const switchTenantCommand: Command = {
	name: 'switch tenant',
	description: 'Switch to a different tenant context',
	category: 'tenants',
	aliases: ['switch', 'change tenant', 'use tenant'],
	examples: [
		'tenantiq switch tenant MyTenant',
		'tenantiq switch tenant 2',
		'tenantiq switch MyTenant'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		if (ctx.args.length === 0) {
			return {
				message: 'Usage: tenantiq switch tenant <name or number>\nExample: tenantiq switch tenant MyTenant\n\nUse "tenantiq list tenants" to see available tenants.',
				error: true
			};
		}

		try {
			const tenants = await client.listTenants();

			if (tenants.length === 0) {
				return {
					message: 'No tenants found. Please connect a tenant first.',
					error: true
				};
			}

			const input = ctx.args.join(' ');

			// Try to match by number (1-indexed)
			const tenantIndex = parseInt(input, 10);
			let selectedTenant;

			if (!isNaN(tenantIndex) && tenantIndex >= 1 && tenantIndex <= tenants.length) {
				selectedTenant = tenants[tenantIndex - 1];
			} else {
				// Try to match by name (case-insensitive)
				selectedTenant = tenants.find(t =>
					t.name.toLowerCase().includes(input.toLowerCase()) ||
					t.domain.toLowerCase().includes(input.toLowerCase())
				);
			}

			if (!selectedTenant) {
				return {
					message: `Tenant not found: "${input}"\n\nUse "tenantiq list tenants" to see available tenants.`,
					error: true
				};
			}

			// Update active tenant
			client.setActiveTenant(selectedTenant.id);

			const message = `✅ **Switched to Tenant**

**Name:** ${selectedTenant.name}
**Domain:** ${selectedTenant.domain}
**Status:** ${selectedTenant.status === 'active' ? '🟢 Active' : selectedTenant.status === 'syncing' ? '🔄 Syncing' : '🔴 Error'}
**Last Sync:** ${selectedTenant.lastSyncAt ? new Date(selectedTenant.lastSyncAt).toLocaleString() : 'Never'}

All subsequent commands will operate on this tenant.`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'View Dashboard',
						command: 'tenantiq dashboard'
					},
					{
						label: 'Check Alerts',
						command: 'tenantiq check alerts'
					}
				]
			};
		} catch (error) {
			return {
				message: `Failed to switch tenant: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
