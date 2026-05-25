export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

export interface Finding {
  id: string;
  tool: string;
  ruleId: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  fixSuggestion?: string;
  references?: string[];
  raw?: unknown;
}

export interface ToolResult {
  tool: string;
  ok: boolean;
  durationMs: number;
  findings: Finding[];
  rawOutputPath?: string;
  error?: string;
}

export interface SecConfig {
  strict: boolean;
  severityGates: Record<Severity, 'block' | 'report'>;
  notify: { slack?: string; email?: string; webhook?: string };
  allowOverrides: Array<{ path: string; rules: string[] }>;
}

export const DEFAULT_CONFIG: SecConfig = {
  strict: true,
  severityGates: {
    critical: 'block', high: 'block', medium: 'report', low: 'report', info: 'report',
  },
  notify: {},
  allowOverrides: [],
};

export interface ToolDef {
  name: string;
  binary: string;
  installHint: string;
  versionFlag?: string;
}
