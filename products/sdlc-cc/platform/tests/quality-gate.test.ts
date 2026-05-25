import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../src/services/quality-gate';

describe('QualityGateService', () => {
  let service: QualityGateService;

  beforeEach(() => {
    service = new QualityGateService();
  });

  it('should have default rules', () => {
    const rules = service.listRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should add a custom rule', () => {
    const rule = service.addRule({
      id: 'perf_100',
      name: 'Performance < 100ms',
      type: 'performance',
      threshold: 100,
      enabled: true,
    });

    expect(rule.id).toBe('perf_100');
    expect(service.getRule('perf_100')).toBeDefined();
  });

  it('should update a rule', () => {
    const updated = service.updateRule('cov_80', { threshold: 90 });

    expect(updated?.threshold).toBe(90);
  });

  it('should evaluate passing quality gate', async () => {
    const metrics = {
      cov_80: 85,
      lint_0: 0,
      sec_0: 0,
    };

    const result = await service.evaluateQualityGate(metrics);

    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('should evaluate failing quality gate', async () => {
    const metrics = {
      cov_80: 70,
      lint_0: 5,
      sec_0: 2,
    };

    const result = await service.evaluateQualityGate(metrics);

    expect(result.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('should fail zero-threshold rules when errors are present', async () => {
    const metrics = {
      cov_80: 85,
      lint_0: 2,
      sec_0: 1,
    };

    const result = await service.evaluateQualityGate(metrics);

    expect(result.passed).toBe(false);
    expect(result.blockers).toContain('No Lint Errors failed: 2 > 0');
    expect(result.blockers).toContain('No Critical Security Issues failed: 1 > 0');
  });

  it('should get a result by id', async () => {
    const metrics = { cov_80: 85, lint_0: 0, sec_0: 0 };
    const result = await service.evaluateQualityGate(metrics);

    const retrieved = service.getResult(result.id);
    expect(retrieved?.id).toBe(result.id);
  });

  it('should list recent results', async () => {
    await service.evaluateQualityGate({ cov_80: 85, lint_0: 0, sec_0: 0 });
    await service.evaluateQualityGate({ cov_80: 80, lint_0: 1, sec_0: 0 });

    const results = service.listResults(10);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should disable a rule', () => {
    const disabled = service.updateRule('cov_80', { enabled: false });

    expect(disabled?.enabled).toBe(false);

    const metrics = { cov_80: 70, lint_0: 0, sec_0: 0 };
    service.evaluateQualityGate(metrics).then((result) => {
      expect(
        result.checks.find((c) => c.ruleId === 'cov_80')
      ).toBeUndefined();
    });
  });

  it('should track check details', async () => {
    const metrics = { cov_80: 85, lint_0: 0, sec_0: 0 };
    const result = await service.evaluateQualityGate(metrics);

    const covCheck = result.checks.find((c) => c.ruleId === 'cov_80');
    expect(covCheck?.value).toBe(85);
    expect(covCheck?.passed).toBe(true);
    expect(covCheck?.details).toBeDefined();
  });

  it('should filter results by type', async () => {
    await service.evaluateQualityGate({ cov_80: 85, lint_0: 0, sec_0: 0 });

    const covResults = service.getResultsByType('coverage');
    expect(covResults.length).toBeGreaterThan(0);

    const secResults = service.getResultsByType('security');
    expect(secResults.length).toBeGreaterThan(0);
  });
});
