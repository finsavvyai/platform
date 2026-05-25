/**
 * Anomaly Detection — Login Anomaly Detection
 *
 * Detects impossible travel, off-hours logins, and brute force attacks.
 */

import type { AnomalyEvent, LoginEvent } from './types';
import { haversineDistance, generateId } from './detection-helpers';

export function detectLoginAnomalies(events: LoginEvent[]): AnomalyEvent[] {
	const anomalies: AnomalyEvent[] = [];

	// Group events by user
	const byUser = new Map<string, LoginEvent[]>();
	for (const e of events) {
		const list = byUser.get(e.userId) || [];
		list.push(e);
		byUser.set(e.userId, list);
	}

	for (const [userId, userEvents] of byUser) {
		const sorted = userEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		detectImpossibleTravel(sorted, userId, anomalies);
		detectOffHoursLogins(userEvents, userId, anomalies);
		detectBruteForce(userEvents, userId, anomalies);
	}

	return anomalies;
}

function detectImpossibleTravel(sorted: LoginEvent[], userId: string, anomalies: AnomalyEvent[]): void {
	for (let i = 1; i < sorted.length; i++) {
		const prev = sorted[i - 1];
		const curr = sorted[i];
		if (prev.location && curr.location) {
			const dist = haversineDistance(
				prev.location.lat, prev.location.lon,
				curr.location.lat, curr.location.lon
			);
			const timeDiffHours = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60 * 60);
			const speedKmh = timeDiffHours > 0 ? dist / timeDiffHours : Infinity;

			if (speedKmh > 1000 && dist > 500) {
				anomalies.push({
					id: generateId(),
					type: 'impossible_travel',
					severity: 'critical',
					title: `Impossible travel detected for ${curr.userEmail}`,
					description: `Login from ${prev.location.city}, ${prev.location.country} then ${curr.location.city}, ${curr.location.country} (${Math.round(dist)}km apart) within ${timeDiffHours.toFixed(1)} hours`,
					detectedAt: new Date().toISOString(),
					affectedResources: [userId],
					confidence: Math.min(95, 60 + Math.round(speedKmh / 100)),
					baseline: `User typically logs in from ${prev.location.city}`,
					observed: `Login from ${curr.location.city} at impossible speed (${Math.round(speedKmh)} km/h)`,
					deviation: Math.round(speedKmh / 200),
					recommendation: 'Immediately verify this login. Consider disabling the account and resetting credentials.',
					autoRemediable: true,
					category: 'security',
				});
			}
		}
	}
}

function detectOffHoursLogins(userEvents: LoginEvent[], userId: string, anomalies: AnomalyEvent[]): void {
	for (const event of userEvents) {
		const hour = new Date(event.timestamp).getUTCHours();
		if ((hour >= 0 && hour <= 5) || (hour >= 22 && hour <= 23)) {
			anomalies.push({
				id: generateId(),
				type: 'off_hours_login',
				severity: 'medium',
				title: `Off-hours login for ${event.userEmail}`,
				description: `Login at ${new Date(event.timestamp).toLocaleTimeString()} UTC from ${event.ipAddress}`,
				detectedAt: new Date().toISOString(),
				affectedResources: [userId],
				confidence: 65,
				baseline: 'User typically logs in during business hours (8am-6pm)',
				observed: `Login at ${hour}:00 UTC`,
				deviation: 2.5,
				recommendation: 'Verify this was a legitimate login. Consider Conditional Access time-based policies.',
				autoRemediable: false,
				category: 'security',
			});
		}
	}
}

function detectBruteForce(userEvents: LoginEvent[], userId: string, anomalies: AnomalyEvent[]): void {
	const failedLogins = userEvents.filter((e) => !e.success);
	if (failedLogins.length >= 5) {
		const timeWindow = failedLogins.length >= 2
			? (new Date(failedLogins[failedLogins.length - 1].timestamp).getTime() - new Date(failedLogins[0].timestamp).getTime()) / (1000 * 60)
			: 0;
		if (timeWindow <= 30) {
			anomalies.push({
				id: generateId(),
				type: 'brute_force',
				severity: 'critical',
				title: `Possible brute force attack on ${userEvents[0].userEmail}`,
				description: `${failedLogins.length} failed login attempts within ${Math.round(timeWindow)} minutes`,
				detectedAt: new Date().toISOString(),
				affectedResources: [userId],
				confidence: Math.min(95, 50 + failedLogins.length * 5),
				baseline: '0-1 failed logins per day',
				observed: `${failedLogins.length} failed attempts in ${Math.round(timeWindow)} min`,
				deviation: failedLogins.length,
				recommendation: 'Block the source IPs. Reset user password. Enable account lockout policy.',
				autoRemediable: true,
				category: 'security',
			});
		}
	}
}
