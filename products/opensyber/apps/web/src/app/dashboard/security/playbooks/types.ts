export interface PlaybookStep {
  type: string;
  config: Record<string, unknown>;
}

export interface Playbook {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  steps: PlaybookStep[];
  status: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookRun {
  id: string;
  playbookId: string;
  playbookName?: string;
  status: string;
  triggeredBy: string | null;
  startedAt: string;
  completedAt: string | null;
  stepsCompleted: number;
  stepsTotal: number;
  error: string | null;
  createdAt: string;
}

export const STEP_TYPES = [
  'suspend_agent',
  'revoke_secret',
  'notify',
  'block_ip',
  'rotate_credential',
  'quarantine_file',
  'create_incident',
  'webhook',
] as const;

export const TRIGGER_TYPES = [
  'manual',
  'policy_violation',
  'threshold',
] as const;

export const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  disabled: 'bg-neutral-800 text-neutral-400',
  archived: 'bg-neutral-800 text-neutral-500',
  completed: 'bg-green-500/10 text-green-400',
  running: 'bg-amber-500/10 text-amber-400',
  pending: 'bg-amber-500/10 text-amber-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-neutral-800 text-neutral-400',
};

export const triggerLabels: Record<string, string> = {
  manual: 'Manual',
  policy_violation: 'Policy Violation',
  threshold: 'Threshold',
};

export const stepTypeLabels: Record<string, string> = {
  suspend_agent: 'Suspend Agent',
  revoke_secret: 'Revoke Secret',
  notify: 'Notify',
  block_ip: 'Block IP',
  rotate_credential: 'Rotate Credential',
  quarantine_file: 'Quarantine File',
  create_incident: 'Create Incident',
  webhook: 'Webhook',
};
