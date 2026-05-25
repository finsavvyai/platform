/**
 * Shared helpers for AI commands
 */

import type { CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

/**
 * Create an API client and validate that a tenant is selected.
 * Returns the client + tenantId, or an error response.
 */
export function resolveClientAndTenant(
	ctx: CommandContext
): { client: TenantIQClient; tenantId: string } | { error: CommandResponse } {
	if (!ctx.config.activeTenantId) {
		return {
			error: {
				message: 'No active tenant selected. Use "tenantiq switch tenant" first.',
				error: true
			}
		};
	}

	return {
		client: new TenantIQClient(ctx.config),
		tenantId: ctx.config.activeTenantId
	};
}

/**
 * Type guard for the error branch of resolveClientAndTenant.
 */
export function isErrorResult(
	result: ReturnType<typeof resolveClientAndTenant>
): result is { error: CommandResponse } {
	return 'error' in result;
}

/**
 * Wrap an error into a CommandResponse.
 */
export function errorResponse(label: string, err: unknown): CommandResponse {
	return {
		message: `${label}: ${err instanceof Error ? err.message : 'Unknown error'}`,
		error: true
	};
}
