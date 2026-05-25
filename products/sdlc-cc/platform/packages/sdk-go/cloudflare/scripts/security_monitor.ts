import { Request, Response } from '@cloudflare/workers-types';

// Security monitoring and alerting system
export class SecurityMonitor {
  private env: Record<string, unknown>;
  private alerts: Array<SecurityAlert> = [];

  constructor(env: Record<string, unknown>) {
    this.env = env;
  }

  // Monitor request for security threats
  async monitorRequest(request: Request, clientIP: string): Promise<SecurityResult> {
    const threats: SecurityThreat[] = [];

    // Check for various security threats
    threats.push(...this.checkSQLInjection(request));
    threats.push(...this.checkXSS(request));
    threats.push(...this.checkCSRF(request));
    threats.push(...this.checkPathTraversal(request));
    threats.push(...this.checkCommandInjection(request));
    threats.push(...this.checkSuspiciousUserAgent(request));
    threats.push(...this.checkRateLimitExceeded(clientIP));
    threats.push(...this.checkGeolocationThreats(request));
    threats.push(...this.checkRequestSize(request));

    // Calculate risk score
    const riskScore = this.calculateRiskScore(threats);

    // Log security events
    await this.logSecurityEvent(request, threats, riskScore, clientIP);

    // Send alerts if necessary
    if (riskScore > 70) {
      await this.sendSecurityAlert(threats, riskScore, clientIP);
    }

    return {
      threats,
      riskScore,
      blocked: riskScore > 90,
      action: this.getRecommendedAction(riskScore),
    };
  }

