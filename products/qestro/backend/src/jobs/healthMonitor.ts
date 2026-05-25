import { logger } from '../utils/logger.js';
import { healthCheckService } from '../services/HealthCheckService.js';
import axios from 'axios';

interface AlertConfig {
  webhookUrl?: string;
  slackWebhook?: string;
  emailEndpoint?: string;
  thresholds: {
    unhealthyServices: number;
    responseTimeMs: number;
    memoryUsagePercent: number;
  };
}

class HealthMonitorJob {
  private config: AlertConfig;
  private lastAlertTime = new Map<string, number>();
  private alertCooldown = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.config = {
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      slackWebhook: process.env.SLACK_WEBHOOK_URL,
      emailEndpoint: process.env.EMAIL_ALERT_ENDPOINT,
      thresholds: {
        unhealthyServices: 1,
        responseTimeMs: 5000,
        memoryUsagePercent: 85
      }
    };
  }

  async run(): Promise<void> {
    logger.info('Starting health monitoring check');

    try {
      // Get current system health
      const healthStatus = await healthCheckService.checkSystemHealth();
      
      // Check for alerts
      await this.checkHealthAlerts(healthStatus);
      
      // Log health summary
      this.logHealthSummary(healthStatus);

      logger.info('Health monitoring check completed');

    } catch (error) {
      logger.error('Health monitoring check failed:', error);
      
      // Send alert about monitoring failure
      await this.sendAlert({
        type: 'monitoring-failure',
        severity: 'critical',
        message: 'Health monitoring system failed',
        details: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  private async checkHealthAlerts(healthStatus: any): Promise<void> {
    const alerts: any[] = [];

    // Check overall system health
    if (healthStatus.overall === 'unhealthy') {
      const unhealthyServices = healthStatus.services.filter(s => s.status === 'unhealthy');
      
      if (unhealthyServices.length >= this.config.thresholds.unhealthyServices) {
        alerts.push({
          type: 'system-unhealthy',
          severity: 'critical',
          message: `System is unhealthy with ${unhealthyServices.length} failed services`,
          details: {
            unhealthyServices: unhealthyServices.map(s => ({
              service: s.service,
              error: s.details?.error || 'Unknown error'
            })),
            totalServices: healthStatus.services.length
          },
          timestamp: new Date()
        });
      }
    }

    // Check individual service response times
    const slowServices = healthStatus.services.filter(
      s => s.responseTime > this.config.thresholds.responseTimeMs
    );

    if (slowServices.length > 0) {
      alerts.push({
        type: 'slow-response',
        severity: 'warning',
        message: `${slowServices.length} services have slow response times`,
        details: {
          slowServices: slowServices.map(s => ({
            service: s.service,
            responseTime: s.responseTime,
            threshold: this.config.thresholds.responseTimeMs
          }))
        },
        timestamp: new Date()
      });
    }

    // Check memory usage
    const memoryService = healthStatus.services.find(s => s.service === 'memory');
    if (memoryService && memoryService.details?.usagePercent > this.config.thresholds.memoryUsagePercent) {
      alerts.push({
        type: 'high-memory-usage',
        severity: 'warning',
        message: `High memory usage detected: ${memoryService.details.usagePercent}%`,
        details: {
          usagePercent: memoryService.details.usagePercent,
          threshold: this.config.thresholds.memoryUsagePercent,
          heapUsed: memoryService.details.heapUsed,
          heapTotal: memoryService.details.heapTotal
        },
        timestamp: new Date()
      });
    }

    // Check for degraded services
    const degradedServices = healthStatus.services.filter(s => s.status === 'degraded');
    if (degradedServices.length > 0) {
      alerts.push({
        type: 'services-degraded',
        severity: 'warning',
        message: `${degradedServices.length} services are in degraded state`,
        details: {
          degradedServices: degradedServices.map(s => ({
            service: s.service,
            details: s.details
          }))
        },
        timestamp: new Date()
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: any): Promise<void> {
    const alertKey = `${alert.type}-${alert.severity}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;

    // Check cooldown period
    if (now - lastAlert < this.alertCooldown) {
      logger.debug(`Alert ${alertKey} is in cooldown period, skipping`);
      return;
    }

    try {
      logger.warn(`Sending alert: ${alert.type} (${alert.severity})`, alert);

      // Send to webhook if configured
      if (this.config.webhookUrl) {
        await this.sendWebhookAlert(alert);
      }

      // Send to Slack if configured
      if (this.config.slackWebhook) {
        await this.sendSlackAlert(alert);
      }

      // Send email if configured
      if (this.config.emailEndpoint) {
        await this.sendEmailAlert(alert);
      }

      // Update last alert time
      this.lastAlertTime.set(alertKey, now);

    } catch (error) {
      logger.error(`Failed to send alert ${alertKey}:`, error);
    }
  }

  private async sendWebhookAlert(alert: any): Promise<void> {
    try {
      await axios.post(this.config.webhookUrl!, {
        alert_type: alert.type,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
        timestamp: alert.timestamp,
        service: 'qestro-backend',
        environment: process.env.NODE_ENV || 'development'
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Qestro-Health-Monitor/1.0'
        }
      });

      logger.info(`Webhook alert sent successfully for ${alert.type}`);
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  private async sendSlackAlert(alert: any): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 'danger' : 
                   alert.severity === 'warning' ? 'warning' : 'good';

      const slackMessage = {
        text: `🚨 Qestro Health Alert: ${alert.message}`,
        attachments: [
          {
            color,
            fields: [
              {
                title: 'Alert Type',
                value: alert.type,
                short: true
              },
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true
              },
              {
                title: 'Environment',
                value: process.env.NODE_ENV || 'development',
                short: true
              },
              {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true
              }
            ],
            footer: 'Qestro Health Monitor',
            ts: Math.floor(alert.timestamp.getTime() / 1000)
          }
        ]
      };

      if (alert.details) {
        slackMessage.attachments[0].fields.push({
          title: 'Details',
          value: JSON.stringify(alert.details, null, 2),
          short: false
        });
      }

      await axios.post(this.config.slackWebhook!, slackMessage, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info(`Slack alert sent successfully for ${alert.type}`);
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
    }
  }

  private async sendEmailAlert(alert: any): Promise<void> {
    try {
      const emailData = {
        to: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || ['admin@qestro.app'],
        subject: `🚨 Qestro Health Alert: ${alert.message}`,
        html: this.generateEmailHTML(alert),
        priority: alert.severity === 'critical' ? 'high' : 'normal'
      };

      await axios.post(this.config.emailEndpoint!, emailData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EMAIL_API_KEY || ''}`
        }
      });

      logger.info(`Email alert sent successfully for ${alert.type}`);
    } catch (error) {
      logger.error('Failed to send email alert:', error);
    }
  }

  private generateEmailHTML(alert: any): string {
    const severityColor = alert.severity === 'critical' ? '#dc3545' : 
                         alert.severity === 'warning' ? '#ffc107' : '#28a745';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Qestro Health Alert</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: ${severityColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .footer { background-color: #6c757d; color: white; padding: 10px; text-align: center; font-size: 12px; }
          .severity { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; background-color: ${severityColor}; font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Qestro Health Alert</h1>
            <p>${alert.message}</p>
          </div>
          <div class="content">
            <p><strong>Alert Type:</strong> ${alert.type}</p>
            <p><strong>Severity:</strong> <span class="severity">${alert.severity}</span></p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
            
            ${alert.details ? `
              <div class="details">
                <h3>Details:</h3>
                <pre>${JSON.stringify(alert.details, null, 2)}</pre>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            Qestro Health Monitor - Automated Alert System
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private logHealthSummary(healthStatus: any): void {
    const summary = {
      overall: healthStatus.overall,
      uptime: Math.round(healthStatus.uptime),
      services: {
        total: healthStatus.services.length,
        healthy: healthStatus.services.filter(s => s.status === 'healthy').length,
        degraded: healthStatus.services.filter(s => s.status === 'degraded').length,
        unhealthy: healthStatus.services.filter(s => s.status === 'unhealthy').length
      },
      averageResponseTime: Math.round(
        healthStatus.services.reduce((sum, s) => sum + s.responseTime, 0) / healthStatus.services.length
      )
    };

    logger.info('Health summary:', summary);

    // Log individual service issues
    const problematicServices = healthStatus.services.filter(s => s.status !== 'healthy');
    if (problematicServices.length > 0) {
      logger.warn('Services with issues:', problematicServices.map(s => ({
        service: s.service,
        status: s.status,
        responseTime: s.responseTime,
        error: s.details?.error
      })));
    }
  }
}

// Run the health monitor job if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthMonitor = new HealthMonitorJob();
  
  healthMonitor.run()
    .then(() => {
      logger.info('Health monitor job finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Health monitor job failed:', error);
      process.exit(1);
    });
}

export { HealthMonitorJob };