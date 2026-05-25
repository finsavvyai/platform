/**
 * Onboarding Advisor — Type definitions
 */

export interface OnboardingRequest {
	userName: string;
	email: string;
	role: string;
	department: string;
	startDate: string;
	manager?: string;
	similarUserEmail?: string; // "Make them like this person"
	customRequirements?: string[];
}

export interface ProvisioningPlan {
	user: {
		displayName: string;
		email: string;
		department: string;
		jobTitle: string;
	};
	licenses: LicenseRecommendation[];
	groups: GroupRecommendation[];
	applications: ApplicationRecommendation[];
	securitySettings: SecurityRecommendation[];
	estimatedCost: {
		monthly: number;
		annual: number;
	};
	timeline: TimelineStep[];
	approvals: ApprovalRequirement[];
	reasoning: string;
}

export interface LicenseRecommendation {
	skuId: string;
	skuName: string;
	reason: string;
	cost: number;
	priority: 'required' | 'recommended' | 'optional';
}

export interface GroupRecommendation {
	groupName: string;
	groupType: 'security' | 'microsoft365' | 'distribution';
	reason: string;
	priority: 'required' | 'recommended' | 'optional';
}

export interface ApplicationRecommendation {
	appName: string;
	reason: string;
	priority: 'required' | 'recommended' | 'optional';
}

export interface SecurityRecommendation {
	setting: string;
	value: string;
	reason: string;
	priority: 'required' | 'recommended' | 'optional';
}

export interface TimelineStep {
	step: number;
	action: string;
	estimatedTime: string;
	dependencies: number[];
}

export interface ApprovalRequirement {
	approver: string;
	reason: string;
	required: boolean;
}
