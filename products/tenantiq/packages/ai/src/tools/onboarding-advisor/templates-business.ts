/**
 * Onboarding Advisor — Business role provisioning templates (marketing, sales)
 */

import type { ProvisioningPlan } from './types.js';

export const BUSINESS_TEMPLATES: Record<string, Partial<ProvisioningPlan>> = {
	marketing: {
		licenses: [
			{
				skuId: 'ENTERPRISEPACK',
				skuName: 'Microsoft 365 E3',
				reason: 'Core productivity and collaboration',
				cost: 23,
				priority: 'required',
			},
		],
		groups: [
			{
				groupName: 'Marketing',
				groupType: 'microsoft365',
				reason: 'Marketing team collaboration',
				priority: 'required',
			},
			{
				groupName: 'Content Creators',
				groupType: 'security',
				reason: 'Access to creative tools',
				priority: 'recommended',
			},
		],
		applications: [
			{
				appName: 'Canva',
				reason: 'Design and content creation',
				priority: 'required',
			},
			{
				appName: 'HubSpot',
				reason: 'Marketing automation',
				priority: 'recommended',
			},
		],
		securitySettings: [
			{
				setting: 'MFA',
				value: 'required',
				reason: 'Account security',
				priority: 'required',
			},
		],
	},
	sales: {
		licenses: [
			{
				skuId: 'ENTERPRISEPACK',
				skuName: 'Microsoft 365 E3',
				reason: 'Email, calendar, and Office apps',
				cost: 23,
				priority: 'required',
			},
		],
		groups: [
			{
				groupName: 'Sales',
				groupType: 'microsoft365',
				reason: 'Sales team collaboration',
				priority: 'required',
			},
			{
				groupName: 'CRM Users',
				groupType: 'security',
				reason: 'Customer relationship management access',
				priority: 'required',
			},
		],
		applications: [
			{
				appName: 'Salesforce',
				reason: 'CRM platform',
				priority: 'required',
			},
			{
				appName: 'LinkedIn Sales Navigator',
				reason: 'Lead generation',
				priority: 'recommended',
			},
		],
		securitySettings: [
			{
				setting: 'MFA',
				value: 'required',
				reason: 'Protect customer data',
				priority: 'required',
			},
		],
	},
};
