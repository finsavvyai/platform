/**
 * License Optimization Commands for TenantIQ OpenClaw Skill
 */

import type { Command } from '../../types';
import { licenseWasteCommand } from './license-waste';
import { inactiveUsersCommand } from './inactive-users';
import { unusedLicensesCommand } from './unused-licenses';
import { downgradeLicenseCommand } from './downgrade-license';
import { optimizeLicensesCommand } from './optimize-licenses';

export {
	licenseWasteCommand,
	inactiveUsersCommand,
	unusedLicensesCommand,
	downgradeLicenseCommand,
	optimizeLicensesCommand
};

export const licenseCommands: Command[] = [
	licenseWasteCommand,
	inactiveUsersCommand,
	unusedLicensesCommand,
	downgradeLicenseCommand,
	optimizeLicensesCommand
];
