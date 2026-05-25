/**
 * AlertManager: Monitors metrics and triggers alerts
 * Threshold-based alerting with webhook and email notifications
 */

import { v4 as uuidv4 } from 'uuid';
import { AlertRule, Alert } from './types.js';
import { MetricsEngine } from './MetricsEngine.js';

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private ruleStates: Map<string, number> = new Map(); // timestamp when condition started
  private metricsEngine: MetricsEngine;

  constructor(metricsEngine: MetricsEngine) {
    this.metricsEngine = metricsEngine;
  }

  /**
   * Add a new alert rule
   */
  addRule(rule: AlertRule): void {
    if (!rule.ruleId) {
      rule.ruleId = uuidv4();
    }

    this.rules.set(rule.ruleId, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.ruleStates.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);

    if (rule) {
      rule.enabled = enabled;

      if (!enabled) {
        this.ruleStates.delete(ruleId);
      }
    }
  }

  /**
   * Evaluate all rules against current metrics
   */
  async evaluate(): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      const value = this.metricsEngine.getLatestValue(rule.metricName);

      if (value === null) {
        continue;
      }

      const conditionMet = this.evaluateCondition(
        value,
        rule.condition,
        rule.threshold
      );

      if (conditionMet) {
        const startTime = this.ruleStates.get(rule.ruleId) ?? Date.now();
        const duration = Date.now() - startTime;

        // Only trigger alert if condition persists for duration
        if (duration >= rule.duration) {
          const alert = await this.createAlert(rule, value);
          newAlerts.push(alert);
        } else if (!this.ruleStates.has(rule.ruleId)) {
          // Record when condition started
          this.ruleStates.set(rule.ruleId, startTime);
        }
      } else {
        // Clear state when condition no longer met
        this.ruleStates.delete(rule.ruleId);
      }
    }

    // Store alerts
    for (const alert of newAlerts) {
      this.alerts.set(alert.alertId, alert);
      this.alertHistory.push(alert);

      // Send notifications
      await this.sendNotifications(alert);
    }

    // Keep only recent alerts (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentAlerts = Array.from(this.alerts.values()).filter(
      (a) => a.timestamp > oneHourAgo
    );

    this.alerts.clear();
    for (const alert of recentAlerts) {
      this.alerts.set(alert.alertId, alert);
    }

    return newAlerts;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Evaluate condition against threshold
   */
  private evaluateCondition(
    value: number,
    condition: 'gt' | 'lt' | 'eq',
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
    }
  }

  /**
   * Create alert instance
   */
  private async createAlert(
    rule: AlertRule,
    value: number
  ): Promise<Alert> {
    const alert: Alert = {
      alertId: uuidv4(),
      ruleId: rule.ruleId,
      ruleName: rule.name,
      timestamp: Date.now(),
      metricName: rule.metricName,
      value,
      threshold: rule.threshold,
      message: `${rule.name}: ${rule.metricName} (${value}) ${rule.condition} ${rule.threshold}`,
    };

    return alert;
  }

  /**
   * Send alert notifications
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = this.rules.get(alert.ruleId);

    if (!rule) {
      return;
    }

    for (const channel of rule.channels) {
      try {
        if (channel === 'webhook' && rule.webhookUrl) {
          await this.sendWebhook(rule.webhookUrl, alert);
        } else if (channel === 'email' && rule.email) {
          await this.sendEmail(rule.email, alert);
        }
      } catch (error) {
        console.error(
          `Failed to send ${channel} alert:`,
          error
        );
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    webhookUrl: string,
    alert: Alert
  ): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook failed: ${response.statusText}`
      );
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmail(
    email: string,
    alert: Alert
  ): Promise<void> {
    // TODO: Integrate with email service
    console.log(`Email alert to ${email}:`, alert.message);
  }

  /**
   * Clear all alerts
   */
  clear(): void {
    this.alerts.clear();
    this.ruleStates.clear();
  }
}