  // SQL Injection detection
  private checkSQLInjection(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--|\*\/|\/\*)/, // SQL comments
      /(\bOR\b.*=.*\bOR\b)/i,
      /(\bAND\b.*=.*\bAND\b)/i,
      /('.*OR.*'.*=)/i,
      /(1=1|1 = 1)/,
      /(\bWAITFOR\b.*DELAY\b)/i,
      /(\bBENCHMARK\b|\bSLEEP\b)/i,
    ];

    const url = new URL(request.url);
    const queryString = url.search;
    const body = this.getRequestBody(request);

    const contentToCheck = `${url.pathname} ${queryString} ${body}`;

    for (const pattern of sqlPatterns) {
      if (pattern.test(contentToCheck)) {
        threats.push({
          type: 'SQL_INJECTION',
          severity: 'HIGH',
          pattern: pattern.source,
          matched: contentToCheck.match(pattern)?.[0] || '',
          confidence: 0.9,
        });
      }
    }

    return threats;
  }

  // XSS detection
  private checkXSS(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onclick, onload, etc.
      /<img[^>]*src[^>]*javascript:/gi,
      /<\s*script[^>]*src[^>]*javascript:/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /@import/gi,
      /<link[^>]*href[^>]*javascript:/gi,
    ];

    const url = new URL(request.url);
    const queryString = url.search;
    const body = this.getRequestBody(request);
    const headers = this.getRequestHeaders(request);

    const contentToCheck = `${url.pathname} ${queryString} ${body} ${headers}`;

    for (const pattern of xssPatterns) {
      if (pattern.test(contentToCheck)) {
        threats.push({
          type: 'XSS',
          severity: 'HIGH',
          pattern: pattern.source,
          matched: contentToCheck.match(pattern)?.[0] || '',
          confidence: 0.85,
        });
      }
    }

    return threats;
  }

  // CSRF detection
  private checkCSRF(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // Check for state-changing methods without proper CSRF protection
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    if (stateChangingMethods.includes(request.method)) {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const cfRay = request.headers.get('cf-ray');

      const url = new URL(request.url);
      const allowedOrigins = this.env.CORS_ORIGINS?.split(',') || [];

      // Check if request has proper origin
      if (!origin && !referer) {
        threats.push({
          type: 'CSRF',
          severity: 'MEDIUM',
          pattern: 'missing_origin_referer',
          matched: '',
          confidence: 0.6,
        });
      }

      // Check if origin is allowed
      if (origin && !allowedOrigins.includes(origin)) {
        threats.push({
          type: 'CSRF',
          severity: 'MEDIUM',
          pattern: 'unauthorized_origin',
          matched: origin,
          confidence: 0.8,
        });
      }
    }

    return threats;
  }

  // Path traversal detection
  private checkPathTraversal(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi, // URL encoded ../
      /%2e%2e%5c/gi, // URL encoded ..\
      /\.\.%2f/gi,
      /\.\.%5c/gi,
      /\/etc\/passwd/i,
      /\/windows\/system32/i,
      /\\windows\\system32/i,
    ];

    const url = new URL(request.url);
    const pathname = url.pathname;
    const queryString = url.search;

    const contentToCheck = `${pathname} ${queryString}`;

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(contentToCheck)) {
        threats.push({
          type: 'PATH_TRAVERSAL',
          severity: 'HIGH',
          pattern: pattern.source,
          matched: contentToCheck.match(pattern)?.[0] || '',
          confidence: 0.9,
        });
      }
    }

    return threats;
  }

  // Command injection detection
  private checkCommandInjection(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const commandPatterns = [
      /;\s*(rm|del|format|fdisk|mkfs)/gi,
      /\|\s*(nc|netcat|telnet|ssh)/gi,
      /&&\s*(rm|del|format)/gi,
      /\|\|\s*(rm|del|format)/gi,
      /`[^`]*`/g, // Backticks
      /\$\(.*?\)/g, // Command substitution
      /<\?php.*?\?>/gi, // PHP tags
      /<%\s*.*?\s*%>/g, // ASP tags
    ];

    const url = new URL(request.url);
    const queryString = url.search;
    const body = this.getRequestBody(request);

    const contentToCheck = `${url.pathname} ${queryString} ${body}`;

    for (const pattern of commandPatterns) {
      if (pattern.test(contentToCheck)) {
        threats.push({
          type: 'COMMAND_INJECTION',
          severity: 'CRITICAL',
          pattern: pattern.source,
          matched: contentToCheck.match(pattern)?.[0] || '',
          confidence: 0.95,
        });
      }
    }

    return threats;
  }

  // Suspicious user agent detection
  private checkSuspiciousUserAgent(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const userAgent = request.headers.get('user-agent') || '';

    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /metasploit/i,
      /python-requests/i,
      /curl/i,
      /wget/i,
      /scanner/i,
      /bot/i,
      /crawler/i,
      /spider/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        threats.push({
          type: 'SUSPICIOUS_USER_AGENT',
          severity: 'MEDIUM',
          pattern: pattern.source,
          matched: userAgent,
          confidence: 0.7,
        });
      }
    }

    return threats;
  }

  // Rate limit exceeded detection
  private checkRateLimitExceeded(clientIP: string): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // This would integrate with your rate limiting system
    // For now, we'll use a placeholder
    const rateLimitKey = `rate_limit:${clientIP}`;

    // Check if rate limit exceeded (this would be actual implementation)
    const isRateLimited = false; // Placeholder

    if (isRateLimited) {
      threats.push({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        pattern: 'rate_limit',
        matched: rateLimitKey,
        confidence: 0.8,
      });
    }

    return threats;
  }

  // Geolocation threat detection
  private checkGeolocationThreats(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    const country = request.cf?.country || '';
    const asn = request.cf?.asn || '';

    // Known malicious ASNs or countries
    const maliciousCountries = ['']; // Add as needed
    const maliciousASNs = ['']; // Add as needed

    if (maliciousCountries.includes(country)) {
      threats.push({
        type: 'GEOLocation_THREAT',
        severity: 'HIGH',
        pattern: 'malicious_country',
        matched: country,
        confidence: 0.6,
      });
    }

    if (maliciousASNs.includes(asn.toString())) {
      threats.push({
        type: 'GEOLocation_THREAT',
        severity: 'HIGH',
        pattern: 'malicious_asn',
        matched: asn.toString(),
        confidence: 0.7,
      });
    }

    return threats;
  }

  // Request size validation
  private checkRequestSize(request: Request): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    const contentLength = request.headers.get('content-length');
    const maxSize = parseInt(this.env.MAX_REQUEST_SIZE) || 10485760; // 10MB default

    if (contentLength && parseInt(contentLength) > maxSize) {
      threats.push({
        type: 'OVERSIZED_REQUEST',
        severity: 'MEDIUM',
        pattern: 'oversized_request',
        matched: contentLength,
        confidence: 0.9,
      });
    }

    return threats;
  }

  // Calculate risk score based on threats
  private calculateRiskScore(threats: SecurityThreat[]): number {
    if (threats.length === 0) return 0;

    let score = 0;
    const severityWeights = {
      'CRITICAL': 25,
      'HIGH': 15,
      'MEDIUM': 8,
      'LOW': 3,
    };

    for (const threat of threats) {
      const weight = severityWeights[threat.severity] || 0;
      score += weight * threat.confidence;
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  // Get recommended action based on risk score
  private getRecommendedAction(riskScore: number): string {
    if (riskScore >= 90) return 'BLOCK';
    if (riskScore >= 70) return 'CHALLENGE';
    if (riskScore >= 50) return 'MONITOR';
    return 'ALLOW';
  }

  // Log security events
  private async logSecurityEvent(
    request: Request,
    threats: SecurityThreat[],
    riskScore: number,
    clientIP: string
  ): Promise<void> {
    const logData = {
      timestamp: new Date().toISOString(),
      clientIP,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      threats,
      riskScore,
      action: this.getRecommendedAction(riskScore),
      cfRay: request.headers.get('cf-ray'),
    };

    // Log to analytics
    await this.env.ANALYTICS.writeDataPoint({
      blobs: [
        'SECURITY_EVENT',
        clientIP,
        request.method,
        request.url,
        JSON.stringify(threats),
        this.getRecommendedAction(riskScore),
      ],
      doubles: [riskScore],
      indexes: [logData.timestamp],
    });

    // Store detailed security event
    await this.env.SDK_CONFIG.put(
      `security_event:${Date.now()}:${crypto.randomUUID()}`,
      JSON.stringify(logData),
      { expirationTtl: 86400 * 30 } // 30 days
    );
  }

  // Send security alert
  private async sendSecurityAlert(
    threats: SecurityThreat[],
    riskScore: number,
    clientIP: string
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      clientIP,
      riskScore,
      threats,
      status: 'ACTIVE',
      notified: false,
    };

    // Store alert
    await this.env.SDK_CONFIG.put(
      `security_alert:${alert.id}`,
      JSON.stringify(alert),
      { expirationTtl: 86400 * 7 } // 7 days
    );

    // Send notification (this would integrate with your notification system)
    await this.sendNotification(alert);
  }

  // Send notification
  private async sendNotification(alert: SecurityAlert): Promise<void> {
    // Implementation would depend on your notification system
    console.log('SECURITY ALERT:', {
      id: alert.id,
      riskScore: alert.riskScore,
      clientIP: alert.clientIP,
      threats: alert.threats.map(t => t.type),
    });
  }

  // Helper methods
  private getRequestBody(request: Request): string {
    // This would need to be implemented based on your request handling
    return '';
  }

  private getRequestHeaders(request: Request): string {
    const headers: string[] = [];
    for (const [key, value] of request.headers.entries()) {
      headers.push(`${key}: ${value}`);
    }
    return headers.join(' ');
  }
}

// Type definitions
interface SecurityThreat {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pattern: string;
  matched: string;
  confidence: number;
}

interface SecurityResult {
  threats: SecurityThreat[];
  riskScore: number;
  blocked: boolean;
  action: 'BLOCK' | 'CHALLENGE' | 'MONITOR' | 'ALLOW';
}

interface SecurityAlert {
  id: string;
  timestamp: string;
  clientIP: string;
  riskScore: number;
  threats: SecurityThreat[];
  status: 'ACTIVE' | 'RESOLVED' | 'IGNORED';
  notified: boolean;
}

// Export for use in main application
export { SecurityThreat, SecurityResult, SecurityAlert };
