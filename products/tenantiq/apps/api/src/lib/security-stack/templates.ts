/** Security stack action registry and pre-built templates. */

import type { ConfigAction } from '../security-stack-configurator';
import * as configurator from '../security-stack-configurator';
import * as dlp from '../security-stack-configurator-dlp';

export type ActionExecutor = (graph: unknown, options?: Record<string, unknown>) => Promise<ConfigAction>;

export const actionMap: Record<string, Record<string, ActionExecutor>> = {
	'conditional-access': {
		'mfa-enforcement': configurator.createMfaEnforcementPolicy as ActionExecutor,
		'device-compliance': configurator.createDeviceCompliancePolicy as ActionExecutor,
		'location-restriction': configurator.createLocationRestrictionPolicy as ActionExecutor,
		'block-legacy-auth': configurator.blockLegacyAuthPolicy as ActionExecutor,
	},
	'dlp': {
		'basic-dlp': dlp.createBasicDlpPolicy as ActionExecutor,
		'sensitivity-labels': dlp.enableSensitivityLabels as ActionExecutor,
	},
	'identity-protection': {
		'signin-risk': dlp.enableSignInRiskPolicy as ActionExecutor,
		'user-risk': dlp.enableUserRiskPolicy as ActionExecutor,
	},
};

export interface Template {
	name: string;
	product: string;
	actions: Array<{ action: string; options?: Record<string, unknown> }>;
	description: string;
}

export const SECURITY_TEMPLATES: Template[] = [
	{
		name: 'Basic Protection',
		product: 'all',
		description: 'MFA for admins + block legacy auth',
		actions: [
			{ action: 'mfa-enforcement', options: { adminOnly: true } },
			{ action: 'block-legacy-auth' },
		],
	},
	{
		name: 'Standard Security',
		product: 'all',
		description: 'MFA for all + device compliance + basic DLP',
		actions: [
			{ action: 'mfa-enforcement', options: { allUsers: true } },
			{ action: 'device-compliance' },
			{ action: 'basic-dlp', options: { name: 'Standard DLP Policy' } },
		],
	},
	{
		name: 'Enterprise Hardening',
		product: 'all',
		description: 'All protections + location/risk policies',
		actions: [
			{ action: 'mfa-enforcement', options: { allUsers: true } },
			{ action: 'device-compliance' },
			{ action: 'basic-dlp' },
			{ action: 'location-restriction', options: { allowedCountries: ['US', 'CA'] } },
			{ action: 'block-legacy-auth' },
			{ action: 'signin-risk', options: { riskLevel: 'medium' } },
			{ action: 'user-risk', options: { riskLevel: 'medium' } },
			{ action: 'sensitivity-labels' },
		],
	},
];
