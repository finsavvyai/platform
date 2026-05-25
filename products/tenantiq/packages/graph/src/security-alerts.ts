/**
 * Microsoft Defender for Office 365 — security alerts (alerts_v2) module.
 *
 * Pulls Email-category security alerts and per-alert detail from Microsoft
 * Graph for routing through TenantIQ's existing intel/alert pipeline.
 *
 * References:
 *  - alerts_v2 list:   https://learn.microsoft.com/en-us/graph/api/security-list-alerts_v2
 *  - alert get:        https://learn.microsoft.com/en-us/graph/api/security-alert-get
 *  - alert resource:   https://learn.microsoft.com/en-us/graph/api/resources/security-alert
 *  - Defender for O365 detection sources:
 *    https://learn.microsoft.com/en-us/microsoft-365/security/office-365-security/alerts
 */

import { GraphClient } from './client';

/** alerts_v2 enum: severity. */
export type DefenderAlertSeverity = 'unknown' | 'informational' | 'low' | 'medium' | 'high';

/** alerts_v2 enum: alertStatus. */
export type DefenderAlertStatus =
	| 'unknown'
	| 'new'
	| 'inProgress'
	| 'resolved';

/**
 * alerts_v2 enum: alertClassification.
 * https://learn.microsoft.com/en-us/graph/api/resources/security-alert
 */
export type DefenderAlertClassification =
	| 'unknown'
	| 'falsePositive'
	| 'truePositive'
	| 'informationalExpectedActivity';

/** alerts_v2 enum: alertDetermination (extends classification). */
export type DefenderAlertDetermination =
	| 'unknown'
	| 'apt'
	| 'malware'
	| 'securityPersonnel'
	| 'securityTesting'
	| 'unwantedSoftware'
	| 'other'
	| 'multiStagedAttack'
	| 'compromisedAccount'
	| 'phishing'
	| 'maliciousUserActivity'
	| 'notMalicious'
	| 'notEnoughDataToValidate'
	| 'confirmedActivity'
	| 'lineOfBusinessApplication';

/** Subset of alertEvidence we care about. evidence@odata.type discriminates. */
export interface DefenderAlertEvidence {
	'@odata.type'?: string;
	createdDateTime?: string;
	verdict?: string;
	remediationStatus?: string;
	roles?: string[];
	[key: string]: unknown;
}

/**
 * Top-level Defender alert as returned by /security/alerts_v2.
 * Field shape mirrors microsoft.graph.security.alert.
 */
export interface DefenderAlert {
	id: string;
	providerAlertId?: string;
	title: string;
	description?: string;
	category: string;
	severity: DefenderAlertSeverity;
	status: DefenderAlertStatus;
	classification?: DefenderAlertClassification;
	determination?: DefenderAlertDetermination;
	serviceSource?: string;
	detectionSource?: string;
	detectorId?: string;
	tenantId?: string;
	createdDateTime: string;
	lastUpdateDateTime?: string;
	firstActivityDateTime?: string;
	lastActivityDateTime?: string;
	threatDisplayName?: string;
	mitreTechniques?: string[];
	recommendedActions?: string;
	evidence?: DefenderAlertEvidence[];
}

/**
 * Detail view returned by /security/alerts_v2/{id}.
 * Same shape as DefenderAlert plus additional comments + full evidence.
 */
export interface DefenderAlertDetail extends DefenderAlert {
	comments?: Array<{
		comment: string;
		createdByDisplayName?: string;
		createdDateTime?: string;
	}>;
	additionalData?: Record<string, unknown>;
}

export const ALERTS_V2_PATH = '/security/alerts_v2';
export const DEFAULT_ALERT_LIMIT = 100;
export const MAX_ALERT_LIMIT = 1000;

export interface GraphCollection<T> {
	value: T[];
	'@odata.nextLink'?: string;
}

/**
 * Build the $filter expression for Email-category alerts created at-or-after
 * `since`. Graph wants ISO-8601 UTC with no quotes around datetime literals.
 */
export function buildEmailAlertsFilter(since: Date): string {
	if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
		throw new TypeError('buildEmailAlertsFilter: `since` must be a valid Date');
	}
	const iso = since.toISOString();
	return `category eq 'Email' and createdDateTime ge ${iso}`;
}

/**
 * Build the alerts_v2 query path for Email alerts since a given time.
 */
export function buildEmailAlertsPath(since: Date, limit: number): string {
	const top = Math.min(Math.max(1, Math.floor(limit)), MAX_ALERT_LIMIT);
	const filter = encodeURIComponent(buildEmailAlertsFilter(since));
	const orderBy = encodeURIComponent('createdDateTime desc');
	return `${ALERTS_V2_PATH}?$filter=${filter}&$top=${top}&$orderby=${orderBy}`;
}

/**
 * List Email-category Defender for O365 alerts created at-or-after `since`.
 * Calls GET https://graph.microsoft.com/v1.0/security/alerts_v2 with $filter.
 *
 * @throws if the GraphClient throws (e.g., missing token, 4xx/5xx).
 */
export async function listEmailAlerts(
	client: GraphClient,
	tenantId: string,
	since: Date,
	limit: number = DEFAULT_ALERT_LIMIT,
): Promise<DefenderAlert[]> {
	if (!client) throw new TypeError('listEmailAlerts: client is required');
	if (!tenantId) throw new TypeError('listEmailAlerts: tenantId is required');
	const path = buildEmailAlertsPath(since, limit);
	const res = await client.request<GraphCollection<DefenderAlert>>(tenantId, path);
	return Array.isArray(res?.value) ? res.value : [];
}

/**
 * Drill down into a single Defender alert by its Graph alert id.
 * Calls GET https://graph.microsoft.com/v1.0/security/alerts_v2/{alertId}
 */
export async function getAlertDetail(
	client: GraphClient,
	tenantId: string,
	alertId: string,
): Promise<DefenderAlertDetail> {
	if (!client) throw new TypeError('getAlertDetail: client is required');
	if (!tenantId) throw new TypeError('getAlertDetail: tenantId is required');
	if (!alertId) throw new TypeError('getAlertDetail: alertId is required');
	return client.request<DefenderAlertDetail>(
		tenantId,
		`${ALERTS_V2_PATH}/${encodeURIComponent(alertId)}`,
	);
}

/**
 * Convenience wrapper class mirroring the existing module pattern
 * (UserOperations / SecurityOperations). Optional — pure functions above
 * are the canonical surface.
 */
export class DefenderEmailAlertsOperations {
	constructor(private client: GraphClient) {}

	list(tenantId: string, since: Date, limit?: number): Promise<DefenderAlert[]> {
		return listEmailAlerts(this.client, tenantId, since, limit);
	}

	get(tenantId: string, alertId: string): Promise<DefenderAlertDetail> {
		return getAlertDetail(this.client, tenantId, alertId);
	}
}
