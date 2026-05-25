/**
 * Questro AI-Powered Testing Automation Platform
 * Alert Manager Service
 *
 * Intelligent alerting system with multi-channel notifications,
 * escalation policies, and comprehensive incident management.
 */

import { EventEmitter } from 'events';
import { Alert, AlertRule } from './metrics-collector';

export interface NotificationChannel {
  id: string;
  type: 'slack' | 'email' | 'pagerduty' | 'sms' | 'webhook';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  severity: ('info' | 'warning' | 'critical')[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'alert' | 'resolved' | 'acknowledged' | 'escalated';
  content: string;
  variables: string[];
}

export interface EscalationPolicy {
  id: string;
  name: string;
  rules: EscalationRule[];
  enabled: boolean;
}

export interface EscalationRule {
  condition: string;
  action: 'notify' | 'create_incident' | 'auto_resolve';
  channel: string;
  delay: number; // seconds
  recipients: string[];
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  tags: string[];
  alerts: string[];
  notifications: string[];
  timeline: IncidentTimelineEntry[];
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  type: 'created' | 'acknowledged' | 'escalated' | 'resolved' | 'notified' | 'comment';
  message: string;
  user?: string;
  details?: Record<string, any>;
}

/**
 * Alert Manager Service
 */
export class AlertManager extends EventEmitter {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private alertHistory: Map<string, Alert[]> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    super();
    this.initializeChannels();
    this.initializeTemplates();
    this.initializeEscalationPolicies();
  }

