/**
 * Onboarding Advisor — Peer user analysis for provisioning recommendations
 */

import type { GroupRecommendation, LicenseRecommendation, ProvisioningPlan } from './types.js';

/**
 * Analyze peer users to determine provisioning needs
 */
export function analyzePeerUsers(
	peerUsers: Array<{
		displayName: string;
		email: string;
		jobTitle: string;
		department: string;
		assignedLicenses: string[];
		groups: string[];
	}>
): Partial<ProvisioningPlan> {
	if (peerUsers.length === 0) {
		return {};
	}

	// Aggregate common licenses
	const licenseFrequency = new Map<string, number>();
	const groupFrequency = new Map<string, number>();

	for (const peer of peerUsers) {
		for (const license of peer.assignedLicenses) {
			licenseFrequency.set(license, (licenseFrequency.get(license) || 0) + 1);
		}
		for (const group of peer.groups) {
			groupFrequency.set(group, (groupFrequency.get(group) || 0) + 1);
		}
	}

	// Determine most common licenses (>50% of peers have it)
	const threshold = peerUsers.length * 0.5;
	const commonLicenses: LicenseRecommendation[] = [];
	const commonGroups: GroupRecommendation[] = [];

	for (const [license, count] of licenseFrequency.entries()) {
		if (count >= threshold) {
			commonLicenses.push({
				skuId: license,
				skuName: license,
				reason: `${count} out of ${peerUsers.length} peers in similar role have this license`,
				cost: 0, // Would be looked up from pricing API
				priority: 'recommended',
			});
		}
	}

	for (const [group, count] of groupFrequency.entries()) {
		if (count >= threshold) {
			commonGroups.push({
				groupName: group,
				groupType: 'security',
				reason: `${count} out of ${peerUsers.length} peers are members`,
				priority: 'recommended',
			});
		}
	}

	return {
		licenses: commonLicenses,
		groups: commonGroups,
	};
}
