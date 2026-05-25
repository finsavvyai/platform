/**
 * License Reclamation Autopilot — License Cost Data & Downgrade Paths
 */

export const LICENSE_COSTS: Record<string, { name: string; monthlyCost: number }> = {
	ENTERPRISEPREMIUM: { name: 'Microsoft 365 E5', monthlyCost: 57 },
	ENTERPRISEPACK: { name: 'Microsoft 365 E3', monthlyCost: 36 },
	STANDARDPACK: { name: 'Microsoft 365 E1', monthlyCost: 10 },
	'O365_BUSINESS_PREMIUM': { name: 'Microsoft 365 Business Premium', monthlyCost: 22 },
	'O365_BUSINESS_ESSENTIALS': { name: 'Microsoft 365 Business Basic', monthlyCost: 6 },
	VISIOCLIENT: { name: 'Visio Plan 2', monthlyCost: 15 },
	PROJECTPREMIUM: { name: 'Project Plan 5', monthlyCost: 55 },
	PROJECTPROFESSIONAL: { name: 'Project Plan 3', monthlyCost: 30 },
	POWER_BI_PRO: { name: 'Power BI Pro', monthlyCost: 10 },
	POWER_BI_PREMIUM_PER_USER: { name: 'Power BI Premium Per User', monthlyCost: 20 },
	EMS_E5: { name: 'Enterprise Mobility + Security E5', monthlyCost: 16 },
	EMS_E3: { name: 'Enterprise Mobility + Security E3', monthlyCost: 11 },
};

export const DOWNGRADE_PATHS: Record<string, { target: string; savings: number }> = {
	ENTERPRISEPREMIUM: { target: 'ENTERPRISEPACK', savings: 21 },
	ENTERPRISEPACK: { target: 'STANDARDPACK', savings: 26 },
	'O365_BUSINESS_PREMIUM': { target: 'O365_BUSINESS_ESSENTIALS', savings: 16 },
	PROJECTPREMIUM: { target: 'PROJECTPROFESSIONAL', savings: 25 },
	POWER_BI_PREMIUM_PER_USER: { target: 'POWER_BI_PRO', savings: 10 },
	EMS_E5: { target: 'EMS_E3', savings: 5 },
};
