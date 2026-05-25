/**
 * Compliance Commands — barrel re-export
 */

import type { Command } from '../../types';
import { complianceStatusCommand } from './compliance-status';
import { groupsWithoutOwnersCommand } from './groups-without-owners';
import { auditTrailCommand } from './audit-trail';

export { complianceStatusCommand } from './compliance-status';
export { groupsWithoutOwnersCommand } from './groups-without-owners';
export { auditTrailCommand } from './audit-trail';

export const complianceCommands: Command[] = [
	complianceStatusCommand,
	groupsWithoutOwnersCommand,
	auditTrailCommand
];
