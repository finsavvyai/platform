/**
 * SaaS OAuth Risk Scoring Tests
 */
import { describe, it, expect } from 'vitest';
import { assessOAuthRisk } from './saas-oauth-risk.js';

describe('OAuth Risk Scoring', () => {
  it('returns low risk for no scopes', () => {
    const result = assessOAuthRisk('Some App', 'github', []);
    expect(result.riskScore).toBe(0);
    expect(result.riskLevel).toBe('low');
    expect(result.isAiAgent).toBe(false);
  });

  it('detects high-risk GitHub scopes', () => {
    const result = assessOAuthRisk('My Tool', 'github', ['repo', 'admin:org', 'read:user']);
    expect(result.riskScore).toBe(30);
    expect(result.riskLevel).toBe('medium');
    expect(result.highRiskScopes).toEqual(['repo', 'admin:org']);
  });

  it('detects AI agent apps', () => {
    const result = assessOAuthRisk('Cursor AI', 'github', ['repo']);
    expect(result.isAiAgent).toBe(true);
    expect(result.riskScore).toBeGreaterThan(40);
    expect(result.reasons).toContain('App identified as AI agent');
  });

  it('flags AI agent with high-risk scopes as critical', () => {
    const result = assessOAuthRisk('Cursor Editor', 'github', ['repo', 'admin:org', 'delete_repo']);
    expect(result.riskLevel).toBe('critical');
    expect(result.isAiAgent).toBe(true);
  });

  it('penalizes excessive scopes', () => {
    const scopes = Array.from({ length: 12 }, (_, i) => `scope-${i}`);
    const result = assessOAuthRisk('Big App', 'github', scopes);
    expect(result.reasons).toContain('Excessive scope count (>10)');
  });

  it('caps score at 100', () => {
    const result = assessOAuthRisk('Copilot Agent', 'github', [
      'repo', 'admin:org', 'delete_repo', 'admin:enterprise', 'write:packages',
      ...Array.from({ length: 11 }, (_, i) => `scope-${i}`),
    ]);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });
});
