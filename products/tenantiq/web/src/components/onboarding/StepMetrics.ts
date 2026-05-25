import type { WizardStep } from './WizardContainer';
import {
  AVAILABLE_METRICS,
  DEFAULT_ENABLED_METRICS,
  VALID_FREQUENCIES,
  VALID_RETENTIONS,
  FREQUENCY_COST_MULTIPLIER,
  RETENTION_COST_MULTIPLIER
} from './metric-definitions';

export type { MetricDefinition } from './metric-definitions';

export interface MetricSelection {
  enabled: boolean;
  threshold?: number;
  alertOnBreach?: boolean;
}

export interface MetricsData {
  selected: Record<string, MetricSelection>;
  frequency?: 'realtime' | '5min' | '15min' | '1hour' | '1day';
  retention?: '7days' | '30days' | '90days' | '1year';
}

export class StepMetrics implements WizardStep {
  id = 'step-metrics';
  title = 'Select Metrics';
  description = 'Choose which metrics to monitor for your tenants';
  component = 'StepMetricsComponent';
  status: 'pending' | 'in_progress' | 'completed' = 'pending';
  data?: MetricsData;
  errors?: Record<string, string>;

  constructor() {
    this.data = {
      selected: {},
      frequency: '5min',
      retention: '30days'
    };

    for (const [key, metric] of Object.entries(AVAILABLE_METRICS)) {
      this.data.selected[key] = {
        enabled: DEFAULT_ENABLED_METRICS.includes(key),
        threshold: metric.defaultThreshold,
        alertOnBreach: true
      };
    }
  }

  getAvailableMetrics(): Array<{
    id: string;
    name: string;
    description: string;
    defaultThreshold: number;
    unit: string;
  }> {
    return Object.entries(AVAILABLE_METRICS).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  toggleMetric(metricId: string): boolean {
    if (!this.data) return false;
    const selection = this.data.selected[metricId];
    if (selection) {
      selection.enabled = !selection.enabled;
      return selection.enabled;
    }
    return false;
  }

  setMetricThreshold(
    metricId: string,
    threshold: number
  ): { valid: boolean; error?: string } {
    if (!this.data) return { valid: false, error: 'No metric data' };
    const selection = this.data.selected[metricId];
    if (!selection) return { valid: false, error: 'Metric not found' };
    if (threshold < 0) return { valid: false, error: 'Threshold must be positive' };
    selection.threshold = threshold;
    return { valid: true };
  }

  setFrequency(frequency: string): boolean {
    const valid = (VALID_FREQUENCIES as readonly string[]).includes(frequency);
    if (valid && this.data) {
      this.data.frequency = frequency as MetricsData['frequency'];
      return true;
    }
    return false;
  }

  setRetention(retention: string): boolean {
    const valid = (VALID_RETENTIONS as readonly string[]).includes(retention);
    if (valid && this.data) {
      this.data.retention = retention as MetricsData['retention'];
      return true;
    }
    return false;
  }

  toggleAlert(metricId: string): boolean {
    if (!this.data) return false;
    const selection = this.data.selected[metricId];
    if (selection) {
      selection.alertOnBreach = !selection.alertOnBreach;
      return selection.alertOnBreach;
    }
    return false;
  }

  getSelectedMetrics(): string[] {
    if (!this.data) return [];
    return Object.entries(this.data.selected)
      .filter(([_, sel]) => sel.enabled)
      .map(([id]) => id);
  }

  getMetricsCount(): number {
    return this.getSelectedMetrics().length;
  }

  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (this.getMetricsCount() === 0) {
      errors.metrics = 'At least one metric must be selected';
    }
    for (const metricId of this.getSelectedMetrics()) {
      if (this.data?.selected[metricId]?.threshold === undefined) {
        errors[`threshold_${metricId}`] = 'Threshold is required';
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  getConfiguration(): {
    metrics: Array<{ id: string; threshold: number; alert: boolean }>;
    frequency: string;
    retention: string;
  } {
    const metrics = this.getSelectedMetrics().map(id => ({
      id,
      threshold: this.data?.selected[id]?.threshold || 0,
      alert: this.data?.selected[id]?.alertOnBreach || false
    }));
    return {
      metrics,
      frequency: this.data?.frequency || '5min',
      retention: this.data?.retention || '30days'
    };
  }

  estimatedCost(): { base: number; additional: number; total: number } {
    const frequency = this.data?.frequency || '5min';
    const freqMultiplier = FREQUENCY_COST_MULTIPLIER[frequency] || 1;
    const retention = this.data?.retention || '30days';
    const retentionMultiplier = RETENTION_COST_MULTIPLIER[retention] || 1;
    const metricCount = this.getMetricsCount();

    const base = metricCount * 0.1;
    const additional = base * freqMultiplier * retentionMultiplier;
    return { base, additional, total: base + additional };
  }
}
