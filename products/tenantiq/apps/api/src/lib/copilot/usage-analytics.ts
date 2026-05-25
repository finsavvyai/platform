/**
 * Copilot Usage Analytics — adoption tracking, ROI calculation, inactive flagging.
 */

/** Average hourly rate for productivity savings estimate (USD) */
const AVG_HOURLY_RATE = 50;
/** Estimated hours saved per active Copilot user per month */
const HOURS_SAVED_PER_USER = 10;
/** Monthly Copilot license cost per user (USD) */
const LICENSE_COST_PER_USER = 30;

export interface AdoptionData {
	totalLicensed: number;
	activeUsers: number;
	adoptionRate: number;
	totalUsers: number;
	byApp: Record<string, number>;
	userDetails: UserAdoption[];
}

export interface UserAdoption {
	displayName: string;
	userPrincipalName: string;
	lastActivityDate: string | null;
	isActive: boolean;
	appsUsed: string[];
}

export interface RoiData {
	monthlyCost: number;
	monthlyProductivityValue: number;
	netRoi: number;
	roiPercentage: number;
	hoursSavedPerMonth: number;
}

export interface InactiveUser {
	displayName: string;
	userPrincipalName: string;
	licensedSince: string | null;
	lastActivityDate: string | null;
	monthlyCost: number;
}

const APP_FIELDS: Array<[string, string]> = [
	['wordLastActivityDate', 'Word'],
	['excelLastActivityDate', 'Excel'],
	['powerpointLastActivityDate', 'PowerPoint'],
	['teamsLastActivityDate', 'Teams'],
	['outlookLastActivityDate', 'Outlook'],
];

/** Build per-user adoption data from Graph Copilot usage report */
export function buildAdoption(copilotUsers: any[]): AdoptionData {
	const userDetails: UserAdoption[] = copilotUsers.map((u) => {
		const appsUsed = APP_FIELDS
			.filter(([field]) => u[field])
			.map(([, label]) => label);

		return {
			displayName: u.displayName || u.userPrincipalName || 'Unknown',
			userPrincipalName: u.userPrincipalName || '',
			lastActivityDate: u.lastActivityDate || null,
			isActive: !!u.lastActivityDate,
			appsUsed,
		};
	});

	const activeUsers = userDetails.filter((u) => u.isActive).length;
	const byApp: Record<string, number> = {};
	for (const [field, label] of APP_FIELDS) {
		byApp[label.toLowerCase()] = copilotUsers.filter((u) => u[field]).length;
	}

	return {
		totalLicensed: copilotUsers.length,
		activeUsers,
		adoptionRate: copilotUsers.length > 0 ? Math.round((activeUsers / copilotUsers.length) * 100) : 0,
		totalUsers: copilotUsers.length,
		byApp,
		userDetails,
	};
}

/** Calculate ROI: productivity value vs license cost */
export function buildRoi(activeUsers: number, totalLicensed: number): RoiData {
	const monthlyCost = totalLicensed * LICENSE_COST_PER_USER;
	const hoursSavedPerMonth = activeUsers * HOURS_SAVED_PER_USER;
	const monthlyProductivityValue = hoursSavedPerMonth * AVG_HOURLY_RATE;
	const netRoi = monthlyProductivityValue - monthlyCost;
	const roiPercentage = monthlyCost > 0 ? Math.round((netRoi / monthlyCost) * 100) : 0;

	return { monthlyCost, monthlyProductivityValue, netRoi, roiPercentage, hoursSavedPerMonth };
}

/** Flag licensed users with no activity in last 30 days */
export function flagInactive(copilotUsers: any[]): InactiveUser[] {
	return copilotUsers
		.filter((u) => !u.lastActivityDate)
		.map((u) => ({
			displayName: u.displayName || u.userPrincipalName || 'Unknown',
			userPrincipalName: u.userPrincipalName || '',
			licensedSince: u.assignedDate || null,
			lastActivityDate: null,
			monthlyCost: LICENSE_COST_PER_USER,
		}));
}
