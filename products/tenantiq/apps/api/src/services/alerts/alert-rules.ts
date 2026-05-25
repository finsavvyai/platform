import { nanoid } from 'nanoid';
import type { Alert, AlertRule } from './types.js';
import { alertRules } from './store.js';
import { createAlert } from './alert-operations.js';

export async function createAlertRule(
  rule: Omit<AlertRule, 'id' | 'createdAt'>
): Promise<AlertRule> {
  const alertRule: AlertRule = {
    id: nanoid(),
    ...rule,
    createdAt: new Date()
  };

  if (!alertRules.has(rule.tenantId)) {
    alertRules.set(rule.tenantId, []);
  }

  alertRules.get(rule.tenantId)!.push(alertRule);
  return alertRule;
}

export async function evaluateThresholds(
  tenantId: string,
  metrics: Record<string, number>
): Promise<Alert[]> {
  const rules = alertRules.get(tenantId) || [];
  const newAlerts: Alert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const value = metrics[rule.metric];
    if (value === undefined) continue;

    let breached = false;
    switch (rule.comparison) {
      case 'gt':
        breached = value > rule.threshold;
        break;
      case 'lt':
        breached = value < rule.threshold;
        break;
      case 'gte':
        breached = value >= rule.threshold;
        break;
      case 'lte':
        breached = value <= rule.threshold;
        break;
      case 'eq':
        breached = value === rule.threshold;
        break;
    }

    if (breached) {
      const alert = await createAlert({
        tenantId,
        severity: rule.severity,
        title: `${rule.metric} threshold breached`,
        message: `${rule.metric} is ${value}, threshold is ${rule.threshold}`,
        component: rule.metric,
        threshold: rule.threshold,
        current: value
      });
      newAlerts.push(alert);
    }
  }

  return newAlerts;
}

export async function deleteAlertRule(
  ruleId: string,
  tenantId: string
): Promise<boolean> {
  const rules = alertRules.get(tenantId);
  if (!rules) return false;

  const index = rules.findIndex(r => r.id === ruleId);
  if (index >= 0) {
    rules.splice(index, 1);
    return true;
  }

  return false;
}

export async function updateAlertRule(
  ruleId: string,
  tenantId: string,
  updates: Partial<Omit<AlertRule, 'id' | 'createdAt' | 'tenantId'>>
): Promise<AlertRule | null> {
  const rules = alertRules.get(tenantId);
  if (!rules) return null;

  const rule = rules.find(r => r.id === ruleId);
  if (!rule) return null;

  Object.assign(rule, updates);
  return rule;
}

export async function getAlertRules(tenantId: string): Promise<AlertRule[]> {
  return alertRules.get(tenantId) || [];
}
