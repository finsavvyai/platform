import type { WizardStep } from './WizardContainer';

export interface ThresholdConfig {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  escalate?: boolean;
  escalateAfter?: number;
}

export interface ThresholdsData {
  thresholds: Record<string, ThresholdConfig>;
  escalationPolicy?: 'immediate' | 'after_5min' | 'after_15min' | 'after_1hour';
}

export class StepThresholds implements WizardStep {
  id = 'step-thresholds';
  title = 'Set Alert Thresholds';
  description = 'Configure warning and critical thresholds for alerts';
  component = 'StepThresholdsComponent';
  status: 'pending' | 'in_progress' | 'completed' = 'pending';
  data?: ThresholdsData;
  errors?: Record<string, string>;

  private readonly METRIC_TEMPLATES: Record<string, { warning: number; critical: number; unit: string }> = {
    availability: { warning: 99, critical: 95, unit: '%' },
    cpu: { warning: 70, critical: 90, unit: '%' },
    memory: { warning: 75, critical: 90, unit: '%' },
    disk: { warning: 80, critical: 95, unit: '%' },
    latency: { warning: 300, critical: 1000, unit: 'ms' },
    errorRate: { warning: 2, critical: 10, unit: '%' },
    throughput: { warning: 100, critical: 50, unit: 'req/s' },
    database: { warning: 500, critical: 2000, unit: 'ms' }
  };

  constructor() {
    this.data = {
      thresholds: {},
      escalationPolicy: 'after_5min'
    };
    this.initializeDefaultThresholds();
  }

  private initializeDefaultThresholds(): void {
    if (!this.data) return;

    for (const [metric, template] of Object.entries(this.METRIC_TEMPLATES)) {
      this.data.thresholds[metric] = {
        metric,
        warning: template.warning,
        critical: template.critical,
        unit: template.unit,
        escalate: true,
        escalateAfter: 5
      };
    }
  }

  setWarningThreshold(metric: string, value: number): { valid: boolean; error?: string } {
    if (!this.data?.thresholds[metric]) {
      return { valid: false, error: 'Metric not found' };
    }

    const threshold = this.data.thresholds[metric];
    if (value >= threshold.critical) {
      return { valid: false, error: 'Warning must be below critical threshold' };
    }

    if (value < 0) {
      return { valid: false, error: 'Threshold must be non-negative' };
    }

    threshold.warning = value;
    return { valid: true };
  }

  setCriticalThreshold(metric: string, value: number): { valid: boolean; error?: string } {
    if (!this.data?.thresholds[metric]) {
      return { valid: false, error: 'Metric not found' };
    }

    const threshold = this.data.thresholds[metric];
    if (value <= threshold.warning) {
      return { valid: false, error: 'Critical must be above warning threshold' };
    }

    if (value < 0) {
      return { valid: false, error: 'Threshold must be non-negative' };
    }

    threshold.critical = value;
    return { valid: true };
  }

  resetToDefaults(metric: string): boolean {
    if (!this.data?.thresholds[metric]) {
      return false;
    }

    const template = this.METRIC_TEMPLATES[metric];
    if (!template) {
      return false;
    }

    this.data.thresholds[metric] = {
      metric,
      ...template,
      escalate: true,
      escalateAfter: 5
    };

    return true;
  }

  setEscalationPolicy(policy: string): boolean {
    const valid = ['immediate', 'after_5min', 'after_15min', 'after_1hour'].includes(policy);
    if (valid && this.data) {
      this.data.escalationPolicy = policy as any;
      return true;
    }
    return false;
  }

  toggleEscalation(metric: string): boolean {
    if (!this.data?.thresholds[metric]) {
      return false;
    }

    const threshold = this.data.thresholds[metric];
    threshold.escalate = !threshold.escalate;
    return threshold.escalate;
  }

  setEscalationTime(metric: string, minutes: number): boolean {
    if (!this.data?.thresholds[metric]) {
      return false;
    }

    if (minutes < 1 || minutes > 120) {
      return false;
    }

    this.data.thresholds[metric].escalateAfter = minutes;
    return true;
  }

  getThresholds(): ThresholdConfig[] {
    if (!this.data) return [];
    return Object.values(this.data.thresholds);
  }

  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!this.data?.thresholds || Object.keys(this.data.thresholds).length === 0) {
      errors.thresholds = 'No thresholds configured';
      return { valid: false, errors };
    }

    for (const [metric, config] of Object.entries(this.data.thresholds)) {
      if (config.warning >= config.critical) {
        errors[`${metric}_warning`] = 'Warning must be below critical';
      }

      if (config.critical < 0 || config.warning < 0) {
        errors[`${metric}_range`] = 'Thresholds must be non-negative';
      }

      if (config.escalate && (!config.escalateAfter || config.escalateAfter < 1)) {
        errors[`${metric}_escalate`] = 'Escalation time must be specified';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  getSeverity(metric: string, value: number): 'normal' | 'warning' | 'critical' {
    const threshold = this.data?.thresholds[metric];
    if (!threshold) return 'normal';

    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'warning';
    return 'normal';
  }

  getThresholdConfig(): Record<string, { warning: number; critical: number }> {
    const config: Record<string, { warning: number; critical: number }> = {};

    for (const [metric, threshold] of Object.entries(this.data?.thresholds || {})) {
      config[metric] = {
        warning: threshold.warning,
        critical: threshold.critical
      };
    }

    return config;
  }
}
