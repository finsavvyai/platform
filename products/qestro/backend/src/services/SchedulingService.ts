import cron from 'node-cron';
import { DataSourceService } from './DataSourceService.js';
import { ReportingService } from './ReportingService.js';
import { NotificationService } from './NotificationService.js';
import { AIService } from './AIService.js';

export interface ScheduledTest {
  id: string;
  name: string;
  description?: string;
  userId: string;
  dataSourceId: string;
  testType: 'query' | 'api' | 'performance' | 'security';

  // Test Configuration
  config: {
    queries?: any[];
    endpoints?: any[];
    performanceConfig?: any;
    securityConfig?: any;
  };

  // Schedule Configuration
  schedule: {
    type: 'cron' | 'interval' | 'once';
    expression: string; // cron expression or interval
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
  };

  // Alert Configuration
  alerts: {
    enabled: boolean;
    conditions: AlertCondition[];
    channels: AlertChannel[];
    escalation?: {
      enabled: boolean;
      levels: EscalationLevel[];
    };
  };

  // Test Thresholds
  thresholds: {
    responseTime?: number; // ms
    errorRate?: number; // percentage
    availability?: number; // percentage
    customMetrics?: Record<string, number>;
  };

  status: 'active' | 'paused' | 'stopped' | 'error';
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  duration?: number; // seconds to maintain condition before alerting
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertChannel {
  id: string;
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'voice';
  config: any;
  severity: 'low' | 'medium' | 'high' | 'critical'[];
  enabled: boolean;
}

export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  channels: string[]; // channel IDs
  conditions: string[]; // condition IDs that trigger this level
}

export interface TestResult {
  testId: string;
  runId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;

  metrics: {
    responseTime?: number;
    errorRate?: number;
    availability?: number;
    throughput?: number;
    customMetrics?: Record<string, number>;
  };

  results: any;
  error?: string;

  alertsTriggered: {
    conditionId: string;
    severity: string;
    message: string;
    timestamp: Date;
  }[];
}

export interface ScheduledTestSummary {
  total: number;
  active: number;
  paused: number;
  failed: number;
  upcomingRuns: {
    testId: string;
    testName: string;
    nextRun: Date;
  }[];
  recentAlerts: {
    testId: string;
    testName: string;
    severity: string;
    message: string;
    timestamp: Date;
  }[];
}

export class SchedulingService {
  private scheduledJobs = new Map<string, any>();
  private dataSourceService: DataSourceService;
  private reportingService: ReportingService;
  private notificationService: NotificationService;
  private aiService: AIService;

  constructor() {
    this.dataSourceService = new DataSourceService();
    this.reportingService = new ReportingService();
    this.notificationService = new NotificationService();
    this.aiService = new AIService();

    // Initialization moved to explicit initialize() method
  }

  public async initialize(): Promise<void> {
    await this.initializeScheduledTests();
  }

  async createScheduledTest(test: Omit<ScheduledTest, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>): Promise<ScheduledTest> {
    const id = this.generateId();
    const now = new Date();

    const scheduledTest: ScheduledTest = {
      ...test,
      id,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      nextRun: this.calculateNextRun(test.schedule)
    };

    // Store in database
    await this.storeScheduledTest(scheduledTest);

    // Schedule the job
    if (scheduledTest.status === 'active') {
      this.scheduleJob(scheduledTest);
    }

    return scheduledTest;
  }

  async updateScheduledTest(id: string, updates: Partial<ScheduledTest>): Promise<ScheduledTest> {
    const test = await this.getScheduledTest(id);
    if (!test) {
      throw new Error('Scheduled test not found');
    }

    const updatedTest = {
      ...test,
      ...updates,
      updatedAt: new Date(),
      nextRun: updates.schedule ? this.calculateNextRun(updates.schedule) : test.nextRun
    };

    // Update in database
    await this.updateScheduledTestInDB(id, updatedTest);

    // Reschedule if needed
    this.unscheduleJob(id);
    if (updatedTest.status === 'active') {
      this.scheduleJob(updatedTest);
    }

    return updatedTest;
  }

  async deleteScheduledTest(id: string): Promise<void> {
    // Unschedule job
    this.unscheduleJob(id);

    // Delete from database
    await this.deleteScheduledTestFromDB(id);
  }

  async pauseScheduledTest(id: string): Promise<void> {
    await this.updateScheduledTest(id, { status: 'paused' });
  }

