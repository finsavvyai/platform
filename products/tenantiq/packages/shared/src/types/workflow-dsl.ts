// ============================================================
// Workflow DSL — declarative workflow template definitions
// ============================================================

export type StepType = 'action' | 'condition' | 'delay' | 'approval' | 'notification';
export type TriggerType = 'schedule' | 'event' | 'manual' | 'ai';
export type TemplateCategory = 'license' | 'security' | 'lifecycle' | 'governance';

export interface WorkflowStep {
	id: string;
	type: StepType;
	name: string;
	config: Record<string, unknown>;
	onSuccess?: string;
	onFailure?: string;
}

export interface WorkflowTemplate {
	id: string;
	name: string;
	description: string;
	category: TemplateCategory;
	triggerType: TriggerType;
	steps: WorkflowStep[];
	tags: string[];
	estimatedDurationMinutes: number;
}

export interface InstalledWorkflow {
	id: string;
	templateId: string;
	tenantId: string;
	orgId: string;
	name: string;
	enabled: boolean;
	overrides: Record<string, unknown>;
	installedAt: string;
	installedBy: string;
}

export interface WorkflowExecutionContext {
	tenantId: string;
	orgId: string;
	triggeredBy: string;
	triggerType: TriggerType;
	parameters: Record<string, unknown>;
}

export function isValidStepChain(steps: WorkflowStep[]): boolean {
	const ids = new Set(steps.map((s) => s.id));
	for (const step of steps) {
		if (step.onSuccess && !ids.has(step.onSuccess)) return false;
		if (step.onFailure && !ids.has(step.onFailure)) return false;
	}
	return true;
}
