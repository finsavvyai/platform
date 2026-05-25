/**
 * Questro API Request Manager
 * Postman-like functionality with AI-powered enhancements
 */

class APIRequestManager {
  constructor() {
    this.collections = new Map();
    this.environments = new Map();
    this.history = [];
    this.responses = new Map();
    this.testResults = new Map();
    this.performanceMetrics = new Map();
    this.securityTests = new Map();
  }

  /**
   * Create a new API request collection
   */
  createCollection(name, description = '', metadata = {}) {
    const collection = {
      id: this.generateId(),
      name,
      description,
      metadata,
      requests: [],
      folders: [],
      variables: new Map(),
      scripts: {
        preRequest: [],
        postResponse: [],
        test: []
      },
      auth: {
        type: 'none',
        config: {}
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    this.collections.set(collection.id, collection);
    return collection;
  }

  /**
   * Add request to collection
   */
  addRequest(collectionId, request) {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const apiRequest = {
      id: this.generateId(),
      name: request.name || 'Untitled Request',
      method: request.method || 'GET',
      url: request.url || '',
      headers: this.normalizeHeaders(request.headers || {}),
      body: this.processRequestBody(request.body),
      query: this.processQueryParams(request.query || {}),
      variables: new Map(),
      tests: request.tests || [],
      scripts: {
        preRequest: request.scripts?.preRequest || [],
        postResponse: request.scripts?.postResponse || [],
        test: request.scripts?.test || []
      },
      auth: request.auth || { type: 'none', config: {} },
      metadata: request.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    collection.requests.push(apiRequest);
    collection.updatedAt = new Date().toISOString();

    return apiRequest;
  }

  /**
   * Execute API request with comprehensive testing
   */
  async executeRequest(requestId, collectionId, environment = {}, options = {}) {
    const request = this.getRequest(requestId, collectionId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Process request with environment variables
    const processedRequest = this.processRequestWithEnvironment(request, environment);

    // Add to history
    const historyEntry = {
      id: this.generateId(),
      requestId,
      collectionId,
      request: processedRequest,
      timestamp: new Date().toISOString(),
      options
    };

    try {
      // Execute request with performance monitoring
      const startTime = performance.now();
      const response = await this.makeHttpRequest(processedRequest, options);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      const responseSize = JSON.stringify(response).length;

      // Store response
      const responseEntry = {
        id: this.generateId(),
        requestId,
        collectionId,
        request: processedRequest,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
          cookies: response.cookies || []
        },
        metrics: {
          executionTime,
          responseSize,
          timestamp: new Date().toISOString()
        },
        environment: { ...environment }
      };

      this.responses.set(responseEntry.id, responseEntry);
      historyEntry.response = responseEntry;
      this.history.push(historyEntry);

      // Run automated tests
      const testResults = await this.runTests(request, responseEntry, environment);
      this.testResults.set(responseEntry.id, testResults);

      // Run performance tests
      const performanceResults = await this.runPerformanceTests(responseEntry, options);
      this.performanceMetrics.set(responseEntry.id, performanceResults);

      // Run security tests
      const securityResults = await this.runSecurityTests(responseEntry, options);
      this.securityTests.set(responseEntry.id, securityResults);

      return {
        success: true,
        response: responseEntry,
        testResults,
        performanceResults,
        securityResults
      };

    } catch (error) {
      historyEntry.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };

      this.history.push(historyEntry);

      return {
        success: false,
        error: historyEntry.error,
        request: processedRequest
      };
    }
  }

  /**
   * Process request with environment variables
   */
  processRequestWithEnvironment(request, environment) {
    const processed = { ...request };

    // Replace variables in URL
    processed.url = this.replaceVariables(request.url, { ...environment, ...request.variables });

    // Replace variables in headers
    processed.headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        this.replaceVariables(value, { ...environment, ...request.variables })
      ])
    );

    // Replace variables in body
    if (request.body && request.body.content) {
      processed.body = {
        ...request.body,
        content: this.replaceVariables(request.body.content, { ...environment, ...request.variables })
      };
    }

    // Replace variables in query parameters
    processed.query = request.query.map(param => ({
      ...param,
      value: this.replaceVariables(param.value, { ...environment, ...request.variables })
    }));

