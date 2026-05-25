/**
 * Extended Graph API methods — security, identity protection, and reports.
 * All methods return [] or null on failure (graceful degradation).
 */

import { GraphClient, type GraphResponse } from './graph-client';

/** Fetch conditional access policies from Azure AD. */
export async function getConditionalAccessPolicies(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch('/identity/conditionalAccess/policies');
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch risky users from Identity Protection. */
export async function getRiskyUsers(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch('/identityProtection/riskyUsers');
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch risk detections (sign-in and user risk events). */
export async function getRiskDetections(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			'/identityProtection/riskDetections?$top=50&$orderby=detectedDateTime desc'
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch MFA registration details for all users. */
export async function getMfaRegistrationDetails(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			'/reports/authenticationMethods/userRegistrationDetails?$top=999'
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch directory roles with expanded members (shows who is Global Admin, etc.). */
export async function getDirectoryRoles(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch('/directoryRoles?$expand=members');
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch app registrations with credential info (for expiry checking). */
export async function getAppRegistrations(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			'/applications?$select=id,displayName,passwordCredentials,keyCredentials&$top=999'
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch mailbox usage report (7-day). Returns JSON if $format supported, else []. */
export async function getMailboxUsage(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			"/reports/getMailboxUsageDetail(period='D7')?$format=application/json"
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch Teams user activity report (7-day). */
export async function getTeamsActivity(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			"/reports/getTeamsUserActivityUserDetail(period='D7')?$format=application/json"
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}

/** Fetch SharePoint activity report (7-day). */
export async function getSharePointActivity(graph: GraphClient): Promise<any[]> {
	try {
		const data = await graph.fetch(
			"/reports/getSharePointActivityUserDetail(period='D7')?$format=application/json"
		);
		return data.value ?? [];
	} catch {
		return [];
	}
}
