/**
 * Compliance Posture — Type Definitions
 *
 * Shared types for compliance framework assessment,
 * gap analysis, drift detection, and audit readiness.
 */

export interface ComplianceFramework {
	id: string;
	name: string;
	version: string;
	description: string;
	controlCount: number;
	passedControls: number;
	failedControls: number;
	notApplicable: number;
	score: number; // 0-100
	grade: string;
	lastAssessedAt: string;
	controls: ComplianceControl[];
}

export interface ComplianceControl {
	id: string;
	frameworkId: string;
	controlNumber: string;
	title: string;
	description: string;
	category: string;
	status: 'passed' | 'failed' | 'partial' | 'not_applicable' | 'not_assessed';
	severity: 'critical' | 'high' | 'medium' | 'low';
	evidence: string[];
	remediationSteps?: string[];
	automatable: boolean;
	lastChecked: string;
}

export interface CompliancePosture {
	tenantId: string;
	tenantName: string;
	generatedAt: string;
	overallScore: number;
	overallGrade: string;
	frameworks: ComplianceFramework[];
	criticalGaps: ComplianceGap[];
	driftAlerts: DriftAlert[];
	auditReadiness: AuditReadiness;
	recommendations: ComplianceRecommendation[];
}

export interface ComplianceGap {
	controlId: string;
	framework: string;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	businessImpact: string;
	remediationEffort: 'low' | 'medium' | 'high';
	estimatedTime: string;
}

export interface DriftAlert {
	id: string;
	previousStatus: string;
	currentStatus: string;
	controlId: string;
	framework: string;
	detectedAt: string;
	description: string;
}

export interface AuditReadiness {
	score: number;
	ready: boolean;
	missingEvidence: string[];
	expiringPolicies: string[];
	recommendations: string[];
}

export interface ComplianceRecommendation {
	priority: number;
	title: string;
	description: string;
	impact: string;
	frameworks: string[];
	automatable: boolean;
}
