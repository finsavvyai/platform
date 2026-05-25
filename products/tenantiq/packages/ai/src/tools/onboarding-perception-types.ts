/**
 * Onboarding Perception — Type Definitions
 * Interfaces for status tracking, checklists, emails, and metrics
 */

export interface OnboardingStatus {
	id: string;
	employeeName: string;
	employeeEmail: string;
	role: string;
	department: string;
	startDate: string;
	status: 'pending' | 'in_progress' | 'completed' | 'failed';
	currentStep: number;
	totalSteps: number;
	progress: number; // 0-100
	steps: OnboardingStepStatus[];
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
	estimatedCompletion?: string;
}

export interface OnboardingStepStatus {
	step: number;
	name: string;
	status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
	startedAt?: string;
	completedAt?: string;
	duration?: number; // seconds
	error?: string;
	details?: Record<string, any>;
}

export interface WelcomeEmail {
	to: string;
	subject: string;
	body: string;
	attachments?: WelcomeEmailAttachment[];
}

export interface WelcomeEmailAttachment {
	name: string;
	content: string;
	type: 'pdf' | 'docx' | 'link';
}

export interface OnboardingChecklist {
	day1: ChecklistItem[];
	week1: ChecklistItem[];
	month1: ChecklistItem[];
}

export interface ChecklistItem {
	id: string;
	title: string;
	description: string;
	category: 'setup' | 'training' | 'meeting' | 'task' | 'reading';
	priority: 'high' | 'medium' | 'low';
	estimatedTime: string;
	completed: boolean;
	dueDate?: string;
	assignedTo?: string;
	resources?: ChecklistResource[];
}

export interface ChecklistResource {
	title: string;
	url: string;
	type: 'video' | 'document' | 'link' | 'course';
}

export interface OnboardingMetrics {
	totalOnboardings: number;
	averageCompletionTime: number; // minutes
	successRate: number; // percentage
	byRole: Record<string, RoleMetrics>;
	byDepartment: Record<string, DepartmentMetrics>;
	commonIssues: IssueMetric[];
	timeToProductivity: number; // days
}

export interface RoleMetrics {
	count: number;
	averageTime: number;
	successRate: number;
	averageCost: number;
}

export interface DepartmentMetrics {
	count: number;
	averageTime: number;
	successRate: number;
}

export interface IssueMetric {
	issue: string;
	count: number;
	averageResolutionTime: number;
}
