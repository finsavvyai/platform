/**
 * Onboarding Advisor — Technical role provisioning templates (developer, executive)
 */

import type { ProvisioningPlan } from './types.js';

export const TECHNICAL_TEMPLATES: Record<string, Partial<ProvisioningPlan>> = {
	developer: {
		licenses: [
			{
				skuId: 'ENTERPRISEPACK',
				skuName: 'Microsoft 365 E3',
				reason: 'Core productivity suite for developers',
				cost: 23,
				priority: 'required',
			},
			{
				skuId: 'VISIOCLIENT',
				skuName: 'Visio Plan 2',
				reason: 'Architecture diagrams and technical documentation',
				cost: 15,
				priority: 'recommended',
			},
		],
		groups: [
			{
				groupName: 'Developers',
				groupType: 'security',
				reason: 'Access to development resources',
				priority: 'required',
			},
			{
				groupName: 'GitHub Access',
				groupType: 'security',
				reason: 'Source code repository access',
				priority: 'required',
			},
			{
				groupName: 'VPN Users',
				groupType: 'security',
				reason: 'Remote development environment access',
				priority: 'required',
			},
		],
		applications: [
			{
				appName: 'Visual Studio Code',
				reason: 'Primary development IDE',
				priority: 'required',
			},
			{
				appName: 'Azure DevOps',
				reason: 'CI/CD and project management',
				priority: 'required',
			},
			{
				appName: 'Slack',
				reason: 'Team communication',
				priority: 'required',
			},
		],
		securitySettings: [
			{
				setting: 'MFA',
				value: 'required',
				reason: 'Enhanced security for code access',
				priority: 'required',
			},
			{
				setting: 'Conditional Access',
				value: 'enabled',
				reason: 'Location-based access control',
				priority: 'required',
			},
		],
	},
	executive: {
		licenses: [
			{
				skuId: 'ENTERPRISEPREMIUM',
				skuName: 'Microsoft 365 E5',
				reason: 'Full suite with advanced security and analytics',
				cost: 38,
				priority: 'required',
			},
		],
		groups: [
			{
				groupName: 'Executives',
				groupType: 'security',
				reason: 'Executive-level access',
				priority: 'required',
			},
			{
				groupName: 'Board Members',
				groupType: 'security',
				reason: 'Confidential information access',
				priority: 'recommended',
			},
		],
		applications: [
			{
				appName: 'Power BI',
				reason: 'Business intelligence and reporting',
				priority: 'required',
			},
			{
				appName: 'Microsoft Teams',
				reason: 'Executive communication',
				priority: 'required',
			},
		],
		securitySettings: [
			{
				setting: 'MFA',
				value: 'required',
				reason: 'Critical account protection',
				priority: 'required',
			},
			{
				setting: 'Advanced Threat Protection',
				value: 'enabled',
				reason: 'Enhanced email security',
				priority: 'required',
			},
			{
				setting: 'Information Protection',
				value: 'enabled',
				reason: 'Protect confidential data',
				priority: 'required',
			},
		],
	},
};
