import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';

const failedLoginSpike: Rule = {
	id: RULE_IDS.SEC_004,
	name: 'Failed login spike detected',
	severity: 'high',
	category: 'security',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const signIns = (data.signInLogs ?? []) as Array<{
			status?: { errorCode: number };
			createdDateTime: string;
			ipAddress?: string;
		}>;

		const failed = signIns.filter((s) => s.status?.errorCode !== 0);
		const recent = failed.filter(
			(s) => Date.now() - new Date(s.createdDateTime).getTime() < 24 * 60 * 60 * 1000
		);

		if (recent.length > 100) {
			const ipCounts = new Map<string, number>();
			for (const s of recent) {
				const ip = s.ipAddress ?? 'unknown';
				ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
			}

			return [{
				ruleId: RULE_IDS.SEC_004,
				title: `${recent.length} failed login attempts in 24 hours`,
				description: 'Detected an unusual spike in failed login attempts.',
				businessImpact: 'Potential credential attack in progress',
				affectedResources: [...ipCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
					.map(([ip, count]) => ({ ip, failedAttempts: count })),
				recommendedAction: 'Investigate the source IPs and consider blocking them.'
			}];
		}
		return [];
	}
};

const riskySignIns: Rule = {
	id: RULE_IDS.SEC_005,
	name: 'Risky sign-ins unaddressed',
	severity: 'high',
	category: 'security',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const riskyUsers = (data.riskyUsers ?? []) as Array<{
			id: string;
			userDisplayName: string;
			userPrincipalName: string;
			riskState: string;
			riskLevel: string;
		}>;

		const atRisk = riskyUsers.filter((u) => u.riskState === 'atRisk');

		if (atRisk.length > 0) {
			return [{
				ruleId: RULE_IDS.SEC_005,
				title: `${atRisk.length} user(s) with unaddressed risky sign-ins`,
				description: 'Azure AD Identity Protection has flagged users with risky sign-in activity.',
				businessImpact: 'Accounts may be compromised',
				affectedResources: atRisk.map((u) => ({
					id: u.id, name: u.userDisplayName, email: u.userPrincipalName, riskLevel: u.riskLevel
				})),
				recommendedAction: 'Revoke sessions for at-risk users and force password resets.'
			}];
		}
		return [];
	}
};

/** Haversine formula -- distance in km between two lat/lon points */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const impossibleTravel: Rule = {
	id: RULE_IDS.SEC_003,
	name: 'Impossible travel detected',
	severity: 'critical',
	category: 'security',
	remediationType: 'semi_automatic',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const signIns = (data.signInLogs ?? []) as Array<{
			userId?: string;
			userPrincipalName: string;
			createdDateTime: string;
			status?: { errorCode: number };
			location?: {
				countryOrRegion?: string;
				city?: string;
				geoCoordinates?: { latitude: number; longitude: number };
			};
		}>;

		const successful = signIns.filter((s) => s.status?.errorCode === 0);

		const byUser = new Map<string, typeof successful>();
		for (const s of successful) {
			const key = s.userId ?? s.userPrincipalName;
			if (!byUser.has(key)) byUser.set(key, []);
			byUser.get(key)!.push(s);
		}

		const alerts: AlertCandidate[] = [];
		const SPEED_THRESHOLD_KPH = 800;

		for (const [userId, userSignIns] of byUser) {
			const sorted = userSignIns.sort(
				(a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime()
			);

			for (let i = 1; i < sorted.length; i++) {
				const prev = sorted[i - 1];
				const curr = sorted[i];
				const timeDiffHours =
					(new Date(curr.createdDateTime).getTime() - new Date(prev.createdDateTime).getTime()) / 3600000;

				if (timeDiffHours <= 0) continue;

				if (prev.location?.geoCoordinates && curr.location?.geoCoordinates) {
					const distance = haversineDistance(
						prev.location.geoCoordinates.latitude,
						prev.location.geoCoordinates.longitude,
						curr.location.geoCoordinates.latitude,
						curr.location.geoCoordinates.longitude
					);
					const speedKph = distance / timeDiffHours;

					if (speedKph > SPEED_THRESHOLD_KPH) {
						alerts.push({
							ruleId: RULE_IDS.SEC_003,
							title: 'Impossible travel detected for user',
							description: `Would require ${speedKph.toFixed(0)} km/h travel (${distance.toFixed(0)} km in ${timeDiffHours.toFixed(1)} hours)`,
							businessImpact: 'Account may be compromised — credentials potentially shared or stolen',
							affectedResources: [{ userId, from: prev.location, to: curr.location, distanceKm: Math.round(distance), speedKph: Math.round(speedKph) }],
							recommendedAction: 'Revoke user sessions and investigate sign-in activity.'
						});
						break;
					}
				} else if (
					prev.location?.countryOrRegion &&
					curr.location?.countryOrRegion &&
					prev.location.countryOrRegion !== curr.location.countryOrRegion &&
					timeDiffHours < 2
				) {
					alerts.push({
						ruleId: RULE_IDS.SEC_003,
						title: 'Impossible travel detected for user',
						description: `Sign-in from ${prev.location.countryOrRegion} then ${curr.location.countryOrRegion} within ${timeDiffHours.toFixed(1)} hours`,
						businessImpact: 'Account may be compromised — credentials potentially shared or stolen',
						affectedResources: [{ userId, from: prev.location, to: curr.location, timeDiffHours: Math.round(timeDiffHours * 10) / 10 }],
						recommendedAction: 'Revoke user sessions and investigate sign-in activity.'
					});
					break;
				}
			}
		}

		return alerts;
	}
};

export const signInRules: Rule[] = [failedLoginSpike, riskySignIns, impossibleTravel];