  async resumeScheduledTest(id: string): Promise<void> {
    await this.updateScheduledTest(id, { status: 'active' });
  }

  async runTestNow(id: string): Promise<TestResult> {
    const test = await this.getScheduledTest(id);
    if (!test) {
      throw new Error('Scheduled test not found');
    }

    return await this.executeTest(test);
  }

  async getScheduledTests(userId: string, filters?: {
    status?: string;
    testType?: string;
    dataSourceId?: string;
  }): Promise<ScheduledTest[]> {
    return await this.fetchScheduledTests(userId, filters);
  }

  async getScheduledTestSummary(userId: string): Promise<ScheduledTestSummary> {
    const tests = await this.fetchScheduledTests(userId);
    const recentAlerts = await this.fetchRecentAlerts(userId);

    const summary: ScheduledTestSummary = {
      total: tests.length,
      active: tests.filter(t => t.status === 'active').length,
      paused: tests.filter(t => t.status === 'paused').length,
      failed: tests.filter(t => t.status === 'error').length,
      upcomingRuns: tests
        .filter(t => t.status === 'active' && t.nextRun)
        .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime())
        .slice(0, 5)
        .map(t => ({
          testId: t.id,
          testName: t.name,
          nextRun: t.nextRun!
        })),
      recentAlerts: recentAlerts.slice(0, 10)
    };

