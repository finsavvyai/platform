/**
 * PDF report input types and style constants
 */

export interface AgentSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secretsDetected: number;
}

export interface CspmSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface CombinedScore {
  agentScore: number;
  cspmScore: number;
  combined: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface Violation {
  summary: string;
  severity: string;
  createdAt: string;
}

export interface PdfReportInput {
  orgName: string;
  agentSummary: AgentSummary;
  cspmSummary: CspmSummary;
  score: CombinedScore;
  violations: Violation[];
}

export const GRADE_COLORS: Record<string, [number, number, number]> = {
  A: [34, 197, 94],     // green-500
  B: [59, 130, 246],    // blue-500
  C: [245, 158, 11],    // amber-500
  D: [239, 68, 68],     // red-500
  F: [220, 38, 38],     // red-600
};

export const BG_COLOR: [number, number, number] = [10, 10, 10];
export const TEXT_COLOR: [number, number, number] = [255, 255, 255];
export const HEADER_COLOR: [number, number, number] = [26, 26, 26];
export const BORDER_COLOR: [number, number, number] = [51, 51, 51];
