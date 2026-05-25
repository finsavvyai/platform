/** Agent returned from the LunaOS API */
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
}

/** Execution run record */
export interface Run {
  id: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

/** Log entry for a run */
export interface RunLog {
  id: string;
  runId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

/** Pipe execution request */
export interface PipeRequest {
  expression: string;
  context?: Record<string, unknown>;
}

/** Pipe execution response */
export interface PipeResponse {
  success: boolean;
  output: string;
  durationMs: number;
}

/** Analyze request for selected code */
export interface AnalyzeRequest {
  code: string;
  language: string;
  agentId?: string;
}

/** Analyze response */
export interface AnalyzeResponse {
  success: boolean;
  analysis: string;
  suggestions: string[];
}

/** API error envelope */
export interface ApiError {
  error: string;
  correlationId?: string;
}

/** Sidebar tree item types */
export type SidebarSection = 'agents' | 'recentRuns' | 'quickActions';

/** Quick action definition */
export interface QuickAction {
  label: string;
  command: string;
  icon: string;
}
