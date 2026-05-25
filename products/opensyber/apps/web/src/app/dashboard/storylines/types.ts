export type StorylineStatus = 'Active' | 'Contained' | 'Resolved';
export type EventSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Verdict = 'Malicious' | 'Suspicious' | 'Benign';

export interface StorylineEvent {
  id: string;
  timestamp: string;
  type: 'process' | 'file' | 'network' | 'registry' | 'credential';
  process: string;
  detail: string;
  severity: EventSeverity;
}

export interface ProcessNode {
  id: string;
  name: string;
  pid: number;
  parentId: string | null;
  suspicious: boolean;
}

export interface Storyline {
  id: string;
  title: string;
  severity: EventSeverity;
  mitreTactics: string[];
  status: StorylineStatus;
  verdict: Verdict;
  startTime: string;
  eventCount: number;
  events: StorylineEvent[];
  processTree: ProcessNode[];
  killChainStages: string[];
}

export const MITRE_STAGES = [
  'Reconnaissance', 'Initial Access', 'Execution', 'Persistence',
  'Privilege Escalation', 'Defense Evasion', 'Credential Access',
  'Discovery', 'Lateral Movement', 'Collection', 'Exfiltration',
];

export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
  Low: 'bg-neutral-500/20 text-neutral-400',
};

export const STATUS_COLORS: Record<StorylineStatus, string> = {
  Active: 'bg-green-500/20 text-green-400',
  Contained: 'bg-amber-500/20 text-amber-400',
  Resolved: 'bg-neutral-500/20 text-neutral-400',
};

export const VERDICT_COLORS: Record<Verdict, string> = {
  Malicious: 'bg-red-500/20 text-red-400',
  Suspicious: 'bg-amber-500/20 text-amber-400',
  Benign: 'bg-green-500/20 text-green-400',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  process: '#3b82f6',
  file: '#22c55e',
  network: '#f59e0b',
  registry: '#a855f7',
  credential: '#ef4444',
};