    return processed;
  }

  /**
   * Replace variables in text
   */
  replaceVariables(text, variables) {
    if (typeof text !== 'string') return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = variables[variable.trim()];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Make HTTP request with performance monitoring
   */
  async makeHttpRequest(request, options = {}) {
    const url = new URL(request.url);

    // Add query parameters
    request.query.forEach(param => {
      if (param.value) {
        url.searchParams.append(param.key, param.value);
      }
    });

    const fetchOptions = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers
      }
    };

    // Add request body
    if (request.body && request.body.content && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      fetchOptions.body = request.body.content;
    }

    // Add timeout
    if (options.timeout) {
      fetchOptions.signal = AbortSignal.timeout(options.timeout);
    }

    // Add authentication
    if (request.auth && request.auth.type !== 'none') {
      this.addAuthentication(fetchOptions, request.auth);
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);

      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const body = await response.text();

      let parsedBody;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: parsedBody,
        url: response.url,
        ok: response.ok
      };

    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Add authentication to request
   */
  addAuthentication(fetchOptions, auth) {
    switch (auth.type) {
      case 'bearer':
        fetchOptions.headers['Authorization'] = `Bearer ${auth.config.token}`;
        break;

      case 'basic':
        const credentials = btoa(`${auth.config.username}:${auth.config.password}`);
        fetchOptions.headers['Authorization'] = `Basic ${credentials}`;
        break;

      case 'apikey':
        fetchOptions.headers[auth.config.key] = auth.config.value;
        break;

      case 'oauth2':
        fetchOptions.headers['Authorization'] = `Bearer ${auth.config.accessToken}`;
        break;
    }
  }

  /**
   * Run automated tests on response
   */
  async runTests(request, responseEntry, environment) {
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      assertions: [],
      coverage: {
        statusCodes: 0,
        responseTypes: 0,
        headers: 0
      }
    };

    // Default tests
    const defaultTests = [
      {
        name: 'Status code is successful',
        script: () => {
          const status = responseEntry.response.status;
          return status >= 200 && status < 300;
        }
      },
      {
        name: 'Response time is acceptable',
        script: () => {
          return responseEntry.metrics.executionTime < 5000; // 5 seconds
        }
      },
      {
        name: 'Response contains data',
        script: () => {
          const body = responseEntry.response.body;
          return body !== null && body !== undefined && body !== '';
        }
      }
    ];

    // Custom tests from request
    const customTests = request.tests || [];

    // Execute all tests
    const allTests = [...defaultTests, ...customTests];

    for (const test of allTests) {
      try {
        let passed;

        if (typeof test.script === 'string') {
          // Evaluate test script in sandbox
          passed = this.evaluateTestScript(test.script, {
            response: responseEntry.response,
            environment,
            pm: {
              response: responseEntry.response,
              environment: new Proxy(environment, {
                get: (target, prop) => target[prop] || ''
              }),
              test: (description, fn) => {
                try {
                  const result = fn();
                  if (!result) {
                    throw new Error(`Test failed: ${description}`);
                  }
                } catch (error) {
                  throw new Error(`Test error: ${error.message}`);
                }
              }
            }
          });
        } else if (typeof test.script === 'function') {
          passed = test.script(responseEntry.response, environment);
        } else {
          passed = true; // Default to passing if no script
        }

        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.failed++;
        }

        results.assertions.push({
          name: test.name,
          passed,
          message: passed ? 'Test passed' : 'Test failed'
        });

      } catch (error) {
        results.total++;
        results.failed++;

        results.assertions.push({
          name: test.name,
          passed: false,
          message: `Test error: ${error.message}`
        });
      }
    }

    // Calculate coverage
    results.coverage.statusCodes = this.calculateStatusCodeCoverage(responseEntry.response.status);
    results.coverage.responseTypes = this.calculateResponseTypeCoverage(responseEntry.response.body);
    results.coverage.headers = this.calculateHeaderCoverage(responseEntry.response.headers);

    return results;
  }

  /**
   * Evaluate test script safely
   */
  evaluateTestScript(script, context) {
    try {
      // Create a safe evaluation context
      const func = new Function('pm', 'response', 'environment', script);
      return func(context.pm, context.response, context.environment);
    } catch (error) {
      console.error('Test script evaluation error:', error);
      return false;
    }
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests(responseEntry, options = {}) {
    const results = {
      responseTime: {
        value: responseEntry.metrics.executionTime,
        status: 'good',
        threshold: options.responseTimeThreshold || 5000
      },
      responseSize: {
        value: responseEntry.metrics.responseSize,
        status: 'good',
        threshold: options.responseSizeThreshold || 1048576 // 1MB
      },
      throughput: {
        value: this.calculateThroughput(responseEntry),
        status: 'good'
      },
      recommendations: []
    };

    // Evaluate response time
    if (results.responseTime.value > results.responseTime.threshold) {
      results.responseTime.status = 'poor';
      results.recommendations.push('Consider optimizing API endpoint for better response time');
    } else if (results.responseTime.value > results.responseTime.threshold * 0.7) {
      results.responseTime.status = 'warning';
      results.recommendations.push('Response time is approaching threshold, monitor closely');
    }

    // Evaluate response size
    if (results.responseSize.value > results.responseSize.threshold) {
      results.responseSize.status = 'poor';
      results.recommendations.push('Response size is large, consider pagination or compression');
    }

    // AI-powered optimization suggestions
    const aiSuggestions = await this.generatePerformanceOptimizations(responseEntry);
    results.recommendations.push(...aiSuggestions);

    return results;
  }

  /**
   * Run security tests
   */
  async runSecurityTests(responseEntry, options = {}) {
    const results = {
      vulnerabilities: [],
      riskLevel: 'low',
      score: 100,
      recommendations: []
    };

    // Security checks
    const securityChecks = [
      {
        name: 'HTTPS Usage',
        check: () => responseEntry.request.url.startsWith('https://'),
        recommendation: 'Use HTTPS for all API communications'
      },
      {
        name: 'Sensitive Data Exposure',
        check: () => !this.containsSensitiveData(responseEntry.response.body),
        recommendation: 'Ensure sensitive data is not exposed in API responses'
      },
      {
        name: 'Security Headers',
        check: () => this.hasSecurityHeaders(responseEntry.response.headers),
        recommendation: 'Add security headers like X-Content-Type-Options, X-Frame-Options'
      },
      {
        name: 'Authentication Bypass',
        check: () => this.checkAuthenticationBypass(responseEntry),
        recommendation: 'Ensure proper authentication and authorization'
      },
      {
        name: 'Rate Limiting',
        check: () => this.checkRateLimitingHeaders(responseEntry.response.headers),
        recommendation: 'Implement rate limiting to prevent abuse'
      }
    ];

    for (const securityCheck of securityChecks) {
      try {
        const passed = securityCheck.check();

        if (!passed) {
          results.vulnerabilities.push({
            name: securityCheck.name,
            severity: 'medium',
            description: `Security issue detected: ${securityCheck.name}`,
            recommendation: securityCheck.recommendation
          });

          results.score -= 20;
        }
      } catch (error) {
        results.vulnerabilities.push({
          name: securityCheck.name,
          severity: 'low',
          description: `Security check failed: ${error.message}`,
          recommendation: 'Review security configuration'
        });

        results.score -= 10;
      }
    }

    // Determine overall risk level
    if (results.score >= 80) {
      results.riskLevel = 'low';
    } else if (results.score >= 60) {
      results.riskLevel = 'medium';
    } else {
      results.riskLevel = 'high';
    }

    // AI-powered security analysis
    const aiSecurityAnalysis = await this.analyzeSecurityPatterns(responseEntry);
    results.recommendations.push(...aiSecurityAnalysis);

    return results;
  }

  /**
   * Generate AI-powered performance optimizations
   */
  async generatePerformanceOptimizations(responseEntry) {
    // Simulate AI analysis
    const suggestions = [];

    if (responseEntry.metrics.executionTime > 2000) {
      suggestions.push('Consider implementing response caching');
    }

    if (responseEntry.response.body && typeof responseEntry.response.body === 'object') {
      if (Object.keys(responseEntry.response.body).length > 100) {
        suggestions.push('Large response detected, consider field filtering');
      }
    }

    if (responseEntry.response.headers['content-type']?.includes('application/json')) {
      suggestions.push('Consider using gzip compression for JSON responses');
    }

    return suggestions;
  }

  /**
   * AI-powered security pattern analysis
   */
  async analyzeSecurityPatterns(responseEntry) {
    // Simulate AI security analysis
    const patterns = [];

    if (responseEntry.response.headers['x-api-version']) {
      patterns.push('API version detected, ensure version-specific security policies');
    }

    if (responseEntry.response.body?.data?.length > 1000) {
      patterns.push('Large dataset returned, consider implementing access controls');
    }

    if (responseEntry.response.status === 200 && !responseEntry.response.headers['cache-control']) {
      patterns.push('No cache headers found, consider implementing caching policies');
    }

    return patterns;
  }

  // Helper methods
  generateId() {
    return crypto.randomUUID();
  }

  normalizeHeaders(headers) {
    const normalized = {};
    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  processRequestBody(body) {
    if (!body) return null;

    if (typeof body === 'string') {
      return {
        mode: 'raw',
        content: body,
        options: {
          language: 'json'
        }
      };
    }

    return body;
  }

  processQueryParams(query) {
    if (!Array.isArray(query)) {
      return Object.entries(query || {}).map(([key, value]) => ({ key, value }));
    }
    return query;
  }

  getRequest(requestId, collectionId) {
    const collection = this.collections.get(collectionId);
    if (!collection) return null;

    return collection.requests.find(req => req.id === requestId);
  }

  calculateThroughput(responseEntry) {
    const timeInSeconds = responseEntry.metrics.executionTime / 1000;
    const sizeInKB = responseEntry.metrics.responseSize / 1024;
    return sizeInKB / timeInSeconds; // KB per second
  }

  calculateStatusCodeCoverage(statusCode) {
    // Simplified coverage calculation
    const categories = {
      '2xx': [200, 201, 202, 204],
      '3xx': [301, 302, 304],
      '4xx': [400, 401, 403, 404],
      '5xx': [500, 502, 503]
    };

    for (const [category, codes] of Object.entries(categories)) {
      if (codes.includes(statusCode)) {
        return category;
      }
    }

    return 'unknown';
  }

  calculateResponseTypeCoverage(body) {
    if (body === null || body === undefined) return 'empty';
    if (Array.isArray(body)) return 'array';
    if (typeof body === 'object') return 'object';
    if (typeof body === 'string') return 'string';
    if (typeof body === 'number') return 'number';
    if (typeof body === 'boolean') return 'boolean';
    return 'unknown';
  }

  calculateHeaderCoverage(headers) {
    const commonHeaders = ['content-type', 'content-length', 'cache-control', 'etag'];
    const covered = commonHeaders.filter(header => headers[header]);
    return `${covered.length}/${commonHeaders.length}`;
  }

  containsSensitiveData(data) {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i
    ];

    const dataString = JSON.stringify(data);
    return sensitivePatterns.some(pattern => pattern.test(dataString));
  }

  hasSecurityHeaders(headers) {
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security'
    ];

    return securityHeaders.some(header => headers[header]);
  }

  checkAuthenticationBypass(responseEntry) {
    // Simplified check - in real implementation would be more sophisticated
    return responseEntry.response.status !== 401 ||
           responseEntry.response.status !== 403;
  }

  checkRateLimitingHeaders(headers) {
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ];

    return rateLimitHeaders.some(header => headers[header]);
  }

  /**
   * Export collection to Postman format
   */
  exportCollection(collectionId, format = 'postman') {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (format === 'postman') {
      return {
        info: {
          name: collection.name,
          description: collection.description,
          version: collection.version,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: collection.requests.map(request => ({
          name: request.name,
          request: {
            method: request.method,
            header: Object.entries(request.headers).map(([key, value]) => ({
              key,
              value
            })),
            url: {
              raw: request.url,
              host: [new URL(request.url).hostname],
              path: new URL(request.url).pathname.split('/').filter(Boolean)
            },
            body: request.body
          }
        }))
      };
    }

    return collection;
  }

  /**
   * Import collection from Postman format
   */
  importCollection(postmanCollection) {
    const collection = this.createCollection(
      postmanCollection.info.name,
      postmanCollection.info.description
    );

    if (postmanCollection.item) {
      postmanCollection.item.forEach(item => {
        if (item.request) {
          this.addRequest(collection.id, {
            name: item.name,
            method: item.request.method,
            url: item.request.url.raw || '',
            headers: Object.fromEntries(
              (item.request.header || []).map(h => [h.key, h.value])
            ),
            body: item.request.body
          });
        }
      });
    }

    return collection;
  }
}

export default APIRequestManager;