    return summary;
  }

  async getTestResults(testId: string, limit: number = 50): Promise<TestResult[]> {
    return await this.fetchTestResults(testId, limit);
  }

  private async initializeScheduledTests(): Promise<void> {
    try {
      console.log('Initializing scheduled tests...');
      const activeTests = await this.fetchAllActiveTests();

      for (const test of activeTests) {
        this.scheduleJob(test);
      }

      console.log(`Initialized ${activeTests.length} scheduled tests`);
    } catch (error) {
      console.error('Failed to initialize scheduled tests:', error);
    }
  }

  private scheduleJob(test: ScheduledTest): void {
    try {
      let cronExpression: string;

      switch (test.schedule.type) {
        case 'cron':
          cronExpression = test.schedule.expression;
          break;
        case 'interval':
          // Convert interval to cron (e.g., "5m" -> "*/5 * * * *")
          cronExpression = this.intervalToCron(test.schedule.expression);
          break;
        case 'once':
          // Schedule for specific time
          cronExpression = this.dateToCron(new Date(test.schedule.expression));
          break;
        default:
          throw new Error(`Unsupported schedule type: ${test.schedule.type}`);
      }

      const job = cron.schedule(cronExpression, async () => {
        await this.executeTest(test);
      }, {
        scheduled: true,
        timezone: test.schedule.timezone || 'UTC'
      });

      this.scheduledJobs.set(test.id, job);
      console.log(`Scheduled test "${test.name}" with expression: ${cronExpression}`);
    } catch (error) {
      console.error(`Failed to schedule test ${test.id}:`, error);
    }
  }

  private unscheduleJob(testId: string): void {
    const job = this.scheduledJobs.get(testId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(testId);
      console.log(`Unscheduled test ${testId}`);
    }
  }

  private async executeTest(test: ScheduledTest): Promise<TestResult> {
    const runId = this.generateId();
    const startTime = new Date();

    console.log(`Executing scheduled test: ${test.name} (${test.id})`);

    try {
      let results: any;
      let metrics: any = {};

      // Execute based on test type
      switch (test.testType) {
        case 'query':
          results = await this.executeQueryTests(test);
          break;
        case 'api':
          results = await this.executeAPITests(test);
          break;
        case 'performance':
          results = await this.executePerformanceTests(test);
          break;
        case 'security':
          results = await this.executeSecurityTests(test);
          break;
        default:
          throw new Error(`Unsupported test type: ${test.testType}`);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Extract metrics
      metrics = this.extractMetrics(results, test.testType);

      const testResult: TestResult = {
        testId: test.id,
        runId,
        startTime,
        endTime,
        duration,
        success: results.success,
        metrics,
        results,
        alertsTriggered: []
      };

      // Check alert conditions
      const triggeredAlerts = await this.checkAlertConditions(test, testResult);
      testResult.alertsTriggered = triggeredAlerts;

      // Send alerts if any were triggered
      if (triggeredAlerts.length > 0) {
        await this.sendAlerts(test, testResult, triggeredAlerts);
      }

      // Store result
      await this.storeTestResult(testResult);

      // Update test stats
      await this.updateTestStats(test.id, testResult);

      // Generate AI insights if needed
      if (testResult.success) {
        await this.generateAIInsights(test, testResult);
      }

      return testResult;

    } catch (error) {
      console.error(`Test execution failed for ${test.id}:`, error);

      const endTime = new Date();
      const testResult: TestResult = {
        testId: test.id,
        runId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: false,
        metrics: {},
        results: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        alertsTriggered: []
      };

      // Send failure alerts
      await this.sendFailureAlerts(test, testResult);

      // Store failed result
      await this.storeTestResult(testResult);

      return testResult;
    }
  }

  private async executeQueryTests(test: ScheduledTest): Promise<any> {
    const results = [];

    for (const query of test.config.queries || []) {
      const result = await this.dataSourceService.executeQuery(test.dataSourceId, query);
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      results,
      totalQueries: results.length,
      successfulQueries: results.filter(r => r.success).length
    };
  }

  private async executeAPITests(test: ScheduledTest): Promise<any> {
    const results = [];

    for (const endpoint of test.config.endpoints || []) {
      const result = await this.dataSourceService.testAPIEndpoint(test.dataSourceId, endpoint);
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      results,
      totalEndpoints: results.length,
      successfulEndpoints: results.filter(r => r.success).length
    };
  }

  private async executePerformanceTests(test: ScheduledTest): Promise<any> {
    const config = test.config.performanceConfig;
    const testResult = await this.dataSourceService.createPerformanceTest(test.dataSourceId, config);

    if (testResult.testId) {
      return await this.dataSourceService.runPerformanceTest(testResult.testId);
    }

    throw new Error('Failed to create performance test');
  }

  private async executeSecurityTests(test: ScheduledTest): Promise<any> {
    // This would integrate with the SecurityScanner service
    // For now, return a placeholder
    return {
      success: true,
      vulnerabilities: [],
      securityScore: 95
    };
  }

  private extractMetrics(results: any, testType: string): any {
    let metrics: any = {};

    switch (testType) {
      case 'query':
      case 'api':
        if (results.results) {
          const responseTimes = results.results
            .filter((r: any) => r.success && r.response?.responseTime)
            .map((r: any) => r.response.responseTime);

          if (responseTimes.length > 0) {
            metrics.responseTime = responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length;
          }

          metrics.errorRate = ((results.totalEndpoints || results.totalQueries || 0) -
            (results.successfulEndpoints || results.successfulQueries || 0)) /
            (results.totalEndpoints || results.totalQueries || 1) * 100;

          metrics.availability = results.success ? 100 : 0;
        }
        break;

      case 'performance':
        if (results.results && results.results.metrics) {
          metrics = { ...results.results.metrics };
        }
        break;

      case 'security':
        if (results.vulnerabilities !== undefined) {
          metrics.securityScore = results.securityScore || 0;
          metrics.vulnerabilityCount = results.vulnerabilities.length || 0;
        }
        break;
    }

    return metrics;
  }

  private async checkAlertConditions(test: ScheduledTest, result: TestResult): Promise<any[]> {
    const triggeredAlerts = [];

    for (const condition of test.alerts.conditions) {
      const metricValue = result.metrics[condition.metric];

      if (metricValue !== undefined) {
        const triggered = this.evaluateCondition(metricValue, condition.operator, condition.value);

        if (triggered) {
          triggeredAlerts.push({
            conditionId: condition.id,
            severity: condition.severity,
            message: `${condition.name}: ${condition.metric} is ${metricValue} (threshold: ${condition.operator} ${condition.value})`,
            timestamp: new Date()
          });
        }
      }
    }

    return triggeredAlerts;
  }

  private evaluateCondition(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'eq': return actual === expected;
      case 'gte': return actual >= expected;
      case 'lte': return actual <= expected;
      case 'ne': return actual !== expected;
      default: return false;
    }
  }

  private async sendAlerts(test: ScheduledTest, result: TestResult, alerts: any[]): Promise<void> {
    for (const alert of alerts) {
      const relevantChannels = test.alerts.channels.filter(channel =>
        channel.enabled && channel.severity.includes(alert.severity)
      );

      for (const channel of relevantChannels) {
        try {
          await this.sendAlert(test, result, alert, channel);
        } catch (error) {
          console.error(`Failed to send alert via ${channel.type}:`, error);
        }
      }

      // Handle escalation if configured
      if (test.alerts.escalation?.enabled && alert.severity === 'critical') {
        await this.handleEscalation(test, result, alert);
      }
    }
  }

  private async sendAlert(test: ScheduledTest, result: TestResult, alert: any, channel: AlertChannel): Promise<void> {
    const message = await this.generateAlertMessage(test, result, alert);

    switch (channel.type) {
      case 'email':
        await this.notificationService.sendEmail({
          to: channel.config.recipients,
          subject: `🚨 Alert: ${test.name} - ${alert.severity.toUpperCase()}`,
          html: await this.generateEmailAlertContent(test, result, alert, message),
          priority: alert.severity === 'critical' ? 'high' : 'normal'
        });
        break;

      case 'sms':
        await this.notificationService.sendSMS({
          to: channel.config.phoneNumbers,
          message: `ALERT: ${test.name} - ${message}`,
          priority: alert.severity === 'critical' ? 'high' : 'normal'
        });
        break;

      case 'slack':
        await this.notificationService.sendSlack({
          channel: channel.config.channel,
          message: await this.generateSlackAlertContent(test, result, alert, message),
          urgency: alert.severity,
          mentionChannel: alert.severity === 'critical'
        });
        break;

      case 'webhook':
        await this.notificationService.sendWebhook({
          url: channel.config.url,
          payload: {
            test: {
              id: test.id,
              name: test.name,
              type: test.testType
            },
            alert,
            result: {
              success: result.success,
              metrics: result.metrics,
              timestamp: result.startTime
            }
          },
          headers: channel.config.headers
        });
        break;

      case 'voice':
        if (alert.severity === 'critical') {
          await this.notificationService.makeVoiceCall({
            to: channel.config.phoneNumber,
            message: `Critical alert for ${test.name}. ${message}. Please check your monitoring dashboard immediately.`
          });
        }
        break;
    }
  }

  private async generateAlertMessage(test: ScheduledTest, result: TestResult, alert: any): Promise<string> {
    const context = {
      testName: test.name,
      testType: test.testType,
      alertSeverity: alert.severity,
      alertMessage: alert.message,
      metrics: result.metrics,
      timestamp: result.startTime
    };

    // Use AI to generate contextual alert message
    try {
      const aiMessage = await this.aiService.generateAlertMessage(context);
      return aiMessage || alert.message;
    } catch (error) {
      console.error('AI alert message generation failed:', error);
      return alert.message;
    }
  }

  private async generateEmailAlertContent(test: ScheduledTest, result: TestResult, alert: any, message: string): Promise<string> {
    const severityColors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444',
      critical: '#DC2626'
    };

    return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .header { background: ${severityColors[alert.severity as keyof typeof severityColors]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .metric { background: white; padding: 10px; margin: 10px 0; border-radius: 4px; border-left: 4px solid ${severityColors[alert.severity as keyof typeof severityColors]}; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚨 ${alert.severity.toUpperCase()} Alert</h1>
          <h2>${test.name}</h2>
        </div>
        <div class="content">
          <p><strong>Alert Message:</strong> ${message}</p>
          <p><strong>Test Type:</strong> ${test.testType}</p>
          <p><strong>Time:</strong> ${result.startTime.toLocaleString()}</p>
          
          <h3>Metrics:</h3>
          ${Object.entries(result.metrics).map(([key, value]) =>
      `<div class="metric"><strong>${key}:</strong> ${value}</div>`
    ).join('')}
          
          <p><a href="${process.env.FRONTEND_URL}/tests/scheduled/${test.id}" style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Details</a></p>
        </div>
        <div class="footer">
          Generated by Questro AI Testing Platform
        </div>
      </body>
    </html>
    `;
  }

  private async generateSlackAlertContent(test: ScheduledTest, result: TestResult, alert: any, message: string): Promise<string> {
    const severityEmojis = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };

    return `${severityEmojis[alert.severity as keyof typeof severityEmojis]} *${alert.severity.toUpperCase()} Alert*

*Test:* ${test.name}
*Type:* ${test.testType}
*Message:* ${message}

*Metrics:*
${Object.entries(result.metrics).map(([key, value]) => `• *${key}:* ${value}`).join('\n')}

<${process.env.FRONTEND_URL}/tests/scheduled/${test.id}|View Details>`;
  }

  private async sendFailureAlerts(test: ScheduledTest, result: TestResult): Promise<void> {
    const failureAlert = {
      conditionId: 'failure',
      severity: 'high',
      message: `Test execution failed: ${result.error}`,
      timestamp: new Date()
    };

    const relevantChannels = test.alerts.channels.filter(channel =>
      channel.enabled && channel.severity.includes('high' as any)
    );

    for (const channel of relevantChannels) {
      await this.sendAlert(test, result, failureAlert, channel);
    }
  }

  private async handleEscalation(test: ScheduledTest, result: TestResult, alert: any): Promise<void> {
    if (!test.alerts.escalation) return;

    for (const level of test.alerts.escalation.levels) {
      if (level.conditions.includes(alert.conditionId)) {
        // Schedule escalation after delay
        setTimeout(async () => {
          // Check if alert is still active
          const recentResults = await this.fetchTestResults(test.id, 1);
          if (recentResults.length > 0 && !recentResults[0].success) {
            // Send escalation alerts
            const escalationChannels = test.alerts.channels.filter(channel =>
              level.channels.includes(channel.id)
            );

            for (const channel of escalationChannels) {
              await this.sendAlert(test, result, {
                ...alert,
                message: `ESCALATION Level ${level.level}: ${alert.message}`
              }, channel);
            }
          }
        }, level.delayMinutes * 60 * 1000);
      }
    }
  }

  private async generateAIInsights(test: ScheduledTest, result: TestResult): Promise<void> {
    try {
      // Get historical results for trend analysis
      const historicalResults = await this.fetchTestResults(test.id, 20);

      const insights = await this.aiService.generateTestInsights({
        test,
        currentResult: result,
        historicalResults,
        metrics: result.metrics
      });

      // Store insights for later retrieval
      await this.storeTestInsights(test.id, result.runId, insights);
    } catch (error) {
      console.error('AI insights generation failed:', error);
    }
  }

  private calculateNextRun(schedule: ScheduledTest['schedule']): Date {
    const now = new Date();

    switch (schedule.type) {
      case 'cron':
        // Use a cron parser library to calculate next run
        return new Date(now.getTime() + 60000); // Placeholder: 1 minute from now

      case 'interval':
        const intervalMs = this.parseInterval(schedule.expression);
        return new Date(now.getTime() + intervalMs);

      case 'once':
        return new Date(schedule.expression);

      default:
        return new Date(now.getTime() + 60000);
    }
  }

  private intervalToCron(interval: string): string {
    // Convert interval strings like "5m", "1h", "30s" to cron
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 's': return `*/${num} * * * * *`; // Every N seconds
      case 'm': return `*/${num} * * * *`; // Every N minutes
      case 'h': return `0 */${num} * * *`; // Every N hours
      case 'd': return `0 0 */${num} * *`; // Every N days
      default: throw new Error(`Unsupported interval unit: ${unit}`);
    }
  }

  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${minute} ${hour} ${day} ${month} *`;
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: throw new Error(`Unsupported interval unit: ${unit}`);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Database operations (placeholders - implement with actual database)
  private async storeScheduledTest(test: ScheduledTest): Promise<void> {
    console.log('Storing scheduled test:', test.name);
  }

  async getScheduledTest(id: string): Promise<ScheduledTest | null> {
    // Implement database lookup
    return null;
  }

  private async updateScheduledTestInDB(id: string, test: ScheduledTest): Promise<void> {
    console.log('Updating scheduled test:', id);
  }

  private async deleteScheduledTestFromDB(id: string): Promise<void> {
    console.log('Deleting scheduled test:', id);
  }

  private async fetchScheduledTests(userId: string, filters?: any): Promise<ScheduledTest[]> {
    // Implement database query
    return [];
  }

  private async fetchAllActiveTests(): Promise<ScheduledTest[]> {
    // Implement database query for all active tests
    return [];
  }

  private async storeTestResult(result: TestResult): Promise<void> {
    console.log('Storing test result:', result.runId);
  }

  private async fetchTestResults(testId: string, limit: number): Promise<TestResult[]> {
    // Implement database query
    return [];
  }

  private async updateTestStats(testId: string, result: TestResult): Promise<void> {
    console.log('Updating test stats:', testId);
  }

  private async fetchRecentAlerts(userId: string): Promise<any[]> {
    // Implement database query for recent alerts
    return [];
  }

  async testNotificationChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
    return this.notificationService.testNotificationChannel(channelId);
  }

  async getNotificationLogs(filters: any): Promise<any[]> {
    return this.notificationService.getNotificationLogs(filters);
  }

  private async storeTestInsights(testId: string, runId: string, insights: any): Promise<void> {
    console.log('Storing test insights:', testId, runId);
  }
}

export const schedulingService = new SchedulingService();