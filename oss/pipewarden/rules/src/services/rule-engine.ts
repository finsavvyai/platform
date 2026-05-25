// Rule engine: define rules, match patterns, severity levels
export interface Rule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  category: string;
  description: string;
}

export interface RuleMatch {
  ruleId: string;
  line: number;
  column: number;
  message: string;
  code: string;
  severity: Rule['severity'];
}

export class RuleEngine {
  private rules: Map<string, Rule> = new Map();
  private ruleCounter = 0;

  addRule(
    name: string,
    pattern: RegExp,
    severity: Rule['severity'],
    category: string,
    description: string
  ): Rule {
    const rule: Rule = {
      id: `rule_${++this.ruleCounter}`,
      name,
      pattern,
      severity,
      enabled: true,
      category,
      description,
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  getRule(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  updateRule(id: string, updates: Partial<Rule>): Rule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;

    const updated = { ...rule, ...updates };
    this.rules.set(id, updated);
    return updated;
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  enableRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.enabled = true;
    return true;
  }

  disableRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.enabled = false;
    return true;
  }

  getRulesByCategory(category: string): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.category === category);
  }

  getRulesBySeverity(severity: Rule['severity']): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.severity === severity);
  }

  getEnabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  matchCode(code: string): RuleMatch[] {
    const matches: RuleMatch[] = [];
    const lines = code.split('\n');

    const enabledRules = this.getEnabledRules();

    lines.forEach((line, lineIdx) => {
      enabledRules.forEach((rule) => {
        const lineMatches = line.matchAll(rule.pattern);

        for (const match of lineMatches) {
          matches.push({
            ruleId: rule.id,
            line: lineIdx + 1,
            column: match.index || 0,
            message: rule.description,
            code: line.trim(),
            severity: rule.severity,
          });
        }
      });
    });

    return matches;
  }

  listRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  getSeverityCount(code: string): Record<Rule['severity'], number> {
    const matches = this.matchCode(code);
    const count = { low: 0, medium: 0, high: 0, critical: 0 };

    matches.forEach((match) => {
      count[match.severity]++;
    });

    return count;
  }

  hasHighSeverityIssues(code: string): boolean {
    const matches = this.matchCode(code);
    return matches.some((m) => m.severity === 'high' || m.severity === 'critical');
  }
}
