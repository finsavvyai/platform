import { describe, it, expect } from 'vitest';
import { classifyAiRisk, AI_RISK_CATEGORIES } from './eu-ai-act.js';

describe('EU AI Act - Risk Classification', () => {
  it('should return minimal risk for system with no risk factors', () => {
    const system = {
      id: 'system-1',
      name: 'Simple Task',
      purpose: 'Text processing',
      riskFactors: [],
    };

    const classification = classifyAiRisk(system);

    expect(classification.riskLevel).toBe('minimal');
    expect(classification.score).toBe(0);
  });

  it('should return minimal risk for automated-decision-making', () => {
    const classification = classifyAiRisk({
      id: 'system-1',
      name: 'Approval System',
      purpose: 'Automated approvals',
      riskFactors: ['automated-decision-making'],
    });

    expect(classification.riskLevel).toBe('minimal');
    expect(classification.score).toBe(20);
  });

  it('should return minimal risk for critical-infrastructure', () => {
    const classification = classifyAiRisk({
      id: 'system-1',
      name: 'Power Grid AI',
      purpose: 'Manage power grid',
      riskFactors: ['critical-infrastructure'],
    });

    expect(classification.riskLevel).toBe('minimal');
    expect(classification.score).toBe(30);
  });

  it('should return minimal risk for law-enforcement', () => {
    const classification = classifyAiRisk({
      id: 'system-1',
      name: 'Crime Detection',
      purpose: 'Predict crime',
      riskFactors: ['law-enforcement'],
    });

    expect(classification.riskLevel).toBe('minimal');
    expect(classification.score).toBe(35);
  });

  it('should return limited risk for biometric-identification', () => {
    const classification = classifyAiRisk({
      id: 'system-1',
      name: 'Face Recognition',
      purpose: 'Identify faces',
      riskFactors: ['biometric-identification'],
    });

    expect(classification.riskLevel).toBe('limited');
    expect(classification.score).toBe(40);
  });

  it('should use maximum score when multiple factors present', () => {
    const classification = classifyAiRisk({
      id: 'sys-1',
      name: 'Complex',
      purpose: 'Multi',
      riskFactors: ['automated-decision-making', 'critical-infrastructure'],
    });

    expect(classification.score).toBe(30);
    expect(classification.riskLevel).toBe('minimal');
  });

  it('should include all risk factors in result', () => {
    const classification = classifyAiRisk({
      id: 'sys-1',
      name: 'Multi-factor',
      purpose: 'Test',
      riskFactors: ['biometric-identification', 'fundamental-rights'],
    });

    expect(classification.factors).toContain('biometric-identification');
    expect(classification.factors).toContain('fundamental-rights');
    expect(classification.factors).toHaveLength(2);
  });

  it('should default unknown factors to weight 10', () => {
    const classification = classifyAiRisk({
      id: 'sys-1',
      name: 'Test',
      purpose: 'Test',
      riskFactors: ['unknown-factor'],
    });
    expect(classification.score).toBe(10);
  });

  it('AI_RISK_CATEGORIES has 4 levels', () => {
    expect(AI_RISK_CATEGORIES.MINIMAL).toBe('minimal');
    expect(AI_RISK_CATEGORIES.LIMITED).toBe('limited');
    expect(AI_RISK_CATEGORIES.HIGH_RISK).toBe('high-risk');
    expect(AI_RISK_CATEGORIES.UNACCEPTABLE).toBe('unacceptable');
  });
});
