// Quality gates: coverage, lint, security checks
export interface QualityRule {
  id: string;
  name: string;
  type: 'coverage' | 'lint' | 'security' | 'performance';
  threshold: number;
  comparison?: 'min' | 'max';
  enabled: boolean;
}

export interface QualityCheck {
  id: string;
  ruleId: string;
  value: number;
  passed: boolean;
  timestamp: Date;
  details?: string;
}

export interface QualityGateResult {
  id: string;
  timestamp: Date;
  passed: boolean;
  checks: QualityCheck[];
  blockers: string[];
}

let qgCounter = 0;

export class QualityGateService {
  private rules: Map<string, QualityRule> = new Map();
  private results: Map<string, QualityGateResult> = new Map();

  private defaultRules: QualityRule[] = [
    {
      id: 'cov_80',
      name: 'Code Coverage >= 80%',
      type: 'coverage',
      threshold: 80,
      comparison: 'min',
      enabled: true,
    },
    {
      id: 'lint_0',
      name: 'No Lint Errors',
      type: 'lint',
      threshold: 0,
      comparison: 'max',
      enabled: true,
    },
    {
      id: 'sec_0',
      name: 'No Critical Security Issues',
      type: 'security',
      threshold: 0,
      comparison: 'max',
      enabled: true,
    },
  ];

  constructor() {
    this.defaultRules.forEach((rule) => this.rules.set(rule.id, rule));
  }

  addRule(rule: QualityRule): QualityRule {
    this.rules.set(rule.id, rule);
    return rule;
  }

  updateRule(id: string, updates: Partial<QualityRule>): QualityRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...updates };
    this.rules.set(id, updated);
    return updated;
  }

  getRule(id: string): QualityRule | undefined {
    return this.rules.get(id);
  }

  listRules(): QualityRule[] {
    return Array.from(this.rules.values());
  }

  async evaluateQualityGate(metrics: Record<string, number>): Promise<QualityGateResult> {
    const result: QualityGateResult = {
      id: `qg_${Date.now()}_${++qgCounter}`,
      timestamp: new Date(),
      passed: true,
      checks: [],
      blockers: [],
    };

    for (const rule of Array.from(this.rules.values()).filter((r) => r.enabled)) {
      const value = metrics[rule.id] ?? 0;
      const comparison = rule.comparison ?? this.getDefaultComparison(rule.type);
      const passed = comparison === 'min'
        ? value >= rule.threshold
        : value <= rule.threshold;

      const check: QualityCheck = {
        id: `check_${Date.now()}_${++qgCounter}`,
        ruleId: rule.id,
        value,
        passed,
        timestamp: new Date(),
        details: `${rule.name}: ${value} ${comparison === 'min' ? '>=' : '<='} ${rule.threshold}`,
      };

      result.checks.push(check);

      if (!passed) {
        result.passed = false;
        result.blockers.push(
          `${rule.name} failed: ${value} ${comparison === 'min' ? '<' : '>'} ${rule.threshold}`
        );
      }
    }

    this.results.set(result.id, result);
    return result;
  }

  getResult(id: string): QualityGateResult | undefined {
    return this.results.get(id);
  }

  listResults(limit = 10): QualityGateResult[] {
    return Array.from(this.results.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getResultsByType(type: QualityRule['type']): QualityGateResult[] {
    return Array.from(this.results.values()).filter((result) =>
      result.checks.some((check) => {
        const rule = this.rules.get(check.ruleId);
        return rule?.type === type;
      })
    );
  }

  private getDefaultComparison(type: QualityRule['type']): 'min' | 'max' {
    return type === 'coverage' ? 'min' : 'max';
  }
}
