import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEngine } from '../src/services/rule-engine';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  it('should add a rule', () => {
    const rule = engine.addRule(
      'No eval',
      /eval\s*\(/gi,
      'critical',
      'security',
      'eval() is unsafe'
    );

    expect(rule.id).toBeDefined();
    expect(rule.name).toBe('No eval');
  });

  it('should get rule by id', () => {
    const added = engine.addRule(
      'Test',
      /test/gi,
      'high',
      'category',
      'Test rule'
    );

    const retrieved = engine.getRule(added.id);
    expect(retrieved?.id).toBe(added.id);
  });

  it('should update rule', () => {
    const rule = engine.addRule('Test', /test/gi, 'low', 'cat', 'desc');

    const updated = engine.updateRule(rule.id, { severity: 'critical' });

    expect(updated?.severity).toBe('critical');
  });

  it('should delete rule', () => {
    const rule = engine.addRule('Test', /test/gi, 'low', 'cat', 'desc');

    const deleted = engine.deleteRule(rule.id);

    expect(deleted).toBe(true);
    expect(engine.getRule(rule.id)).toBeUndefined();
  });

  it('should enable/disable rules', () => {
    const rule = engine.addRule('Test', /test/gi, 'low', 'cat', 'desc');

    engine.disableRule(rule.id);
    const enabled = engine.getEnabledRules();

    expect(enabled.find((r) => r.id === rule.id)).toBeUndefined();

    engine.enableRule(rule.id);
    const reEnabled = engine.getEnabledRules();

    expect(reEnabled.find((r) => r.id === rule.id)).toBeDefined();
  });

  it('should get rules by category', () => {
    engine.addRule('Rule1', /test/gi, 'low', 'security', 'desc1');
    engine.addRule('Rule2', /test2/gi, 'low', 'security', 'desc2');
    engine.addRule('Rule3', /test3/gi, 'low', 'performance', 'desc3');

    const security = engine.getRulesByCategory('security');
    expect(security).toHaveLength(2);
  });

  it('should get rules by severity', () => {
    engine.addRule('High1', /h1/gi, 'high', 'cat', 'desc1');
    engine.addRule('High2', /h2/gi, 'high', 'cat', 'desc2');
    engine.addRule('Low1', /l1/gi, 'low', 'cat', 'desc3');

    const high = engine.getRulesBySeverity('high');
    expect(high).toHaveLength(2);
  });

  it('should match code against rules', () => {
    engine.addRule('Eval', /eval\s*\(/gi, 'critical', 'security', 'No eval');

    const matches = engine.matchCode('eval(code); other code; eval(more);');

    expect(matches).toHaveLength(2);
    expect(matches[0].ruleId).toBeDefined();
  });

  it('should provide line and column info', () => {
    engine.addRule('Eval', /eval\s*\(/gi, 'critical', 'security', 'No eval');

    const matches = engine.matchCode('eval(code);');

    expect(matches[0].line).toBe(1);
    expect(matches[0].column).toBe(0);
  });

  it('should count severity', () => {
    engine.addRule('High', /high/gi, 'high', 'cat', 'desc');
    engine.addRule('Low', /low/gi, 'low', 'cat', 'desc');

    const count = engine.getSeverityCount('high rule and low rule');

    expect(count.high).toBe(1);
    expect(count.low).toBe(1);
  });

  it('should detect high severity issues', () => {
    engine.addRule('High', /critical/gi, 'high', 'cat', 'desc');

    const hasIssues = engine.hasHighSeverityIssues('critical issue here');

    expect(hasIssues).toBe(true);
  });

  it('should list all rules', () => {
    engine.addRule('Rule1', /r1/gi, 'low', 'cat1', 'desc1');
    engine.addRule('Rule2', /r2/gi, 'low', 'cat2', 'desc2');

    const all = engine.listRules();

    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
