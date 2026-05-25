/**
 * AlertManager Tests
 */

import { AlertManager } from '../../src/services/apm/AlertManager.js';
import { MetricsEngine } from '../../src/services/apm/MetricsEngine.js';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let metricsEngine: MetricsEngine;

  beforeEach(() => {
    metricsEngine = new MetricsEngine();
    alertManager = new AlertManager(metricsEngine);
  });

  it('should add alert rule', () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 2000,
      duration: 0,
      enabled: true,
      channels: ['webhook'],
      webhookUrl: 'https://example.com/webhook',
    });

    const rules = alertManager.getRules();

    expect(rules.length).toBe(1);
    expect(rules[0].name).toBe('High Latency');
  });

  it('should remove alert rule', () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 2000,
      duration: 0,
      enabled: true,
      channels: ['webhook'],
    });

    alertManager.removeRule('rule-1');

    const rules = alertManager.getRules();

    expect(rules.length).toBe(0);
  });

  it('should enable/disable rules', () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 2000,
      duration: 0,
      enabled: true,
      channels: [],
    });

    alertManager.setRuleEnabled('rule-1', false);

    const rule = alertManager.getRule('rule-1');

    expect(rule?.enabled).toBe(false);
  });

  it('should trigger alert on condition', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 100,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('request_duration', 200);

    const alerts = await alertManager.evaluate();

    expect(alerts.length).toBe(1);
    expect(alerts[0].ruleName).toBe('High Latency');
    expect(alerts[0].value).toBe(200);
  });

  it('should not trigger alert if condition not met', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 200,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('request_duration', 100);

    const alerts = await alertManager.evaluate();

    expect(alerts.length).toBe(0);
  });

  it('should support less-than condition', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Low Memory',
      metricName: 'available_memory',
      condition: 'lt',
      threshold: 100,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('available_memory', 50);

    const alerts = await alertManager.evaluate();

    expect(alerts.length).toBe(1);
  });

  it('should support equality condition', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Status Check',
      metricName: 'status_code',
      condition: 'eq',
      threshold: 500,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('status_code', 500);

    const alerts = await alertManager.evaluate();

    expect(alerts.length).toBe(1);
  });

  it('should respect duration threshold', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Persistent High Latency',
      metricName: 'request_duration',
      condition: 'gt',
      threshold: 100,
      duration: 100, // 100ms
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('request_duration', 200);

    // First evaluation - should not trigger yet
    let alerts = await alertManager.evaluate();
    expect(alerts.length).toBe(0);

    // Wait for duration threshold
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Second evaluation - should trigger now
    alerts = await alertManager.evaluate();
    expect(alerts.length).toBe(1);
  });

  it('should get active alerts', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Alert 1',
      metricName: 'metric1',
      condition: 'gt',
      threshold: 100,
      duration: 0,
      enabled: true,
      channels: [],
    });

    alertManager.addRule({
      ruleId: 'rule-2',
      name: 'Alert 2',
      metricName: 'metric2',
      condition: 'lt',
      threshold: 50,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('metric1', 200);
    metricsEngine.recordMetric('metric2', 25);

    await alertManager.evaluate();

    const active = alertManager.getActiveAlerts();

    expect(active.length).toBe(2);
  });

  it('should maintain alert history', async () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Test Alert',
      metricName: 'test_metric',
      condition: 'gt',
      threshold: 100,
      duration: 0,
      enabled: true,
      channels: [],
    });

    metricsEngine.recordMetric('test_metric', 200);

    await alertManager.evaluate();

    const history = alertManager.getAlertHistory(10);

    expect(history.length).toBeGreaterThan(0);
  });

  it('should clear alerts and state', () => {
    alertManager.addRule({
      ruleId: 'rule-1',
      name: 'Test',
      metricName: 'metric',
      condition: 'gt',
      threshold: 100,
      duration: 0,
      enabled: true,
      channels: [],
    });

    alertManager.clear();

    expect(alertManager.getActiveAlerts().length).toBe(0);
  });
});
