/**
 * CIS Control Registry — combines all per-section control files
 * into a single array for the scanner and API.
 *
 * Import this instead of control-definitions.ts for the full list.
 */
import type { CisControl } from './control-definitions';
import { IDENTITY_CONTROLS } from './controls-identity';
import { DATA_CONTROLS } from './controls-data';
import { EMAIL_CONTROLS } from './controls-email';
import { AUDIT_CONTROLS } from './controls-audit';
import { CICD_CONTROLS } from './controls-cicd';
import { DEVICE_CONTROLS } from './controls-device';
import { APP_CONTROLS } from './controls-apps';

/** All CIS controls across all sections */
export const ALL_CIS_CONTROLS: CisControl[] = [
	...IDENTITY_CONTROLS,
	...DATA_CONTROLS,
	...EMAIL_CONTROLS,
	...AUDIT_CONTROLS,
	...CICD_CONTROLS,
	...DEVICE_CONTROLS,
	...APP_CONTROLS,
];

/** Unique section names */
export const ALL_CIS_SECTIONS = [...new Set(ALL_CIS_CONTROLS.map(c => c.section))];

/** Controls grouped by section */
export const CONTROLS_BY_SECTION = ALL_CIS_CONTROLS.reduce<Record<string, CisControl[]>>(
	(acc, control) => {
		if (!acc[control.section]) acc[control.section] = [];
		acc[control.section].push(control);
		return acc;
	},
	{},
);

/** Summary counts */
export const CONTROL_COUNTS = {
	total: ALL_CIS_CONTROLS.length,
	critical: ALL_CIS_CONTROLS.filter(c => c.severity === 'critical').length,
	high: ALL_CIS_CONTROLS.filter(c => c.severity === 'high').length,
	medium: ALL_CIS_CONTROLS.filter(c => c.severity === 'medium').length,
	low: ALL_CIS_CONTROLS.filter(c => c.severity === 'low').length,
	autoRemediable: ALL_CIS_CONTROLS.filter(c => c.autoRemediable).length,
	sections: ALL_CIS_SECTIONS.length,
};
