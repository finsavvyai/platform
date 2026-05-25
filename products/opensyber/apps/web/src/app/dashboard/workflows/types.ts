export interface WorkflowStep {
  id: string;
  type: 'condition' | 'action' | 'notification' | 'enrichment';
  name: string;
  config: Record<string, string>;
  icon: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status: 'active' | 'inactive' | 'draft';
  steps: WorkflowStep[];
  lastRun: string | null;
  runCount: number;
  avgDuration: string;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'running';
  startedAt: string;
  duration: string;
  stepsCompleted: number;
  totalSteps: number;
}
