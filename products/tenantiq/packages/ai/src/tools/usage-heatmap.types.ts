/**
 * Usage Heatmap & Adoption Scoring — Type Definitions
 */

export interface ServiceUsage {
	service: string;
	icon: string;
	activeUsers: number;
	totalLicensed: number;
	adoptionRate: number; // 0-100
	trend: 'growing' | 'stable' | 'declining';
	trendDelta: number;
	avgSessionsPerWeek: number;
	topFeatures: string[];
}

export interface DepartmentAdoption {
	department: string;
	userCount: number;
	services: { service: string; adoptionRate: number; color: string }[];
	overallScore: number;
	champion?: string; // top adopter email
}

export interface TimePattern {
	hour: number; // 0-23
	dayOfWeek: number; // 0-6 (Sun-Sat)
	activeUsers: number;
	intensity: number; // 0-100
}

export interface AdoptionScore {
	overall: number; // 0-100
	grade: string;
	servicesAbove80: number;
	servicesBelow50: number;
	topService: { name: string; rate: number };
	bottomService: { name: string; rate: number };
	recommendations: AdoptionRecommendation[];
	licenseSuggestions: LicenseSuggestion[];
}

export interface AdoptionRecommendation {
	priority: 'high' | 'medium' | 'low';
	service: string;
	title: string;
	description: string;
	estimatedImpact: string;
	actionType: 'training' | 'communication' | 'configuration' | 'champion_program';
}

export interface LicenseSuggestion {
	userEmail: string;
	displayName: string;
	currentLicense: string;
	suggestedLicense: string;
	reason: string;
	monthlySavings: number;
	servicesUsed: string[];
	servicesUnused: string[];
}

export interface UsageHeatmapResult {
	tenantId: string;
	tenantName: string;
	generatedAt: string;
	period: string;
	serviceUsage: ServiceUsage[];
	departmentAdoption: DepartmentAdoption[];
	timePatterns: TimePattern[];
	adoptionScore: AdoptionScore;
	insights: UsageInsight[];
	shareableCard: ShareableAdoptionCard;
}

export interface UsageInsight {
	type: 'opportunity' | 'risk' | 'achievement';
	icon: string;
	title: string;
	detail: string;
	metric?: string;
}

export interface ShareableAdoptionCard {
	title: string;
	score: number;
	grade: string;
	topServices: { name: string; rate: number; icon: string }[];
	insight: string;
	shareUrl: string;
}

export interface UsageInput {
	totalUsers: number;
	serviceAdoption: Record<
		string,
		{ activeUsers: number; licensedUsers: number; avgSessions?: number; trendDelta?: number }
	>;
	departments?: { name: string; userCount: number; serviceRates: Record<string, number> }[];
	timePatterns?: TimePattern[];
}
