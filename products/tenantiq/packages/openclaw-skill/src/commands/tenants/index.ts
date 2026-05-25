/**
 * Tenant Management Commands — barrel re-exports
 */

import type { Command } from '../../types';
import { switchTenantCommand } from './switch-tenant';
import { listTenantsCommand } from './list-tenants';
import { dashboardCommand } from './dashboard';

export { switchTenantCommand } from './switch-tenant';
export { listTenantsCommand } from './list-tenants';
export { dashboardCommand } from './dashboard';

export const tenantCommands: Command[] = [
	switchTenantCommand,
	listTenantsCommand,
	dashboardCommand
];
