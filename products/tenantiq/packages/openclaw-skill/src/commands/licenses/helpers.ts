/**
 * Shared helpers for license commands
 */

import type { CommandContext, CommandResponse } from '../../types';

export function requireActiveTenant(ctx: CommandContext): CommandResponse | null {
	if (!ctx.config.activeTenantId) {
		return {
			message: 'No active tenant selected. Use "tenantiq switch tenant" first.',
			error: true
		};
	}
	return null;
}

export function formatError(label: string, error: unknown): CommandResponse {
	return {
		message: `Failed to ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		error: true
	};
}
