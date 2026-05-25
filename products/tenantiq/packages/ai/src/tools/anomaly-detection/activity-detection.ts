/**
 * Anomaly Detection — Activity Metrics Anomaly Detection
 *
 * Detects anomalies in tenant-wide activity metrics:
 * failed login spikes, cost spikes, guest surges, shadow IT,
 * external sharing spikes, and admin action spikes.
 */

import type { AnomalyEvent, ActivityMetrics } from './types';
import { detectMetricAnomaly, generateId } from './detection-helpers';

export function detectActivityAnomalies(metrics: ActivityMetrics): AnomalyEvent[] {
	const anomalies: AnomalyEvent[] = [];

	checkFailedLogins(metrics, anomalies);
	checkCostSpike(metrics, anomalies);
	checkGuestSurge(metrics, anomalies);
	checkShadowIT(metrics, anomalies);
	checkExternalSharing(metrics, anomalies);
	checkAdminActions(metrics, anomalies);

	return anomalies;
}

function checkFailedLogins(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const failedCheck = detectMetricAnomaly('failed_logins', metrics.failedLoginsToday, metrics.failedLoginsBaseline);
	if (failedCheck.isAnomaly && failedCheck.direction === 'above') {
		anomalies.push({
			id: generateId(),
			type: 'brute_force',
			severity: metrics.failedLoginsToday > metrics.failedLoginsBaseline * 5 ? 'critical' : 'high',
			title: 'Unusual spike in failed logins',
			description: `${metrics.failedLoginsToday} failed logins today vs ${metrics.failedLoginsBaseline} baseline (${failedCheck.deviation}σ above normal)`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: Math.min(95, 60 + Math.abs(failedCheck.deviation) * 10),
			baseline: `${metrics.failedLoginsBaseline} failed logins/day`,
			observed: `${metrics.failedLoginsToday} failed logins today`,
			deviation: failedCheck.deviation,
			recommendation: 'Review failed login sources. Consider enabling Smart Lockout.',
			autoRemediable: false,
			category: 'security',
		});
	}
}

function checkCostSpike(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const costCheck = detectMetricAnomaly('cost', metrics.costToday, metrics.costBaseline, 1.5);
	if (costCheck.isAnomaly && costCheck.direction === 'above') {
		anomalies.push({
			id: generateId(),
			type: 'cost_spike',
			severity: 'high',
			title: 'Unexpected cost increase detected',
			description: `Today's cost ($${metrics.costToday}) is ${Math.round((metrics.costToday / metrics.costBaseline - 1) * 100)}% above baseline ($${metrics.costBaseline})`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: Math.min(90, 55 + Math.abs(costCheck.deviation) * 10),
			baseline: `$${metrics.costBaseline}/day`,
			observed: `$${metrics.costToday}/day`,
			deviation: costCheck.deviation,
			recommendation: 'Review recent license assignments and new subscriptions.',
			autoRemediable: false,
			category: 'cost',
		});
	}
}

function checkGuestSurge(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const guestCheck = detectMetricAnomaly('guests', metrics.guestUsersAdded, metrics.guestUsersBaseline);
	if (guestCheck.isAnomaly && guestCheck.direction === 'above' && metrics.guestUsersAdded > 3) {
		anomalies.push({
			id: generateId(),
			type: 'guest_surge',
			severity: 'medium',
			title: 'Unusual number of guest users added',
			description: `${metrics.guestUsersAdded} guest users added today vs ${metrics.guestUsersBaseline} baseline`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: 70,
			baseline: `${metrics.guestUsersBaseline} guests/day`,
			observed: `${metrics.guestUsersAdded} guests today`,
			deviation: guestCheck.deviation,
			recommendation: 'Review guest access policies. Ensure B2B collaboration controls are in place.',
			autoRemediable: false,
			category: 'compliance',
		});
	}
}

function checkShadowIT(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const appCheck = detectMetricAnomaly('apps', metrics.newAppsConsented, metrics.newAppsBaseline);
	if (appCheck.isAnomaly && metrics.newAppsConsented > 2) {
		anomalies.push({
			id: generateId(),
			type: 'shadow_it',
			severity: 'high',
			title: 'Potential Shadow IT — multiple new app consents',
			description: `${metrics.newAppsConsented} new apps consented today vs ${metrics.newAppsBaseline} baseline`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: 75,
			baseline: `${metrics.newAppsBaseline} new apps/day`,
			observed: `${metrics.newAppsConsented} new apps today`,
			deviation: appCheck.deviation,
			recommendation: 'Review app consent requests. Enable admin consent workflow.',
			autoRemediable: false,
			category: 'security',
		});
	}
}

function checkExternalSharing(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const shareCheck = detectMetricAnomaly('external_sharing', metrics.filesSharedExternally, metrics.filesSharedBaseline);
	if (shareCheck.isAnomaly && shareCheck.direction === 'above' && metrics.filesSharedExternally > 10) {
		anomalies.push({
			id: generateId(),
			type: 'data_exfiltration',
			severity: 'critical',
			title: 'Unusual external file sharing detected',
			description: `${metrics.filesSharedExternally} files shared externally today vs ${metrics.filesSharedBaseline} baseline`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: Math.min(90, 60 + Math.abs(shareCheck.deviation) * 8),
			baseline: `${metrics.filesSharedBaseline} external shares/day`,
			observed: `${metrics.filesSharedExternally} external shares today`,
			deviation: shareCheck.deviation,
			recommendation: 'Investigate shared files immediately. Review DLP policies and conditional access.',
			autoRemediable: false,
			category: 'security',
		});
	}
}

function checkAdminActions(metrics: ActivityMetrics, anomalies: AnomalyEvent[]): void {
	const adminCheck = detectMetricAnomaly('admin_actions', metrics.adminActionsToday, metrics.adminActionsBaseline);
	if (adminCheck.isAnomaly && adminCheck.direction === 'above') {
		anomalies.push({
			id: generateId(),
			type: 'permission_escalation',
			severity: 'high',
			title: 'Unusual admin activity volume',
			description: `${metrics.adminActionsToday} admin actions today vs ${metrics.adminActionsBaseline} baseline`,
			detectedAt: new Date().toISOString(),
			affectedResources: [],
			confidence: 70,
			baseline: `${metrics.adminActionsBaseline} admin actions/day`,
			observed: `${metrics.adminActionsToday} admin actions today`,
			deviation: adminCheck.deviation,
			recommendation: 'Review admin audit log for suspicious changes. Verify all admin accounts.',
			autoRemediable: false,
			category: 'security',
		});
	}
}
