export interface ScorecardData {
  overall: number;
  grade: string;
  instanceName: string;
  lastUpdated: string;
  categories: Record<string, number>;
  recommendationCount: number;
}

export function buildShareText(instanceName: string, overall: number, grade: string): string {
  return `${instanceName} has a live OpenSyber trust page with a ${grade} security score (${overall}/100).`;
}
