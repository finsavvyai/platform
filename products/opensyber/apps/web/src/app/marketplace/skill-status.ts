export type SkillLifecycleStatus = 'live' | 'ready' | 'coming-soon';

const STATUS_BY_SLUG: Record<string, SkillLifecycleStatus> = {
  'log-analyzer': 'live',
  'ruflo-aidefence': 'live',
  'ai-triage': 'ready',
  'ai-reasoning-engine': 'ready',
  'ai-remediation': 'ready',
  'ai-threat-intel': 'ready',
  'ai-compliance-writer': 'ready',
  'ai-incident-responder': 'ready',
  'github-integration': 'ready',
  'slack-notifier': 'ready',
  'credential-rotator': 'ready',
  'prompt-guard': 'ready',
  'voice-synthesis': 'ready',
  'pipeline-security-scanner': 'ready',
  'agent-behavior-profiler': 'coming-soon',
  'dependency-auditor': 'coming-soon',
  'mcp-auditor': 'coming-soon',
  'supply-chain-guard': 'coming-soon',
};

export function getSkillStatus(slug: string): SkillLifecycleStatus {
  return STATUS_BY_SLUG[slug] ?? 'live';
}

export function isInstallable(status: SkillLifecycleStatus): boolean {
  return status !== 'coming-soon';
}

export const STATUS_LABELS: Record<SkillLifecycleStatus, string> = {
  live: 'Available',
  ready: 'Connect',
  'coming-soon': 'Coming Soon',
};