  /**
   * Initialize notification channels
   */
  private initializeChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'slack-critical',
        type: 'slack',
        name: 'Critical Alerts',
        config: {
          webhook: process.env.SLACK_CRITICAL_WEBHOOK,
          channel: '#alerts-critical',
          icon_emoji: ':rotating_light:',
          username: 'Questro Alerts'
        },
        enabled: true,
        severity: ['critical']
      },
      {
        id: 'slack-warning',
        type: 'slack',
        name: 'Warning Alerts',
        config: {
          webhook: process.env.SLACK_WARNING_WEBHOOK,
          channel: '#alerts-warning',
          icon_emoji: ':warning:',
          username: 'Questro Alerts'
        },
        enabled: true,
        severity: ['warning', 'critical']
      },
      {
        id: 'email-ops',
        type: 'email',
        name: 'Operations Team',
        config: {
          smtp_host: process.env.SMTP_HOST,
          smtp_port: process.env.SMTP_PORT,
          smtp_user: process.env.SMTP_USER,
          smtp_pass: process.env.SMTP_PASS,
          from: process.env.SMTP_FROM,
          to: ['ops@qestro.ai', 'devops@qestro.ai']
        },
        enabled: true,
        severity: ['warning', 'critical']
      },
      {
        id: 'pagerduty-critical',
        type: 'pagerduty',
        name: 'Critical Incidents',
        config: {
          integration_key: process.env.PAGERDUTY_INTEGRATION_KEY,
          service_key: process.env.PAGERDUTY_SERVICE_KEY,
          severity: 'critical'
        },
        enabled: true,
        severity: ['critical']
      },
      {
        id: 'sms-oncall',
        type: 'sms',
        name: 'On-Call Engineer',
        config: {
          provider: 'twilio',
          account_sid: process.env.TWILIO_ACCOUNT_SID,
          auth_token: process.env.TWILIO_AUTH_TOKEN,
          from_number: process.env.TWILIO_FROM_NUMBER,
          to_numbers: [process.env.ONCALL_PHONE_NUMBER]
        },
        enabled: true,
        severity: ['critical']
      }
    ];

    defaultChannels.forEach(channel => {
      this.channels.set(channel.id, channel);
    });
  }

  /**
   * Initialize notification templates
   */
  private initializeTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'alert-critical',
        name: 'Critical Alert Template',
        type: 'alert',
        content: `
🚨 **CRITICAL ALERT** 🚨

**Alert:** {{rule_name}}
**Service:** {{category}} - {{service}}
**Value:** {{value}}
**Threshold:** {{threshold}}
**Time:** {{timestamp}}

**Description:**
{{description}}

**Labels:**
{{#each labels}}
- {{@key}}: {{this}}
{{/each}}

**Action Required:**
{{#if is_database}}
- Check database connectivity and performance
- Review recent database operations
- Consider database restart if necessary
{{/if}}
{{#if is_ai_service}}
- Check AI provider status
- Review API rate limits and quotas
- Switch to backup AI provider if available
{{/if}}
{{#if is_websocket}}
- Check WebSocket service health
- Review connection logs
- Restart WebSocket service if needed
{{/if}}

**Quick Actions:**
- Investigate logs: \`tail -f /var/log/questro/{{service}}.log\`
- Check status: \`curl http://localhost:8000/health\`
- View metrics: \`https://monitoring.qestro.ai/dashboards/{{service}}\`
        `.trim(),
        variables: ['rule_name', 'category', 'service', 'value', 'threshold', 'timestamp', 'description', 'labels', 'is_database', 'is_ai_service', 'is_websocket']
      },
      {
        id: 'alert-warning',
        name: 'Warning Alert Template',
        type: 'alert',
        content: `
⚠️ **WARNING ALERT** ⚠️

**Alert:** {{rule_name}}
**Service:** {{category}} - {{service}}
**Value:** {{value}}
**Threshold:** {{threshold}}
**Time:** {{timestamp}}

**Description:**
{{description}}

**Labels:**
{{#each labels}}
- {{@key}}: {{this}}
{{/each}}

**Recommended Actions:**
- Monitor the situation closely
- Review related metrics and logs
- Prepare for potential escalation
        `.trim(),
        variables: ['rule_name', 'category', 'service', 'value', 'threshold', 'timestamp', 'description', 'labels']
      },
      {
        id: 'resolved',
        name: 'Alert Resolved Template',
        type: 'resolved',
        content: `
✅ **ALERT RESOLVED** ✅

**Alert:** {{rule_name}}
**Service:** {{category}} - {{service}}
**Duration:** {{duration}}
**Resolved At:** {{resolved_timestamp}}

**Resolution Notes:**
{{resolution_notes}}

**Metrics Status:**
{{#each metrics}}
- {{@key}}: {{this}}
{{/each}}
        `.trim(),
        variables: ['rule_name', 'category', 'service', 'duration', 'resolved_timestamp', 'resolution_notes', 'metrics']
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Initialize escalation policies
   */
  private initializeEscalationPolicies(): void {
    const defaultPolicies: EscalationPolicy[] = [
      {
        id: 'critical-escalation',
        name: 'Critical Alert Escalation',
        rules: [
          {
            condition: 'severity == "critical" AND not acknowledged',
            action: 'notify',
            channel: 'pagerduty-critical',
            delay: 0,
            recipients: ['oncall-engineer']
          },
          {
            condition: 'severity == "critical" AND not acknowledged AND age > 5',
            action: 'notify',
            channel: 'sms-oncall',
            delay: 300, // 5 minutes
            recipients: ['oncall-engineer']
          },
          {
            condition: 'severity == "critical" AND not acknowledged AND age > 15',
            action: 'notify',
            channel: 'email-ops',
            delay: 900, // 15 minutes
            recipients: ['team-lead', 'engineering-manager']
          },
          {
            condition: 'severity == "critical" AND age > 30',
            action: 'create_incident',
            channel: 'slack-critical',
            delay: 1800, // 30 minutes
            recipients: ['incident-commander']
          }
        ],
        enabled: true
      },
      {
        id: 'warning-escalation',
        name: 'Warning Alert Escalation',
        rules: [
          {
            condition: 'severity == "warning" AND not acknowledged AND age > 30',
            action: 'notify',
            channel: 'email-ops',
            delay: 1800, // 30 minutes
            recipients: ['oncall-engineer']
          },
          {
            condition: 'severity == "warning" AND not acknowledged AND age > 60',
            action: 'notify',
            channel: 'slack-warning',
            delay: 3600, // 1 hour
            recipients: ['team-lead']
          }
        ],
        enabled: true
      }
    ];

    defaultPolicies.forEach(policy => {
      this.escalationPolicies.set(policy.id, policy);
    });
  }

  /**
   * Process new alert
   */
  async processAlert(alert: Alert): Promise<void> {
    if (!this.isEnabled) return;

    console.log(`🚨 Processing alert: ${alert.message} (${alert.severity})`);

    // Store alert in history
    const history = this.alertHistory.get(alert.rule) || [];
    history.push(alert);
    this.alertHistory.set(alert.rule, history);

    // Create or update incident
    const incident = await this.createOrUpdateIncident(alert);

    // Send initial notifications
    await this.sendNotifications(alert, 'alert');

    // Start escalation timers
    this.startEscalation(alert);

    // Emit event
    this.emit('alertProcessed', { alert, incident });
  }

  /**
   * Process resolved alert
   */
  async processResolvedAlert(alert: Alert): Promise<void> {
    if (!this.isEnabled) return;

    console.log(`✅ Alert resolved: ${alert.message}`);

    // Clear escalation timers
    this.clearEscalationTimers(alert.rule);

    // Update incident
    const incident = this.getIncidentByAlert(alert.id);
    if (incident) {
      await this.updateIncident(incident.id, {
        status: 'resolved'
      });

      // Send resolution notifications
      await this.sendNotifications(alert, 'resolved');

      // Auto-close incident if all alerts are resolved
      await this.autoCloseIncident(incident.id);
    }

    this.emit('alertResolved', alert);
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: Alert, type: 'alert' | 'resolved' | 'acknowledged' | 'escalated'): Promise<void> {
    const applicableChannels = Array.from(this.channels.values())
      .filter(channel =>
        channel.enabled &&
        channel.severity.includes(alert.severity)
      );

    for (const channel of applicableChannels) {
      try {
        await this.sendNotification(channel, alert, type);
      } catch (error) {
        console.error(`Failed to send ${type} notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(channel: NotificationChannel, alert: Alert, type: string): Promise<void> {
    const templateId = this.getTemplateId(alert.severity, type);
    const template = this.templates.get(templateId);

    if (!template) {
      console.warn(`No template found for ${type} notification with severity ${alert.severity}`);
      return;
    }

    const content = this.renderTemplate(template, alert, type);

    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(channel, content);
        break;
      case 'email':
        await this.sendEmailNotification(channel, content);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(channel, content);
        break;
      case 'sms':
        await this.sendSMSNotification(channel, content);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, content);
        break;
      default:
        console.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, content: string): Promise<void> {
    if (!channel.config.webhook) {
      console.warn('Slack webhook not configured');
      return;
    }

    const payload = {
      text: content,
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.icon_emoji
    };

    const response = await fetch(channel.config.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }

    console.log(`✅ Slack notification sent to ${channel.config.channel}`);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, content: string): Promise<void> {
    // Implementation would send email via SMTP or email service
    console.log(`📧 Email notification would be sent to: ${channel.config.to.join(', ')}`);
    console.log(`Content preview: ${content.substring(0, 100)}...`);
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(channel: NotificationChannel, content: string): Promise<void> {
    if (!channel.config.integration_key) {
      console.warn('PagerDuty integration key not configured');
      return;
    }

    const payload = {
      routing_key: channel.config.integration_key,
      event_action: 'trigger',
      payload: {
        summary: 'Critical Alert',
        source: 'Questro Platform',
        severity: channel.config.severity,
        custom_details: {
          message: content,
          timestamp: new Date().toISOString()
        }
      }
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token token=${channel.config.integration_key}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.statusText}`);
    }

    console.log('📱 PagerDuty incident created');
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(channel: NotificationChannel, content: string): Promise<void> {
    // Implementation would send SMS via Twilio or other SMS service
    console.log(`📱 SMS notification would be sent to: ${channel.config.to_numbers.join(', ')}`);
    console.log(`Content preview: ${content.substring(0, 100)}...`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, content: string): Promise<void> {
    // Implementation would send to custom webhook
    console.log(`🔗 Webhook notification would be sent to: ${channel.config.url || 'not configured'}`);
    console.log(`Content preview: ${content.substring(0, 100)}...`);
  }

  /**
   * Get template ID for alert
   */
  private getTemplateId(severity: string, type: string): string {
    if (severity === 'critical' && type === 'alert') {
      return 'alert-critical';
    } else if (severity === 'warning' && type === 'alert') {
      return 'alert-warning';
    } else if (type === 'resolved') {
      return 'resolved';
    }
    return 'alert-warning';
  }

  /**
   * Render template with alert data
   */
  private renderTemplate(template: NotificationTemplate, alert: Alert, type: string): string {
    let content = template.content;

    // Replace variables with actual values
    content = content.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      switch (variable) {
        case 'rule_name':
          return alert.labels?.rule_name || 'Unknown Rule';
        case 'category':
          return alert.labels?.category || 'Unknown';
        case 'service':
          return alert.labels?.service || 'Unknown';
        case 'value':
          return alert.value.toString();
        case 'threshold':
          return alert.threshold.toString();
        case 'timestamp':
          return alert.timestamp.toISOString();
        case 'description':
          return alert.message || 'No description available';
        case 'duration':
          return this.formatDuration(Date.now() - alert.timestamp.getTime());
        case 'resolved_timestamp':
          return new Date().toISOString();
        default:
          return match; // Keep unknown variables
      }
    });

    // Handle conditional blocks
    content = content.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, condition, content) => {
      const shouldRender = this.evaluateCondition(condition, alert);
      return shouldRender ? content : '';
    });

    // Handle loops
    content = content.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, variable, loopContent) => {
      const obj = alert.labels || {};
      const value = obj[variable];
      if (!value) return '';

      if (Array.isArray(value)) {
        return value.map(item => {
          return loopContent.replace(/\{\{@(\w+)\}\}/g, item);
        }).join('\n');
      } else if (typeof value === 'object') {
        return Object.entries(value).map(([key, val]) => {
          return loopContent.replace(/\{\{@(\w+)\}\}/g, val).replace(/\{\{@(\w+)\}\}/g, key);
        }).join('\n');
      }
      return '';
    });

    return content;
  }

  /**
   * Evaluate template condition
   */
  private evaluateCondition(condition: string, alert: Alert): boolean {
    // Simple condition evaluation
    if (condition.includes('is_database')) {
      return alert.labels?.service === 'database' || alert.labels?.category === 'database';
    }
    if (condition.includes('is_ai_service')) {
      return alert.labels?.service === 'ai' || alert.labels?.category === 'ai';
    }
    if (condition.includes('is_websocket')) {
      return alert.labels?.service === 'websocket' || alert.labels?.category === 'realtime';
    }
    return false;
  }

  /**
   * Format duration
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Create or update incident
   */
  private async createOrUpdateIncident(alert: Alert): Promise<Incident> {
    const incidentId = this.generateIncidentId(alert.rule);
    let incident = this.incidents.get(incidentId);

    if (!incident) {
      incident = {
        id: incidentId,
        title: `${alert.labels?.rule_name || 'Alert'}: ${alert.message}`,
        description: alert.message,
        severity: alert.severity as Incident['severity'],
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: Object.values(alert.labels || {}),
        alerts: [],
        notifications: [],
        timeline: []
      };

      this.incidents.set(incidentId, incident);
    }

    // Add alert to incident
    if (!incident.alerts.includes(alert.id)) {
      incident.alerts.push(alert.id);
      incident.updatedAt = new Date();
    }

    // Add timeline entry
    incident.timeline.push({
      id: this.generateTimelineId(),
      timestamp: new Date(),
      type: 'created',
      message: `Alert triggered: ${alert.message}`,
      details: {
        alertId: alert.id,
        value: alert.value,
        threshold: alert.threshold
      }
    });

    this.incidents.set(incidentId, incident);
    return incident;
  }

  /**
   * Update incident
   */
  private async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    Object.assign(incident, updates, { updatedAt: new Date() });
    this.incidents.set(incidentId, incident);
    return incident;
  }

  /**
   * Get incident by alert
   */
  private getIncidentByAlert(alertId: string): Incident | undefined {
    for (const incident of this.incidents.values()) {
      if (incident.alerts.includes(alertId)) {
        return incident;
      }
    }
    return undefined;
  }

  /**
   * Auto-close incident if all alerts are resolved
   */
  private async autoCloseIncident(incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Check if all associated alerts are resolved
    const activeAlerts = incident.alerts.filter(alertId => {
      const alert = this.alertHistory.get(alert.rule)?.find(a => a.id === alertId);
      return alert && !alert.resolved;
    });

    if (activeAlerts.length === 0) {
      await this.updateIncident(incidentId, {
        status: 'closed'
      });

      // Send closure notification
      this.emit('incidentClosed', incident);
    }
  }

  /**
   * Start escalation timers
   */
  private startEscalation(alert: Alert): void {
    // Clear existing timers
    this.clearEscalationTimers(alert.rule);

    // Apply escalation policies
    for (const policy of this.escalationPolicies.values()) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        if (this.shouldEscalate(alert, rule)) {
          const timer = setTimeout(() => {
            this.executeEscalation(alert, rule);
          }, rule.delay * 1000);

          this.escalationTimers.set(`${alert.rule}_${policy.id}_${rule.delay}`, timer);
        }
      }
    }
  }

  /**
   * Check if alert should escalate
   */
  private shouldEscalate(alert: Alert, rule: EscalationRule): boolean {
    // Simplified condition evaluation
    if (rule.condition.includes('severity == "critical"')) {
      return alert.severity === 'critical';
    }
    if (rule.condition.includes('not acknowledged')) {
      const incident = this.getIncidentByAlert(alert.id);
      return incident && incident.status !== 'acknowledged';
    }
    if (rule.condition.includes('age >')) {
      const age = rule.condition.match(/age > (\d+)/);
      if (age) {
        const ageMinutes = parseInt(age[1]);
        return (Date.now() - alert.timestamp.getTime()) > (ageMinutes * 60 * 1000);
      }
    }
    return false;
  }

  /**
   * Execute escalation action
   */
  private async executeEscalation(alert: Alert, rule: EscalationRule): Promise<void> {
    console.log(`📈 Escalating alert: ${alert.message} -> ${rule.action} via ${rule.channel}`);

    switch (rule.action) {
      case 'notify':
        await this.sendEscalationNotification(alert, rule);
        break;
      case 'create_incident':
        await this.createExternalIncident(alert, rule);
        break;
      case 'auto_resolve':
        await this.autoResolveAlert(alert);
        break;
    }

    this.emit('alertEscalated', { alert, rule });
  }

  /**
   * Send escalation notification
   */
  private async sendEscalationNotification(alert: Alert, rule: EscalationRule): Promise<void> {
    const channel = this.channels.get(rule.channel);
    if (!channel || !channel.enabled) return;

    const escalationContent = `
📈 **ESCALATION** 📈

**Alert:** {{rule_name}}
**Service:** {{category}} - {{service}}
**Value:** {{value}}
**Threshold:** {{threshold}}
**Duration:** {{duration}}

**Escalation Reason:**
- Alert has been active for {{duration}}
- No acknowledgment received
- Automatic escalation triggered

**Action Required:**
{{#if recipients}}
- Contact: {{#each recipients}}@{{this}}{{/each}}
- Investigate immediately
{{/if}}
    `.trim();

    try {
      await this.sendNotification(channel, alert, 'escalated');
    } catch (error) {
      console.error('Failed to send escalation notification:', error);
    }
  }

  /**
   * Create external incident
   */
  private async createExternalIncident(alert: Alert, rule: EscalationRule): Promise<void> {
    // Implementation would create incident in external system
    console.log(`🚨 Creating external incident for: ${alert.message}`);
  }

  /**
   * Auto-resolve alert
   */
  private async autoResolveAlert(alert: Alert): Promise<void> {
    console.log(`🔄 Auto-resolving alert: ${alert.message}`);

    // Mark alert as resolved
    alert.resolved = true;
    alert.acknowledged = true;
  }

  /**
   * Clear escalation timers
   */
  private clearEscalationTimers(ruleId: string): void {
    for (const [timerId, timer] of this.escalationTimers) {
      if (timerId.startsWith(ruleId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(timerId);
      }
    }
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.status === 'open' || incident.status === 'acknowledged'
    );
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Acknowledge incident
   */
  async acknowledgeIncident(incidentId: string, userId: string, message?: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    await this.updateIncident(incidentId, {
      status: 'acknowledged',
      assignedTo: userId
    });

    // Add timeline entry
    incident.timeline.push({
      id: this.generateTimelineId(),
      timestamp: new Date(),
      type: 'acknowledged',
      message: message || 'Incident acknowledged',
      user: userId,
      details: {
        assignedTo: userId
      }
    });

    this.emit('incidentAcknowledged', incident);
  }

  /**
   * Generate unique IDs
   */
  private generateIncidentId(ruleId: string): string {
    return `incident_${ruleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTimelineId(): string {
    return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enable/disable alert manager
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get alert history
   */
  getAlertHistory(ruleId?: string): Map<string, Alert[]> {
    if (ruleId) {
      const history = this.alertHistory.get(ruleId);
      return history ? new Map([[ruleId, history]]) : new Map();
    }
    return new Map(this.alertHistory);
  }

  /**
   * Get metrics about alerting
   */
  getMetrics(): any {
    const activeIncidents = this.getActiveIncidents();
    const activeAlerts = Array.from(this.alertHistory.values())
      .flat()
      .filter(alert => !alert.resolved);

    return {
      totalAlerts: activeAlerts.length,
      activeIncidents: activeIncidents.length,
      channelsActive: Array.from(this.channels.values()).filter(c => c.enabled).length,
      escalationTimersActive: this.escalationTimers.size,
      averageResolutionTime: this.calculateAverageResolutionTime()
    };
  }

  /**
   * Calculate average resolution time
   */
  private calculateAverageResolutionTime(): number {
    const resolvedAlerts = Array.from(this.alertHistory.values())
      .flat()
      .filter(alert => alert.resolved);

    if (resolvedAlerts.length === 0) return 0;

    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt ? alert.resolvedAt.getTime() - alert.timestamp.getTime() : 0);
    }, 0);

    return totalResolutionTime / resolvedAlerts.length;
  }

  /**
   * Cleanup old data
   */
  cleanup(): void {
    // Clean old alert history (keep last 7 days)
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const [ruleId, history] of this.alertHistory) {
      const filtered = history.filter(alert => alert.timestamp.getTime() > cutoff);
      this.alertHistory.set(ruleId, filtered);
    }

    // Clean old incidents (keep resolved incidents for 30 days)
    const incidentCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    for (const [incidentId, incident] of this.incidents) {
      if (incident.status === 'closed' && incident.updatedAt.getTime() < incidentCutoff) {
        this.incidents.delete(incidentId);
      }
    }
  }

  /**
   * Shutdown alert manager
   */
  shutdown(): void {
    // Clear all timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    this.setEnabled(false);
    console.log('Alert Manager shutdown completed');
  }
}

export { AlertManager };
