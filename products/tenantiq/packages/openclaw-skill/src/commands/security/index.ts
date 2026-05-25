/**
 * Security Commands for TenantIQ OpenClaw Skill
 *
 * Re-exports all security commands from their individual modules.
 */

import type { Command } from '../../types';

export { securityStatusCommand } from './status-command';
export { checkAlertsCommand, showCriticalAlertsCommand } from './alerts-commands';
export { mfaStatusCommand } from './mfa-command';
export { riskyUsersCommand } from './risky-users-command';

import { securityStatusCommand } from './status-command';
import { checkAlertsCommand, showCriticalAlertsCommand } from './alerts-commands';
import { mfaStatusCommand } from './mfa-command';
import { riskyUsersCommand } from './risky-users-command';

export const securityCommands: Command[] = [
	securityStatusCommand,
	checkAlertsCommand,
	showCriticalAlertsCommand,
	mfaStatusCommand,
	riskyUsersCommand
];
