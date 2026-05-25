/**
 * Policy and Rule Engine v1
 *
 * Evaluate user-configurable rules against incoming integration events.
 * Supports conditions across multiple fields and actions (alert, tag, escalate, suppress).
 */

export type ConditionOperator = 'equals' | 'contains' | 'matches' | 'in';
export type ActionType = 'alert' | 'tag' | 'escalate' | 'suppress';

export interface Condition {
  field: 'eventType' | 'severity' | 'integrationSlug' | 'summary';
  operator: ConditionOperator;
  value: string | string[];
}

export interface Action {
  type: ActionType;
  config: Record<string, any>;
}

export interface Rule {
  id: string;
  name: string;
  conditions: Condition[];
  actions: Action[];
  isActive: boolean;
  priority: number;
}

export interface Event {
  eventType: string;
  severity: string;
  integrationSlug: string;
  summary: string;
  [key: string]: any;
}

export interface ActionResult {
  type: ActionType;
  config: Record<string, any>;
  executed: boolean;
}

/**
 * Evaluate all rules against an event in priority order.
 * Return matched rules and their actions.
 */
export function evaluateRules(rules: Rule[], event: Event): Array<{ rule: Rule; actions: ActionResult[] }> {
  const active = rules.filter((r) => r.isActive).sort((a, b) => b.priority - a.priority);
  const matched: Array<{ rule: Rule; actions: ActionResult[] }> = [];

  for (const rule of active) {
    if (allConditionsMatch(rule.conditions, event)) {
      matched.push({
        rule,
        actions: rule.actions.map((a) => ({ ...a, executed: false })),
      });
    }
  }

  return matched;
}

/**
 * Check if all conditions match the event.
 */
export function matchesCondition(condition: Condition, event: Event): boolean {
  const fieldValue = String(event[condition.field] ?? '');

  switch (condition.operator) {
    case 'equals':
      return fieldValue === String(condition.value);
    case 'contains':
      return fieldValue.includes(String(condition.value));
    case 'matches':
      try {
        const regex = new RegExp(condition.value as string);
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    case 'in':
      return (Array.isArray(condition.value) ? condition.value : [condition.value]).some(
        (v) => fieldValue === String(v),
      );
    default:
      return false;
  }
}

function allConditionsMatch(conditions: Condition[], event: Event): boolean {
  return conditions.every((c) => matchesCondition(c, event));
}

/**
 * Execute actions on a matched event.
 * In production, this would integrate with alert channels, tagging systems, etc.
 */
export async function executeActions(
  actions: Action[],
  event: Event,
  db: any,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'alert':
          // Create alert in DB with specified channel and severity
          // await db.insert(alerts).values({ ... })
          results.push({ ...action, executed: true });
          break;

        case 'tag':
          // Add tags to event or incident
          results.push({ ...action, executed: true });
          break;

        case 'escalate':
          // Escalate to specified role (e.g., integration_engineer, admin)
          // Send notification
          results.push({ ...action, executed: true });
          break;

        case 'suppress':
          // Suppress this event type for a time window
          results.push({ ...action, executed: true });
          break;

        default:
          results.push({ ...action, executed: false });
      }
    } catch (err) {
      console.error(`Failed to execute action ${action.type}:`, err);
      results.push({ ...action, executed: false });
    }
  }

  return results;
}
