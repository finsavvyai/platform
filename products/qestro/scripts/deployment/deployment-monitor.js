#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DeploymentMonitor {
  constructor() {
    this.config = {
      frontendUrl: process.env.FRONTEND_URL || 'https://qestro.app',
      backendUrl: process.env.BACKEND_URL || 'https://api.qestro.app',
      checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000, // 1 minute
      alertThreshold: parseInt(process.env.ALERT_THRESHOLD) || 3, // 3 consecutive failures
      slackWebhook: process.env.SLACK_WEBHOOK_URL,
      emailEndpoint: process.env.EMAIL_ALERT_ENDPOINT
    };
    
    this.state = {
      consecutiveFailures: 0,
      lastSuccessfulCheck: null,
      isAlerting: false,
      startTime: new Date(),
      checks: []
    };
    
    this.isRunning = false;
  }

  /**
   * Start deployment monitoring
   */
  async startMonitoring() {
    console.log('🔍 Starting Deployment Monitoring...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Frontend URL: ${this.config.frontendUrl}`);
    console.log(`Backend URL: ${this.config.backendUrl}`);
    console.log(`Check Interval: ${this.config.checkInterval}ms`);
    console.log(`Alert Threshold: ${this.config.alertThreshold} failures`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    this.isRunning = true;
    
    // Initial check
    await this.performHealthCheck();
    
    // Setup periodic checks
    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }
      
      await this.performHealthCheck();
    }, this.config.checkInterval);
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.stopMonitoring());
    process.on('SIGTERM', () => this.stopMonitoring());
    
    console.log('✅ Deployment monitoring started successfully');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const checkId = `check_${Date.now()}`;
    const checkStart = new Date();
    
    console.log(`\n🔍 Performing health check ${checkId}...`);
    
    const results = {
      id: checkId,
      timestamp: checkStart.toISOString(),
      frontend: await this.checkFrontend(),
      backend: await this.checkBackend(),
      database: await this.checkDatabase(),
      websocket: await this.checkWebSocket(),
      overall: 'healthy'
    };
    
    // Determine overall health
    const failedChecks = Object.values(results).filter(check => 
      typeof check === 'object' && check.status === 'unhealthy'
    );
    
    if (failedChecks.length > 0) {
      results.overall = 'unhealthy';
      this.state.consecutiveFailures++;
      
      console.log(`❌ Health check failed (${this.state.consecutiveFailures}/${this.config.alertThreshold})`);
      
      // Check if we need to send alerts
      if (this.state.consecutiveFailures >= this.config.alertThreshold && !this.state.isAlerting) {
        await this.sendAlert('CRITICAL', 'Deployment health check failures exceeded threshold', results);
        this.state.isAlerting = true;
      }
    } else {
      results.overall = 'healthy';
      
      // Reset failure count and alerting state
      if (this.state.consecutiveFailures > 0) {
        console.log('✅ Health check recovered');
        
        if (this.state.isAlerting) {
          await this.sendAlert('RECOVERY', 'Deployment health check recovered', results);
          this.state.isAlerting = false;
        }
      }
      
      this.state.consecutiveFailures = 0;
      this.state.lastSuccessfulCheck = new Date();
    }
    
    // Store check result
    this.state.checks.push(results);
    
    // Keep only last 100 checks
    if (this.state.checks.length > 100) {
      this.state.checks = this.state.checks.slice(-100);
    }
    
    // Save state to file
    await this.saveState();
    
    const duration = Date.now() - checkStart.getTime();
    console.log(`Health check completed in ${duration}ms - Status: ${results.overall}`);
  }

  /**
   * Check frontend health
   */
  async checkFrontend() {
    try {
      const startTime = Date.now();
      const response = await axios.get(this.config.frontendUrl, {
        timeout: 15000,
        validateStatus: () => true
      });
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        return {
          status: 'healthy',
          responseTime,
          statusCode: response.status,
          message: 'Frontend is accessible'
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          statusCode: response.status,
          message: `Frontend returned status ${response.status}`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: null,
        statusCode: null,
        message: `Frontend check failed: ${error.message}`
      };
    }
  }

  /**
   * Check backend health
   */
  async checkBackend() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.config.backendUrl}/health`, {
        timeout: 15000
      });
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200 && response.data.status === 'healthy') {
        return {
          status: 'healthy',
          responseTime,
          statusCode: response.status,
          message: 'Backend is healthy',
          details: response.data
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          statusCode: response.status,
          message: 'Backend health check failed',
          details: response.data
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: null,
        statusCode: null,
        message: `Backend check failed: ${error.message}`
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.config.backendUrl}/health/database`, {
        timeout: 10000
      });
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200 && response.data.database === 'connected') {
        return {
          status: 'healthy',
          responseTime,
          message: 'Database is connected'
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'Database connectivity check failed'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: null,
        message: `Database check failed: ${error.message}`
      };
    }
  }

  /**
   * Check WebSocket connectivity
   */
  async checkWebSocket() {
    return new Promise((resolve) => {
      try {
        const WebSocket = require('ws');
        const wsUrl = this.config.backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const ws = new WebSocket(wsUrl);
        const startTime = Date.now();
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            message: 'WebSocket connection timeout'
          });
        }, 10000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          const responseTime = Date.now() - startTime;
          ws.close();
          resolve({
            status: 'healthy',
            responseTime,
            message: 'WebSocket connection successful'
          });
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            message: `WebSocket error: ${error.message}`
          });
        });
        
      } catch (error) {
        resolve({
          status: 'unhealthy',
          responseTime: null,
          message: `WebSocket check failed: ${error.message}`
        });
      }
    });
  }

  /**
   * Send alert notification
   */
  async sendAlert(severity, message, details) {
    console.log(`🚨 Sending ${severity} alert: ${message}`);
    
    const alert = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      environment: 'production',
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccessfulCheck: this.state.lastSuccessfulCheck,
      details
    };
    
    // Send to Slack if configured
    if (this.config.slackWebhook) {
      await this.sendSlackAlert(alert);
    }
    
    // Send email if configured
    if (this.config.emailEndpoint) {
      await this.sendEmailAlert(alert);
    }
    
    // Log alert to file
    await this.logAlert(alert);
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const color = alert.severity === 'CRITICAL' ? 'danger' : 'good';
      const emoji = alert.severity === 'CRITICAL' ? '🚨' : '✅';
      
      const payload = {
        text: `${emoji} Qestro Deployment Alert - ${alert.severity}`,
        attachments: [{
          color,
          fields: [
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: true
            },
            {
              title: 'Consecutive Failures',
              value: alert.consecutiveFailures.toString(),
              short: true
            }
          ]
        }]
      };
      
      await axios.post(this.config.slackWebhook, payload);
      console.log('✅ Slack alert sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to send Slack alert:', error.message);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const payload = {
        to: process.env.ALERT_EMAIL || 'alerts@qestro.app',
        subject: `Qestro Deployment Alert - ${alert.severity}`,
        body: `
          Deployment Alert: ${alert.message}
          
          Severity: ${alert.severity}
          Environment: ${alert.environment}
          Timestamp: ${alert.timestamp}
          Consecutive Failures: ${alert.consecutiveFailures}
          Last Successful Check: ${alert.lastSuccessfulCheck}
          
          Details:
          ${JSON.stringify(alert.details, null, 2)}
        `
      };
      
      await axios.post(this.config.emailEndpoint, payload);
      console.log('✅ Email alert sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to send email alert:', error.message);
    }
  }

  /**
   * Log alert to file
   */
  async logAlert(alert) {
    try {
      const alertsDir = path.join(process.cwd(), 'logs', 'alerts');
      if (!fs.existsSync(alertsDir)) {
        fs.mkdirSync(alertsDir, { recursive: true });
      }
      
      const alertFile = path.join(alertsDir, `alerts-${new Date().toISOString().split('T')[0]}.json`);
      
      let alerts = [];
      if (fs.existsSync(alertFile)) {
        alerts = JSON.parse(fs.readFileSync(alertFile, 'utf8'));
      }
      
      alerts.push(alert);
      fs.writeFileSync(alertFile, JSON.stringify(alerts, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to log alert:', error.message);
    }
  }

  /**
   * Save monitoring state
   */
  async saveState() {
    try {
      const stateFile = path.join(process.cwd(), 'deployment-monitor-state.json');
      const state = {
        ...this.state,
        config: this.config,
        uptime: Date.now() - this.state.startTime.getTime()
      };
      
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to save state:', error.message);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    const uptime = Date.now() - this.state.startTime.getTime();
    const recentChecks = this.state.checks.slice(-10);
    
    return {
      isRunning: this.isRunning,
      uptime: `${Math.floor(uptime / 1000)}s`,
      consecutiveFailures: this.state.consecutiveFailures,
      lastSuccessfulCheck: this.state.lastSuccessfulCheck,
      isAlerting: this.state.isAlerting,
      totalChecks: this.state.checks.length,
      recentChecks
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    console.log('\n🛑 Stopping deployment monitoring...');
    this.isRunning = false;
    
    // Save final state
    this.saveState();
    
    console.log('✅ Deployment monitoring stopped');
    process.exit(0);
  }
}

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new DeploymentMonitor();
  monitor.startMonitoring().catch(console.error);
}

module.exports = DeploymentMonitor;