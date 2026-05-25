/**
 * Questro Security Testing Engine
 * Comprehensive security vulnerability assessment with AI-powered analysis
 */

class SecurityTestEngine {
  constructor() {
    this.testSuites = new Map();
    this.testResults = new Map();
    this.vulnerabilityDatabase = new Map();
    this.complianceFrameworks = new Map();
    this.scanQueue = [];
    this.isScanning = false;
  }

  /**
   * Create a security test suite
   */
  createTestSuite(name, config = {}) {
    const testSuite = {
      id: this.generateId(),
      name,
      description: config.description || '',
      type: config.type || 'comprehensive', // comprehensive, api, web, mobile, infrastructure
      target: {
        urls: config.target?.urls || [],
        apis: config.target?.apis || [],
        applications: config.target?.applications || [],
        infrastructure: config.target?.infrastructure || []
      },
      scope: {
        includeSubdomains: config.scope?.includeSubdomains || false,
        maxDepth: config.scope?.maxDepth || 3,
        excludePaths: config.scope?.excludePaths || [],
        rateLimit: config.scope?.rateLimit || 10, // requests per second
        timeout: config.scope?.timeout || 30000 // 30 seconds
      },
      tests: {
        authentication: config.tests?.authentication !== false,
        authorization: config.tests?.authorization !== false,
        dataValidation: config.tests?.dataValidation !== false,
        sessionManagement: config.tests?.sessionManagement !== false,
        cryptography: config.tests?.cryptography !== false,
        errorHandling: config.tests?.errorHandling !== false,
        logging: config.tests?.logging !== false,
        infrastructure: config.tests?.infrastructure || false,
        dependencies: config.tests?.dependencies || false
      },
      compliance: {
        frameworks: config.compliance?.frameworks || [], // OWASP, NIST, ISO27001, GDPR, HIPAA
        customRules: config.compliance?.customRules || []
      },
      severity: {
        minimum: config.severity?.minimum || 'low', // low, medium, high, critical
        falsePositives: config.severity?.falsePositives || 'conservative'
      },
      reporting: {
        includeRemediation: config.reporting?.includeRemediation !== false,
        includeEvidence: config.reporting?.includeEvidence !== false,
        format: config.reporting?.format || 'detailed' // summary, detailed, technical
      },
      schedule: config.schedule || null,
      notifications: config.notifications || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.testSuites.set(testSuite.id, testSuite);
    return testSuite;
  }

  /**
   * Execute comprehensive security test
   */
  async executeSecurityTest(testSuiteId, options = {}) {
    const testSuite = this.testSuites.get(testSuiteId);
    if (!testSuite) {
      throw new Error('Test suite not found');
    }

    if (this.isScanning) {
      throw new Error('Another security scan is currently running');
    }

    this.isScanning = true;

    try {
      console.log(`🔒 Starting security test: ${testSuite.name}`);
      console.log(`🎯 Target URLs: ${testSuite.target.urls.length}`);
      console.log(`🛡️  Test categories: ${Object.keys(testSuite.tests).filter(key => testSuite.tests[key]).join(', ')}`);

      const results = {
        id: this.generateId(),
        testSuiteId: testSuite.id,
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'running',
        summary: {
          totalVulnerabilities: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          riskScore: 0,
          coverage: {
            urls: 0,
            endpoints: 0,
            parameters: 0,
            tests: 0
          }
        },
        vulnerabilities: [],
        compliance: {
          frameworks: {},
          overallScore: 0,
          gaps: []
        },
        recommendations: [],
        evidence: new Map(),
        scanProgress: 0
      };

      // Execute different types of security tests
      await this.runAuthenticationTests(testSuite, results);
      await this.runAuthorizationTests(testSuite, results);
      await this.runDataValidationTests(testSuite, results);
      await this.runSessionManagementTests(testSuite, results);
      await this.runCryptographyTests(testSuite, results);
      await this.runErrorHandlingTests(testSuite, results);
      await this.runInfrastructureTests(testSuite, results);
      await this.runDependencyTests(testSuite, results);
      await this.runComplianceTests(testSuite, results);

      // Generate AI-powered analysis
      const aiAnalysis = await this.performAIAnalysis(results);
      results.aiAnalysis = aiAnalysis;

      // Generate prioritized recommendations
      results.recommendations = await this.generateRecommendations(results, testSuite);

      // Calculate final metrics
      this.calculateFinalMetrics(results);

      console.log(`✅ Security test completed: ${testSuite.name}`);
      console.log(`🚨 Vulnerabilities found: ${results.summary.totalVulnerabilities}`);
      console.log(`📊 Risk Score: ${results.summary.riskScore}/100`);

      results.endTime = new Date().toISOString();
      results.status = 'completed';
      this.testResults.set(results.id, results);

      return results;

    } catch (error) {
      console.error(`❌ Security test failed: ${error.message}`);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Run authentication security tests
   */
  async runAuthenticationTests(testSuite, results) {
    if (!testSuite.tests.authentication) return;

    console.log(`🔑 Running authentication tests...`);

    const authTests = [
      {
        name: 'Weak Password Policy',
        test: () => this.testWeakPasswordPolicy(testSuite.target),
        severity: 'medium',
        category: 'authentication'
      },
      {
        name: 'Missing Rate Limiting',
        test: () => this.testRateLimiting(testSuite.target),
        severity: 'high',
        category: 'authentication'
      },
      {
        name: 'Insecure Login Endpoints',
        test: () => this.testLoginSecurity(testSuite.target),
        severity: 'critical',
        category: 'authentication'
      },
      {
        name: 'Account Enumeration',
        test: () => this.testAccountEnumeration(testSuite.target),
        severity: 'medium',
        category: 'authentication'
      },
      {
        name: 'Multi-Factor Authentication',
        test: () => this.testMFAImplementation(testSuite.target),
        severity: 'high',
        category: 'authentication'
      }
    ];

    for (const authTest of authTests) {
      try {
        const vulnerability = await authTest.test();
        if (vulnerability) {
          vulnerability.testType = 'authentication';
          vulnerability.testName = authTest.name;
          vulnerability.severity = authTest.severity;
          vulnerability.category = authTest.category;
          vulnerability.discoveredAt = new Date().toISOString();

          results.vulnerabilities.push(vulnerability);
          this.updateVulnerabilityCounts(results, vulnerability.severity);
        }
      } catch (error) {
        console.warn(`Authentication test failed: ${authTest.name} - ${error.message}`);
      }
    }
  }

  /**
   * Run authorization security tests
   */
  async runAuthorizationTests(testSuite, results) {
    if (!testSuite.tests.authorization) return;

    console.log(`🛡️ Running authorization tests...`);

    const authzTests = [
      {
        name: 'Insecure Direct Object Reference (IDOR)',
        test: () => this.testIDOR(testSuite.target),
        severity: 'critical',
        category: 'authorization'
      },
      {
        name: 'Privilege Escalation',
        test: () => this.testPrivilegeEscalation(testSuite.target),
        severity: 'critical',
        category: 'authorization'
      },
      {
        name: 'Broken Access Control',
        test: () => this.testBrokenAccessControl(testSuite.target),
        severity: 'high',
        category: 'authorization'
      },
      {
        name: 'Missing Authorization Headers',
        test: () => this.testAuthorizationHeaders(testSuite.target),
        severity: 'medium',
        category: 'authorization'
      }
    ];

    for (const authzTest of authzTests) {
      try {
        const vulnerability = await authzTest.test();
        if (vulnerability) {
          vulnerability.testType = 'authorization';
          vulnerability.testName = authzTest.name;
          vulnerability.severity = authzTest.severity;
          vulnerability.category = authzTest.category;
          vulnerability.discoveredAt = new Date().toISOString();

          results.vulnerabilities.push(vulnerability);
          this.updateVulnerabilityCounts(results, vulnerability.severity);
        }
      } catch (error) {
        console.warn(`Authorization test failed: ${authzTest.name} - ${error.message}`);
      }
    }
  }

  /**
   * Run data validation security tests
   */
  async runDataValidationTests(testSuite, results) {
    if (!testSuite.tests.dataValidation) return;

    console.log(`✅ Running data validation tests...`);

    const dataTests = [
      {
        name: 'SQL Injection',
        test: () => this.testSQLInjection(testSuite.target),
        severity: 'critical',
        category: 'injection'
      },
      {
        name: 'Cross-Site Scripting (XSS)',
        test: () => this.testXSS(testSuite.target),
        severity: 'high',
        category: 'xss'
      },
      {
        name: 'NoSQL Injection',
        test: () => this.testNoSQLInjection(testSuite.target),
        severity: 'high',
        category: 'injection'
      },
      {
        name: 'Command Injection',
        test: () => this.testCommandInjection(testSuite.target),
        severity: 'critical',
        category: 'injection'
      },
      {
        name: 'XML External Entity (XXE)',
        test: () => this.testXXE(testSuite.target),
        severity: 'high',
        category: 'injection'
      },
      {
        name: 'Server-Side Template Injection',
        test: () => this.testSSTI(testSuite.target),
        severity: 'critical',
        category: 'injection'
      }
    ];

    for (const dataTest of dataTests) {
      try {
        const vulnerability = await dataTest.test();
        if (vulnerability) {
          vulnerability.testType = 'dataValidation';
          vulnerability.testName = dataTest.name;
          vulnerability.severity = dataTest.severity;
          vulnerability.category = dataTest.category;
          vulnerability.discoveredAt = new Date().toISOString();

          results.vulnerabilities.push(vulnerability);
          this.updateVulnerabilityCounts(results, vulnerability.severity);
        }
      } catch (error) {
        console.warn(`Data validation test failed: ${dataTest.name} - ${error.message}`);
      }
    }
  }

  /**
   * Test SQL Injection vulnerabilities
   */
  async testSQLInjection(target) {
    const payloads = [
      "' OR '1'='1",
      "' UNION SELECT NULL--",
      "'; DROP TABLE users;--",
      "' AND 1=CONVERT(int, (SELECT @@version))--",
      "1' AND (SELECT COUNT(*) FROM information_schema.tables)>0--"
    ];

    const vulnerableEndpoints = [];

    for (const url of target.urls) {
      for (const payload of payloads) {
        try {
          const testUrl = this.injectPayload(url, payload);
          const response = await this.makeRequest(testUrl, { timeout: 10000 });

          if (this.detectSQLError(response.body)) {
            vulnerableEndpoints.push({
              url: testUrl,
              payload: payload,
              response: response.status,
              evidence: this.extractSQLError(response.body)
            });
          }
        } catch (error) {
          // Some payloads might cause server errors, which can indicate vulnerability
          if (error.message.includes('500') || error.message.includes('error')) {
            vulnerableEndpoints.push({
              url: this.injectPayload(url, payload),
              payload: payload,
              error: error.message
            });
          }
        }
      }
    }

    if (vulnerableEndpoints.length > 0) {
      return {
        vulnerability: 'SQL Injection',
        description: 'Application is vulnerable to SQL injection attacks',
        severity: 'critical',
        cvssScore: 9.8,
        affectedEndpoints: vulnerableEndpoints,
        remediation: {
          description: 'Use parameterized queries/prepared statements and input validation',
          codeExample: `// Vulnerable code
const query = "SELECT * FROM users WHERE id = " + userInput;

// Secure code
const query = "SELECT * FROM users WHERE id = ?";
const result = db.query(query, [userInput]);`,
          references: [
            'https://owasp.org/www-community/attacks/SQL_Injection',
            'https://portswigger.net/web-security/sql-injection'
          ]
        },
        impact: 'Complete database compromise, data theft, and potential system takeover'
      };
    }

    return null;
  }

  /**
   * Test Cross-Site Scripting (XSS)
   */
  async testXSS(target) {
    const payloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '\"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>"
    ];

    const vulnerableEndpoints = [];

    for (const url of target.urls) {
      for (const payload of payloads) {
        try {
          const testUrl = this.injectPayload(url, payload);
          const response = await this.makeRequest(testUrl, { timeout: 10000 });

          if (response.body.includes(payload) || this.detectXSSInResponse(response.body, payload)) {
            vulnerableEndpoints.push({
              url: testUrl,
              payload: payload,
              reflected: response.body.includes(payload),
              response: response.status
            });
          }
        } catch (error) {
          // Log error but continue testing
        }
      }
    }

    if (vulnerableEndpoints.length > 0) {
      return {
        vulnerability: 'Cross-Site Scripting (XSS)',
        description: 'Application is vulnerable to XSS attacks',
        severity: 'high',
        cvssScore: 7.5,
        affectedEndpoints: vulnerableEndpoints,
        remediation: {
          description: 'Implement proper input validation, output encoding, and use Content Security Policy',
          codeExample: `// Input validation
function sanitizeInput(input) {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// Output encoding
function encodeForHTML(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
}`,
          references: [
            'https://owasp.org/www-community/attacks/xss/',
            'https://portswigger.net/web-security/cross-site-scripting'
          ]
        },
        impact: 'Session hijacking, data theft, malware delivery, and unauthorized actions'
      };
    }

    return null;
  }

  /**
   * Test authentication security
   */
  async testLoginSecurity(target) {
    const loginTests = [
      {
        url: this.findLoginEndpoint(target.urls),
        test: 'brute_force',
        description: 'Testing for brute force protection'
      },
      {
        url: this.findLoginEndpoint(target.urls),
        test: 'credential_stuffing',
        description: 'Testing for credential stuffing protection'
      }
    ];

    for (const loginTest of loginTests) {
      if (!loginTest.url) continue;

      try {
        const result = await this.performLoginTest(loginTest);
        if (result.vulnerable) {
          return {
            vulnerability: 'Insecure Login Implementation',
            description: result.description,
            severity: 'critical',
            cvssScore: 8.5,
            affectedEndpoints: [loginTest.url],
            remediation: {
              description: 'Implement account lockout, rate limiting, and multi-factor authentication',
              recommendations: [
                'Implement account lockout after 5 failed attempts',
                'Add CAPTCHA after multiple failed attempts',
                'Implement rate limiting on login endpoints',
                'Require multi-factor authentication',
                'Log all failed login attempts'
              ]
            },
            impact: 'Account compromise, unauthorized access, and potential data breach'
          };
        }
      } catch (error) {
        console.warn(`Login security test failed: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting(target) {
    const testUrl = target.urls[0]; // Test first URL
    if (!testUrl) return null;

    const requests = [];
    const startTime = Date.now();

    // Make rapid requests to test rate limiting
    for (let i = 0; i < 50; i++) {
      try {
        const response = await this.makeRequest(testUrl, { timeout: 5000 });
        requests.push({
          timestamp: Date.now(),
          status: response.status,
          responseTime: Date.now() - startTime
        });
      } catch (error) {
        requests.push({
          timestamp: Date.now(),
          error: error.message,
          responseTime: Date.now() - startTime
        });
      }
    }

    // Analyze if rate limiting is implemented
    const successRequests = requests.filter(r => r.status && r.status < 429);
    const rateLimitHeaders = requests.some(r => r.headers && r.headers['x-ratelimit-limit']);

    if (successRequests.length > 30 && !rateLimitHeaders) {
      return {
        vulnerability: 'Missing Rate Limiting',
        description: 'API endpoints lack rate limiting protection',
        severity: 'high',
        cvssScore: 7.0,
        affectedEndpoints: [testUrl],
        evidence: {
          requestsSent: requests.length,
          successfulRequests: successRequests.length,
          timeSpan: Date.now() - startTime
        },
        remediation: {
          description: 'Implement rate limiting on all API endpoints',
          codeExample: `// Express.js rate limiting example
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);`,
          recommendations: [
            'Implement different rate limits for different endpoint types',
            'Use sliding window counters for more accurate rate limiting',
            'Implement IP-based and user-based rate limiting',
            'Add rate limit headers to responses'
          ]
        },
        impact: 'API abuse, denial of service, and resource exhaustion'
      };
    }

    return null;
  }

  /**
   * Run compliance tests
   */
  async runComplianceTests(testSuite, results) {
    if (testSuite.compliance.frameworks.length === 0) return;

    console.log(`📋 Running compliance tests for: ${testSuite.compliance.frameworks.join(', ')}`);

    for (const framework of testSuite.compliance.frameworks) {
      const complianceResult = await this.testComplianceFramework(framework, testSuite, results);
      results.compliance.frameworks[framework] = complianceResult;
    }

    // Calculate overall compliance score
    const frameworkScores = Object.values(results.compliance.frameworks).map(f => f.score);
    results.compliance.overallScore = frameworkScores.length > 0
      ? frameworkScores.reduce((a, b) => a + b, 0) / frameworkScores.length
      : 0;

    // Identify compliance gaps
    results.compliance.gaps = this.identifyComplianceGaps(results.compliance.frameworks);
  }

  /**
   * Test compliance with specific framework
   */
  async testComplianceFramework(framework, testSuite, results) {
    const frameworkTests = {
      OWASP: () => this.testOWASPCompliance(results),
      NIST: () => this.testNISTCompliance(results),
      ISO27001: () => this.testISO27001Compliance(results),
      GDPR: () => this.testGDPRCompliance(results),
      HIPAA: () => this.testHIPAACompliance(results)
    };

    const testFunction = frameworkTests[framework];
    if (!testFunction) {
      return { score: 0, status: 'not_applicable', requirements: [] };
    }

    return await testFunction();
  }

  /**
   * Test OWASP compliance
   */
  async testOWASPCompliance(results) {
    const owaspRequirements = [
      {
        id: 'A01_2021',
        name: 'Broken Access Control',
        status: this.checkAccessControlCompliance(results),
        description: 'Verify proper access control mechanisms'
      },
      {
        id: 'A02_2021',
        name: 'Cryptographic Failures',
        status: this.checkCryptographyCompliance(results),
        description: 'Verify proper encryption and data protection'
      },
      {
        id: 'A03_2021',
        name: 'Injection',
        status: this.checkInjectionCompliance(results),
        description: 'Verify protection against injection attacks'
      },
      {
        id: 'A04_2021',
        name: 'Insecure Design',
        status: this.checkSecureDesignCompliance(results),
        description: 'Verify secure design principles'
      },
      {
        id: 'A05_2021',
        name: 'Security Misconfiguration',
        status: this.checkSecurityConfigCompliance(results),
        description: 'Verify secure configuration'
      }
    ];

    const passedRequirements = owaspRequirements.filter(req => req.status === 'pass').length;
    const score = (passedRequirements / owaspRequirements.length) * 100;

    return {
      framework: 'OWASP Top 10 2021',
      score,
      status: score >= 80 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
      requirements: owaspRequirements,
      recommendations: this.generateOWASPRecommendations(owaspRequirements)
    };
  }

  /**
   * Perform AI-powered security analysis
   */
  async performAIAnalysis(results) {
    const analysis = {
      riskAssessment: {
        overallRisk: 'medium',
        criticalPaths: [],
        attackSurface: this.calculateAttackSurface(results),
        exploitationLikelihood: 'medium'
      },
      patterns: {
        commonVulnerabilities: this.identifyCommonPatterns(results),
        securityPosture: this.assessSecurityPosture(results),
        trends: this.analyzeSecurityTrends(results)
      },
      prioritization: this.prioritizeVulnerabilities(results),
      predictiveAnalysis: {
        futureRisks: this.predictFutureRisks(results),
        emergingThreats: this.identifyEmergingThreats(results),
        complianceEvolution: this.predictComplianceChanges(results)
      }
    };

    return analysis;
  }

  /**
   * Generate prioritized recommendations
   */
  async generateRecommendations(results, testSuite) {
    const recommendations = [];
    const criticalVulns = results.vulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = results.vulnerabilities.filter(v => v.severity === 'high');

    // Critical fixes
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Address Critical Security Vulnerabilities',
        description: `Found ${criticalVulns.length} critical vulnerabilities requiring immediate attention`,
        impact: 'Prevents potential system compromise and data breaches',
        effort: 'medium',
        timeframe: 'Immediate (within 24 hours)',
        vulnerabilities: criticalVulns.map(v => v.vulnerability),
        steps: [
          'Immediately patch or mitigate critical vulnerabilities',
          'Implement temporary security controls if immediate patching is not possible',
          'Monitor for suspicious activity targeting these vulnerabilities',
          'Communicate with stakeholders about security risks'
        ]
      });
    }

    // High priority fixes
    if (highVulns.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Fix High-Severity Security Issues',
        description: `Found ${highVulns.length} high-severity vulnerabilities`,
        impact: 'Reduces attack surface and prevents security incidents',
        effort: 'medium',
        timeframe: 'Within 1 week',
        vulnerabilities: highVulns.map(v => v.vulnerability),
        steps: [
          'Schedule fixes for high-severity vulnerabilities',
          'Implement security testing in CI/CD pipeline',
          'Update security policies and procedures',
          'Train development team on secure coding practices'
        ]
      });
    }

    // Security posture improvements
    recommendations.push({
      priority: 'medium',
      title: 'Improve Overall Security Posture',
      description: 'Implement comprehensive security improvements',
      impact: 'Strengthens defense against future attacks',
      effort: 'high',
      timeframe: 'Within 1 month',
      steps: [
        'Implement Web Application Firewall (WAF)',
        'Enable security headers (HSTS, CSP, X-Frame-Options)',
        'Implement comprehensive logging and monitoring',
        'Regular security assessments and penetration testing',
        'Security awareness training for development team'
      ]
    });

    // Compliance improvements
    if (results.compliance.overallScore < 80) {
      recommendations.push({
        priority: 'medium',
        title: 'Address Compliance Gaps',
        description: `Current compliance score: ${results.compliance.overallScore.toFixed(1)}%`,
        impact: 'Ensures regulatory compliance and avoids penalties',
        effort: 'medium',
        timeframe: 'Within 2 months',
        gaps: results.compliance.gaps,
        steps: [
          'Address identified compliance gaps',
          'Implement required security controls',
          'Document compliance evidence',
          'Schedule regular compliance audits'
        ]
      });
    }

    return recommendations;
  }

  // Helper methods
  generateId() {
    return crypto.randomUUID();
  }

  injectPayload(url, payload) {
    const urlObj = new URL(url);
    urlObj.searchParams.set('test', payload);
    return urlObj.toString();
  }

  async makeRequest(url, options = {}) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Questro Security Scanner/1.0'
      },
      signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
    });

    const body = await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: body
    };
  }

  detectSQLError(body) {
    const sqlErrors = [
      /mysql_fetch_array/i,
      /ora-\d{5}/i,
      /microsoft ole db provider for odbc drivers error/i,
      /odbc.*error/i,
      /sql.*syntax/i,
      /postgresql.*error/i,
      /sqlite.*error/i
    ];

    return sqlErrors.some(error => error.test(body));
  }

  extractSQLError(body) {
    const match = body.match(/(error|exception).*?\./i);
    return match ? match[0] : 'SQL error detected in response';
  }

  detectXSSInResponse(body, payload) {
    return body.includes('<script>') || body.includes('alert(') || body.includes('javascript:');
  }

  findLoginEndpoint(urls) {
    const loginPatterns = ['/login', '/auth', '/signin', '/api/login', '/api/auth'];

    for (const url of urls) {
      for (const pattern of loginPatterns) {
        if (url.includes(pattern)) {
          return url;
        }
      }
    }

    return null;
  }

  updateVulnerabilityCounts(results, severity) {
    results.summary.totalVulnerabilities++;
    results.summary[severity] = (results.summary[severity] || 0) + 1;
  }

  calculateAttackSurface(results) {
    const uniqueEndpoints = new Set();
    const uniqueVulnerabilities = new Set();

    results.vulnerabilities.forEach(vuln => {
      vuln.affectedEndpoints?.forEach(endpoint => {
        uniqueEndpoints.add(endpoint.url);
      });
      uniqueVulnerabilities.add(vuln.vulnerability);
    });

    return {
      endpoints: uniqueEndpoints.size,
      vulnerabilityTypes: uniqueVulnerabilities.size,
      riskLevel: uniqueEndpoints.size > 10 ? 'high' : uniqueEndpoints.size > 5 ? 'medium' : 'low'
    };
  }

  identifyCommonPatterns(results) {
    const patterns = {};

    results.vulnerabilities.forEach(vuln => {
      if (!patterns[vuln.category]) {
        patterns[vuln.category] = {
          count: 0,
          severity: [],
          examples: []
        };
      }

      patterns[vuln.category].count++;
      patterns[vuln.category].severity.push(vuln.severity);
      patterns[vuln.category].examples.push(vuln.vulnerability);
    });

    return patterns;
  }

  assessSecurityPosture(results) {
    const criticalCount = results.summary.critical || 0;
    const highCount = results.summary.high || 0;
    const totalVulns = results.summary.totalVulnerabilities;

    if (criticalCount > 0) return 'critical';
    if (highCount > 5) return 'poor';
    if (highCount > 0 || totalVulns > 20) return 'fair';
    if (totalVulns > 5) return 'good';
    return 'excellent';
  }

  analyzeSecurityTrends(results) {
    // Simplified trend analysis - in real implementation would compare with historical data
    return {
      vulnerabilityTrend: 'stable',
      securityImprovement: 'needed',
      riskEvolution: 'increasing'
    };
  }

  prioritizeVulnerabilities(results) {
    return results.vulnerabilities
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 10); // Top 10 prioritized vulnerabilities
  }

  predictFutureRisks(results) {
    const risks = [];

    if (results.summary.critical > 0) {
      risks.push({
        risk: 'Data Breach',
        probability: 'high',
        impact: 'severe',
        timeline: 'immediate'
      });
    }

    if (results.summary.high > 3) {
      risks.push({
        risk: 'Service Disruption',
        probability: 'medium',
        impact: 'moderate',
        timeline: '30-60 days'
      });
    }

    return risks;
  }

  identifyEmergingThreats(results) {
    // AI-powered emerging threat identification
    const threats = [];

    if (this.detectAIAttackPatterns(results)) {
      threats.push({
        threat: 'AI-Powered Attacks',
        description: 'Systems may be vulnerable to AI-driven attack patterns',
        mitigation: 'Implement AI-based threat detection and response'
      });
    }

    return threats;
  }

  detectAIAttackPatterns(results) {
    // Simplified AI pattern detection
    return results.vulnerabilities.some(vuln =>
      vuln.category === 'injection' || vuln.category === 'authentication'
    );
  }

  predictComplianceChanges(results) {
    return {
      regulatoryChanges: ['Updated data protection regulations expected'],
      frameworkUpdates: ['OWASP Top 10 updates upcoming'],
      industryStandards: ['New security standards emerging']
    };
  }

  checkAccessControlCompliance(results) {
    const accessControlVulns = results.vulnerabilities.filter(v => v.category === 'authorization');
    return accessControlVulns.length === 0 ? 'pass' : 'fail';
  }

  checkCryptographyCompliance(results) {
    const cryptoVulns = results.vulnerabilities.filter(v => v.category === 'cryptography');
    return cryptoVulns.length === 0 ? 'pass' : 'fail';
  }

  checkInjectionCompliance(results) {
    const injectionVulns = results.vulnerabilities.filter(v => v.category === 'injection');
    return injectionVulns.length === 0 ? 'pass' : 'fail';
  }

  checkSecureDesignCompliance(results) {
    // Simplified secure design check
    return results.summary.critical === 0 ? 'pass' : 'fail';
  }

  checkSecurityConfigCompliance(results) {
    const configVulns = results.vulnerabilities.filter(v => v.category === 'configuration');
    return configVulns.length === 0 ? 'pass' : 'fail';
  }

  generateOWASPRecommendations(requirements) {
    const failedReqs = requirements.filter(req => req.status === 'fail');
    return failedReqs.map(req => ({
      requirement: req.name,
      recommendation: `Implement controls to address ${req.name}`,
      priority: 'high'
    }));
  }

  calculateFinalMetrics(results) {
    // Calculate risk score (0-100)
    const severityWeights = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
    let riskScore = 0;

    Object.entries(results.summary).forEach(([severity, count]) => {
      if (severityWeights[severity]) {
        riskScore += count * severityWeights[severity];
      }
    });

    results.summary.riskScore = Math.min(100, riskScore);

    // Calculate coverage
    results.summary.coverage.tests = Object.keys(results.testSuites || {}).length;
  }

  /**
   * Export security test results
   */
  exportResults(testResultId, format = 'json') {
    const results = this.testResults.get(testResultId);
    if (!results) {
      throw new Error('Test results not found');
    }

    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    } else if (format === 'html') {
      return this.generateSecurityReport(results);
    } else if (format === 'pdf') {
      return this.generatePDFReport(results);
    }

    return results;
  }

  generateSecurityReport(results) {
    return `
      <html>
        <head>
          <title>Security Test Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
            .summary { background: #ecf0f1; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .vulnerability { border-left: 4px solid #e74c3c; padding: 15px; margin: 10px 0; background: #fdf2f2; }
            .vulnerability.high { border-color: #e67e22; background: #fef9e7; }
            .vulnerability.medium { border-color: #f39c12; background: #fef5e7; }
            .vulnerability.low { border-color: #27ae60; background: #e8f8f5; }
            .recommendations { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .risk-score { font-size: 48px; font-weight: bold; text-align: center; padding: 20px; }
            .risk-score.critical { color: #e74c3c; }
            .risk-score.high { color: #e67e22; }
            .risk-score.medium { color: #f39c12; }
            .risk-score.low { color: #27ae60; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔒 Security Test Report</h1>
            <p><strong>Test Suite:</strong> ${results.testSuiteId}</p>
            <p><strong>Scan Date:</strong> ${new Date(results.startTime).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${results.endTime ? new Date(results.endTime) - new Date(results.startTime) : 'N/A'}ms</p>
          </div>

          <div class="summary">
            <h2>📊 Executive Summary</h2>
            <div class="risk-score ${this.getRiskLevel(results.summary.riskScore)}">
              Risk Score: ${results.summary.riskScore}/100
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
              <div><strong>Critical:</strong> ${results.summary.critical}</div>
              <div><strong>High:</strong> ${results.summary.high}</div>
              <div><strong>Medium:</strong> ${results.summary.medium}</div>
              <div><strong>Low:</strong> ${results.summary.low}</div>
              <div><strong>Total:</strong> ${results.summary.totalVulnerabilities}</div>
            </div>
          </div>

          <h2>🚨 Vulnerabilities Found</h2>
          ${results.vulnerabilities.map(vuln => `
            <div class="vulnerability ${vuln.severity}">
              <h3>${vuln.vulnerability}</h3>
              <p><strong>Severity:</strong> ${vuln.severity.toUpperCase()}</p>
              <p><strong>CVSS Score:</strong> ${vuln.cvssScore || 'N/A'}</p>
              <p><strong>Description:</strong> ${vuln.description}</p>
              <p><strong>Impact:</strong> ${vuln.impact || 'Not specified'}</p>
              ${vuln.affectedEndpoints ? `
                <p><strong>Affected Endpoints:</strong></p>
                <ul>
                  ${vuln.affectedEndpoints.map(endpoint => `<li>${endpoint.url}</li>`).join('')}
                </ul>
              ` : ''}
              ${vuln.remediation ? `
                <details>
                  <summary><strong>Remediation</strong></summary>
                  <p>${vuln.remediation.description}</p>
                  ${vuln.remediation.codeExample ? `<pre><code>${vuln.remediation.codeExample}</code></pre>` : ''}
                </details>
              ` : ''}
            </div>
          `).join('')}

          ${results.recommendations.length > 0 ? `
            <div class="recommendations">
              <h2>💡 Recommendations</h2>
              ${results.recommendations.map(rec => `
                <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 5px;">
                  <h3>${rec.title} (${rec.priority})</h3>
                  <p>${rec.description}</p>
                  <p><strong>Impact:</strong> ${rec.impact}</p>
                  <p><strong>Effort:</strong> ${rec.effort}</p>
                  <p><strong>Timeframe:</strong> ${rec.timeframe}</p>
                  ${rec.steps ? `
                    <p><strong>Steps:</strong></p>
                    <ol>
                      ${rec.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${results.compliance ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h2>📋 Compliance Assessment</h2>
              <p><strong>Overall Score:</strong> ${results.compliance.overallScore.toFixed(1)}%</p>
              ${Object.entries(results.compliance.frameworks).map(([framework, result]) => `
                <div style="margin: 10px 0;">
                  <strong>${framework}:</strong> ${result.status} (${result.score.toFixed(1)}%)
                </div>
              `).join('')}
            </div>
          ` : ''}
        </body>
      </html>
    `;
  }

  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'info';
  }
}

export default SecurityTestEngine;
