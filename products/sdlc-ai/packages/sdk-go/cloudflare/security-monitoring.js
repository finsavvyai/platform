// Security monitoring and alerting for Cloudflare Workers

export class SecurityMonitor {
  constructor(env) {
    this.env = env;
    this.alertThresholds = {
      rateLimitHits: 50,
      authFailures: 10,
      suspiciousRequests: 20,
      errorRate: 0.1 // 10%
    };
  }

  // Monitor rate limit violations
  async monitorRateLimit(clientIP, endpoint) {
    const key = `rate_limit_monitor_${clientIP}_${endpoint}`;
    const current = await this.env.ANALYTICS.prepare(`
      SELECT COUNT(*) as count
      FROM analytics
      WHERE clientIP = ? AND endpoint = ? AND timestamp > NOW() - INTERVAL '1 hour'
    `).bind(clientIP, endpoint).first();

    if (current.count > this.alertThresholds.rateLimitHits) {
      await this.sendAlert({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        clientIP,
        endpoint,
        count: current.count,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Monitor authentication failures
  async monitorAuthFailure(clientIP, endpoint, reason) {
    const key = `auth_failure_${clientIP}_${endpoint}`;
    const current = await this.env.ANALYTICS.prepare(`
      SELECT COUNT(*) as count
      FROM analytics
      WHERE clientIP = ? AND endpoint = ? AND event = 'auth_failure' AND timestamp > NOW() - INTERVAL '1 hour'
    `).bind(clientIP, endpoint).first();

    if (current.count > this.alertThresholds.authFailures) {
      await this.sendAlert({
        type: 'AUTH_FAILURE_THRESHOLD',
        severity: 'CRITICAL',
        clientIP,
        endpoint,
        reason,
        count: current.count,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Monitor suspicious request patterns
  async monitorSuspiciousRequest(request, reason) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const endpoint = new URL(request.url).pathname;

    // Log suspicious activity
    await this.env.ANALYTICS.writeDataPoint({
      blobs: [clientIP, userAgent, endpoint, reason],
      doubles: [1], // event count
      indexes: ['suspicious_activity']
    });

    // Check if threshold exceeded
    const count = await this.env.ANALYTICS.prepare(`
      SELECT SUM(count) as total
      FROM analytics
      WHERE clientIP = ? AND timestamp > NOW() - INTERVAL '1 hour' AND index_id = 'suspicious_activity'
    `).bind(clientIP).first();

    if (count.total > this.alertThresholds.suspiciousRequests) {
      await this.sendAlert({
        type: 'SUSPICIOUS_ACTIVITY_THRESHOLD',
        severity: 'HIGH',
        clientIP,
        userAgent,
        endpoint,
        reason,
        count: count.total,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Monitor error rates
  async monitorErrorRate(endpoint, statusCode) {
    const totalRequests = await this.env.ANALYTICS.prepare(`
      SELECT COUNT(*) as count
      FROM analytics
      WHERE endpoint = ? AND timestamp > NOW() - INTERVAL '5 minutes'
    `).bind(endpoint).first();

    const errorRequests = await this.env.ANALYTICS.prepare(`
      SELECT COUNT(*) as count
      FROM analytics
      WHERE endpoint = ? AND statusCode >= 400 AND timestamp > NOW() - INTERVAL '5 minutes'
    `).bind(endpoint).first();

    if (totalRequests.count > 0) {
      const errorRate = errorRequests.count / totalRequests.count;

      if (errorRate > this.alertThresholds.errorRate) {
        await this.sendAlert({
          type: 'HIGH_ERROR_RATE',
          severity: 'MEDIUM',
          endpoint,
          errorRate: errorRate.toFixed(4),
          totalRequests: totalRequests.count,
          errorRequests: errorRequests.count,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Validate request for security issues
  validateRequest(request) {
    const issues = [];
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    const referer = request.headers.get('Referer') || '';

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempt
      /javascript:/i,  // JavaScript protocol
      /data:/i,  // Data protocol
      /vbscript:/i,  // VBScript protocol
      /file:/i,  // File protocol
      /ftp:/i,  // FTP protocol
    ];

    // Check URL
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url.pathname + url.search)) {
        issues.push(`Suspicious pattern in URL: ${pattern}`);
      }
    }

    // Check headers
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent) || pattern.test(referer)) {
        issues.push(`Suspicious pattern in headers: ${pattern}`);
      }
    }

    // Check for oversized requests
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      issues.push('Oversized request detected');
    }

    // Check for missing required headers
    if (!userAgent || userAgent.length < 10) {
      issues.push('Missing or suspicious User-Agent');
    }

    return issues;
  }

  // Send security alert
  async sendAlert(alertData) {
    console.error('SECURITY ALERT:', JSON.stringify(alertData, null, 2));

    // Store alert in KV for analysis
    const alertKey = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.env.ALERTS.put(alertKey, JSON.stringify(alertData), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    // Send to external monitoring (if configured)
    if (this.env.WEBHOOK_URL) {
      try {
        await fetch(this.env.WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Alert-Type': alertData.type,
            'X-Alert-Severity': alertData.severity
          },
          body: JSON.stringify({
            ...alertData,
            service: 'sdlc-sdk-api',
            environment: this.env.ENVIRONMENT || 'unknown',
            deployment: 'cloudflare-workers'
          })
        });
      } catch (error) {
        console.error('Failed to send alert webhook:', error);
      }
    }

    // Send email alert (if configured)
    if (this.env.ALERT_EMAIL) {
      // Email sending implementation would go here
      console.log('Email alert would be sent to:', this.env.ALERT_EMAIL);
    }
  }

  // Generate security report
  async generateSecurityReport(timeRange = '24h') {
    const report = {
      generated: new Date().toISOString(),
      timeRange,
      metrics: {},
      alerts: [],
      recommendations: []
    };

    // Get security metrics
    report.metrics.totalRequests = await this.getTotalRequests(timeRange);
    report.metrics.authFailures = await this.getAuthFailures(timeRange);
    report.metrics.rateLimitHits = await this.getRateLimitHits(timeRange);
    report.metrics.suspiciousActivity = await this.getSuspiciousActivity(timeRange);
    report.metrics.errorRate = await this.getErrorRate(timeRange);

    // Get recent alerts
    report.alerts = await this.getRecentAlerts(timeRange);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  // Helper methods for metrics
  async getTotalRequests(timeRange) {
    // Implementation for getting total requests
    return 0;
  }

  async getAuthFailures(timeRange) {
    // Implementation for getting auth failures
    return 0;
  }

  async getRateLimitHits(timeRange) {
    // Implementation for getting rate limit hits
    return 0;
  }

  async getSuspiciousActivity(timeRange) {
    // Implementation for getting suspicious activity
    return 0;
  }

  async getErrorRate(timeRange) {
    // Implementation for getting error rate
    return 0;
  }

  async getRecentAlerts(timeRange) {
    // Implementation for getting recent alerts
    return [];
  }

  generateRecommendations(report) {
    const recommendations = [];

    if (report.metrics.authFailures > 10) {
      recommendations.push('High number of authentication failures detected. Review IP blocking policies.');
    }

    if (report.metrics.suspiciousActivity > 5) {
      recommendations.push('Suspicious activity detected. Consider implementing additional security measures.');
    }

    if (report.metrics.errorRate > 0.05) {
      recommendations.push('High error rate detected. Review application logs for issues.');
    }

    if (report.alerts.filter(a => a.severity === 'CRITICAL').length > 0) {
      recommendations.push('Critical security alerts detected. Immediate investigation required.');
    }

    return recommendations;
  }
}

// Request logging middleware
export function logSecurityEvent(request, event, data = {}) {
  return {
    clientIP: request.headers.get('CF-Connecting-IP') || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
    referer: request.headers.get('Referer') || 'unknown',
    endpoint: new URL(request.url).pathname,
    method: request.method,
    event,
    data,
    timestamp: new Date().toISOString(),
    cfRay: request.headers.get('CF-Ray') || 'unknown',
    country: request.cf?.country || 'unknown',
    colo: request.cf?.colo || 'unknown'
  };
}

// Rate limiting with security monitoring
export async function securityRateLimit(request, env, limit = 100, window = 60) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `security_rate_limit_${clientIP}`;

  // Get current count
  const current = await env.RATE_LIMIT.get(key) || '0';
  const count = parseInt(current);

  if (count >= limit) {
    // Log rate limit violation
    const securityMonitor = new SecurityMonitor(env);
    await securityMonitor.monitorRateLimit(clientIP, new URL(request.url).pathname);

    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + (window * 1000)
    };
  }

  // Increment counter
  await env.RATE_LIMIT.put(key, (count + 1).toString(), {
    expirationTtl: window
  });

  return {
    allowed: true,
    remaining: limit - count - 1,
    resetTime: Date.now() + (window * 1000)
  };
}
