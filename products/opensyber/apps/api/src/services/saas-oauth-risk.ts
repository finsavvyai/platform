/**
 * SaaS OAuth App Risk Scoring
 *
 * Calculates risk scores for OAuth apps based on scope analysis,
 * with special detection for AI agent OAuth tokens.
 */

const HIGH_RISK_SCOPES: Record<string, string[]> = {
  github: ['repo', 'admin:org', 'delete_repo', 'admin:enterprise', 'write:packages'],
  google: ['https://www.googleapis.com/auth/admin.directory.user', 'https://mail.google.com/'],
  m365: ['Mail.ReadWrite', 'Files.ReadWrite.All', 'Directory.ReadWrite.All', 'User.ReadWrite.All'],
  slack: ['admin', 'channels:write', 'users:write', 'files:write'],
};

const AI_AGENT_INDICATORS = [
  'cursor', 'cline', 'copilot', 'devin', 'claude', 'openai', 'anthropic',
  'ai-agent', 'codegen', 'aider', 'windsurf', 'bolt', 'replit-agent',
];

export interface OAuthRiskResult {
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  isAiAgent: boolean;
  highRiskScopes: string[];
  reasons: string[];
}

export function assessOAuthRisk(
  appName: string,
  provider: string,
  scopes: string[],
): OAuthRiskResult {
  const reasons: string[] = [];
  let score = 0;

  const providerRiskScopes = HIGH_RISK_SCOPES[provider] ?? [];
  const highRiskScopes = scopes.filter((s) => providerRiskScopes.includes(s));

  if (highRiskScopes.length > 0) {
    score += highRiskScopes.length * 15;
    reasons.push(`${highRiskScopes.length} high-risk scopes granted`);
  }

  if (scopes.length > 10) {
    score += 20;
    reasons.push('Excessive scope count (>10)');
  }

  const isAiAgent = AI_AGENT_INDICATORS.some((indicator) =>
    appName.toLowerCase().includes(indicator),
  );

  if (isAiAgent) {
    score += 25;
    reasons.push('App identified as AI agent');

    if (highRiskScopes.length > 0) {
      score += 15;
      reasons.push('AI agent has high-risk scopes');
    }
  }

  score = Math.min(score, 100);
  const riskLevel = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

  return { riskScore: score, riskLevel, isAiAgent, highRiskScopes, reasons };
}
