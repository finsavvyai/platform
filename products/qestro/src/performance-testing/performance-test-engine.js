/**
 * Questro Performance Testing Engine
 * Advanced load testing with AI-powered optimization
 */

class PerformanceTestEngine {
  constructor() {
    this.testSuites = new Map();
    this.testResults = new Map();
    this.benchmarks = new Map();
    this.alerts = [];
    this.isRunning = false;
    this.currentTest = null;
  }

  /**
   * Create a performance test suite
   */
  createTestSuite(name, config = {}) {
    const testSuite = {
      id: this.generateId(),
      name,
      description: config.description || '',
      type: config.type || 'load', // load, stress, spike, endurance, volume
      target: {
        url: config.target?.url || '',
        method: config.target?.method || 'GET',
        headers: config.target?.headers || {},
        body: config.target?.body || null
      },
      load: {
        users: config.load?.users || 100,
        duration: config.load?.duration || 60, // seconds
        rampUp: config.load?.rampUp || 10, // seconds
        rampDown: config.load?.rampDown || 10
      },
      thresholds: {
        responseTime: config.thresholds?.responseTime || 2000, // ms
        errorRate: config.thresholds?.errorRate || 1, // %
        throughput: config.thresholds?.throughput || 100, // requests/second
        cpuUsage: config.thresholds?.cpuUsage || 80, // %
        memoryUsage: config.thresholds?.memoryUsage || 85 // %
      },
      monitoring: {
        enableMetrics: config.monitoring?.enableMetrics !== false,
        enableResourceMonitoring: config.monitoring?.enableResourceMonitoring || false,
        enableNetworkMonitoring: config.monitoring?.enableNetworkMonitoring || false,
        samplingRate: config.monitoring?.samplingRate || 1 // sample every request
      },
      environments: config.environments || ['production'],
      schedule: config.schedule || null,
      notifications: config.notifications || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.testSuites.set(testSuite.id, testSuite);
    return testSuite;
  }

  /**
   * Execute performance test
   */
  async executeTest(testSuiteId, environment = 'production', options = {}) {
    const testSuite = this.testSuites.get(testSuiteId);
    if (!testSuite) {
      throw new Error('Test suite not found');
    }

    if (this.isRunning) {
      throw new Error('Another test is currently running');
    }

    this.isRunning = true;
    this.currentTest = {
      testSuiteId,
      environment,
      startTime: new Date(),
      status: 'running'
    };

    try {
      console.log(`🚀 Starting performance test: ${testSuite.name}`);
      console.log(`📊 Test Configuration:`, {
        type: testSuite.type,
        users: testSuite.load.users,
        duration: testSuite.load.duration,
        url: testSuite.target.url
      });

      const results = await this.runPerformanceTest(testSuite, environment, options);

      this.testResults.set(results.id, results);

      // Analyze results and generate recommendations
      const analysis = await this.analyzeResults(results, testSuite);
      results.analysis = analysis;

      // Check thresholds and create alerts
      await this.checkThresholds(results, testSuite);

      // Generate AI-powered optimization suggestions
      const optimizations = await this.generateOptimizations(results, testSuite);
      results.optimizations = optimizations;

      console.log(`✅ Performance test completed: ${testSuite.name}`);
      console.log(`📈 Results:`, {
        totalRequests: results.metrics.totalRequests,
        averageResponseTime: results.metrics.averageResponseTime,
        errorRate: results.metrics.errorRate,
        throughput: results.metrics.throughput
      });

      return results;

    } catch (error) {
      console.error(`❌ Performance test failed: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }
  }

  /**
   * Run the actual performance test
   */
  async runPerformanceTest(testSuite, environment, options) {
    const results = {
      id: this.generateId(),
      testSuiteId: testSuite.id,
      environment,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'running',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        bytesTransferred: 0,
        connectionErrors: 0,
        timeoutErrors: 0,
        statusCodes: {}
      },
      timeline: [],
      resourceMetrics: {
        cpu: [],
        memory: [],
        network: []
      },
      errors: [],
      samples: []
    };

    const startTime = Date.now();
    const responseTimes = [];
    const activeRequests = new Set();
    let completedRequests = 0;

    // Initialize virtual users
    const users = [];
    for (let i = 0; i < testSuite.load.users; i++) {
      users.push({
        id: i,
        startTime: startTime + (i * (testSuite.load.rampUp * 1000 / testSuite.load.users)),
        requestsCompleted: 0,
        isActive: false
      });
    }

    console.log(`👥 Starting ${testSuite.load.users} virtual users`);

    // Test execution loop
    const testDuration = testSuite.load.duration * 1000; // Convert to milliseconds
    let testRunning = true;

    // Start monitoring
    const monitoringInterval = setInterval(() => {
      if (testSuite.monitoring.enableResourceMonitoring) {
        this.collectResourceMetrics(results);
      }
    }, 1000);

    // User simulation loop
    const testInterval = setInterval(async () => {
      const currentTime = Date.now();

      if (currentTime - startTime >= testDuration) {
        testRunning = false;
        clearInterval(testInterval);
        clearInterval(monitoringInterval);
        return;
      }

      // Activate users based on ramp-up schedule
      users.forEach(user => {
        if (!user.isActive && currentTime >= user.startTime) {
          user.isActive = true;
          this.simulateUserRequests(user, testSuite, results, responseTimes, activeRequests);
        }
      });

      // Update metrics
      this.updateMetrics(results, responseTimes, completedRequests, currentTime - startTime);

    }, 100); // Update every 100ms

    // Wait for all requests to complete
    while (activeRequests.size > 0 || testRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Finalize results
    results.endTime = new Date().toISOString();
    results.status = 'completed';
    results.duration = Date.now() - startTime;

    // Calculate final metrics
    this.calculateFinalMetrics(results, responseTimes);

    return results;
  }

  /**
   * Simulate user requests
   */
  async simulateUserRequests(user, testSuite, results, responseTimes, activeRequests) {
    const requestInterval = 1000; // 1 request per second per user
    const endTime = Date.now() + (testSuite.load.duration * 1000);

    const makeRequest = async () => {
      if (Date.now() >= endTime) return;

      const requestId = this.generateId();
      activeRequests.add(requestId);

      const requestStart = Date.now();

      try {
        const response = await this.makeHttpRequest(testSuite.target, {
          timeout: 30000, // 30 seconds
          retries: 2
        });

        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        activeRequests.delete(requestId);
        completedRequests++;

        // Record sample
        if (Math.random() < testSuite.monitoring.samplingRate) {
          results.samples.push({
            timestamp: new Date().toISOString(),
            responseTime,
            statusCode: response.status,
            success: response.status >= 200 && response.status < 300,
            size: JSON.stringify(response.body || {}).length
          });
        }

        // Update metrics
        results.metrics.totalRequests++;
        results.metrics.successfulRequests++;

        if (!results.metrics.statusCodes[response.status]) {
          results.metrics.statusCodes[response.status] = 0;
        }
        results.metrics.statusCodes[response.status]++;

      } catch (error) {
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        activeRequests.delete(requestId);

        results.metrics.totalRequests++;
        results.metrics.failedRequests++;
        results.metrics.totalErrors++;

        results.errors.push({
          timestamp: new Date().toISOString(),
          message: error.message,
          type: this.classifyError(error),
          userId: user.id
        });

        if (error.name === 'TimeoutError') {
          results.metrics.timeoutErrors++;
        } else if (error.message.includes('connection')) {
          results.metrics.connectionErrors++;
        }
      }

      user.requestsCompleted++;

      // Schedule next request
      if (Date.now() < endTime) {
        setTimeout(makeRequest, requestInterval + Math.random() * 200); // Add some randomness
      }
    };

    // Start making requests
    makeRequest();
  }

  /**
   * Make HTTP request
   */
  async makeHttpRequest(target, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    try {
      const response = await fetch(target.url, {
        method: target.method,
        headers: target.headers,
        body: target.body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
        headers: Object.fromEntries(response.headers.entries()),
        body: parsedBody
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Update metrics during test execution
   */
  updateMetrics(results, responseTimes, completedRequests, elapsed) {
    if (responseTimes.length === 0) return;

    results.metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    results.metrics.minResponseTime = Math.min(...responseTimes);
    results.metrics.maxResponseTime = Math.max(...responseTimes);
    results.metrics.requestsPerSecond = completedRequests / (elapsed / 1000);
    results.metrics.errorRate = (results.metrics.failedRequests / results.metrics.totalRequests) * 100 || 0;

    // Update timeline
    results.timeline.push({
      timestamp: new Date().toISOString(),
      activeUsers: this.currentTest?.activeUsers || 0,
      requestsPerSecond: results.metrics.requestsPerSecond,
      averageResponseTime: results.metrics.averageResponseTime,
      errorRate: results.metrics.errorRate
    });
  }

  /**
   * Calculate final metrics
   */
  calculateFinalMetrics(results, responseTimes) {
    if (responseTimes.length === 0) return;

    // Sort response times for percentile calculations
    const sorted = [...responseTimes].sort((a, b) => a - b);

    results.metrics.p50ResponseTime = this.getPercentile(sorted, 50);
    results.metrics.p90ResponseTime = this.getPercentile(sorted, 90);
    results.metrics.p95ResponseTime = this.getPercentile(sorted, 95);
    results.metrics.p99ResponseTime = this.getPercentile(sorted, 99);

    results.metrics.throughput = results.metrics.successfulRequests / (results.duration / 1000);
    results.metrics.bytesTransferred = results.samples.reduce((total, sample) => total + sample.size, 0);
  }

  /**
   * Get percentile value
   */
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Analyze test results
   */
  async analyzeResults(results, testSuite) {
    const analysis = {
      performance: {
        grade: 'A', // A, B, C, D, F
        score: 0,
        strengths: [],
        weaknesses: [],
        bottlenecks: []
      },
      scalability: {
        grade: 'A',
        score: 0,
        maxSustainedLoad: 0,
        breakingPoint: null
      },
      reliability: {
        grade: 'A',
        score: 0,
        errorPatterns: [],
        stabilityIssues: []
      },
      recommendations: []
    };

    // Performance analysis
    let performanceScore = 100;

    if (results.metrics.averageResponseTime > testSuite.thresholds.responseTime) {
      performanceScore -= 30;
      analysis.performance.weaknesses.push('Response time exceeds threshold');
      analysis.performance.bottlenecks.push('High response times');
    }

    if (results.metrics.errorRate > testSuite.thresholds.errorRate) {
      performanceScore -= 40;
      analysis.performance.weaknesses.push('Error rate exceeds threshold');
      analysis.reliability.stabilityIssues.push('High error rate under load');
    }

    if (results.metrics.throughput < testSuite.thresholds.throughput) {
      performanceScore -= 20;
      analysis.performance.weaknesses.push('Throughput below threshold');
    }

    analysis.performance.score = Math.max(0, performanceScore);
    analysis.performance.grade = this.calculateGrade(performanceScore);

    // Identify strengths
    if (results.metrics.averageResponseTime < testSuite.thresholds.responseTime * 0.5) {
      analysis.performance.strengths.push('Excellent response times');
    }

    if (results.metrics.errorRate < testSuite.thresholds.errorRate * 0.5) {
      analysis.performance.strengths.push('Very low error rate');
    }

    if (results.metrics.throughput > testSuite.thresholds.throughput * 1.5) {
      analysis.performance.strengths.push('High throughput achieved');
    }

    // Scalability analysis
    analysis.scalability.maxSustainedLoad = this.calculateMaxSustainedLoad(results);
    analysis.scalability.breakingPoint = this.findBreakingPoint(results);

    // Reliability analysis
    analysis.reliability.errorPatterns = this.analyzeErrorPatterns(results.errors);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(results, testSuite, analysis);

    return analysis;
  }

  /**
   * Generate AI-powered optimization suggestions
   */
  async generateOptimizations(results, testSuite) {
    const optimizations = [];

    // Response time optimizations
    if (results.metrics.averageResponseTime > 1000) {
      optimizations.push({
        category: 'Response Time',
        priority: 'high',
        suggestion: 'Implement response caching for frequently accessed data',
        expectedImprovement: '30-50% reduction in response time',
        implementation: 'Add Redis or CDN caching layer'
      });
    }

    // Throughput optimizations
    if (results.metrics.throughput < testSuite.thresholds.throughput) {
      optimizations.push({
        category: 'Throughput',
        priority: 'high',
        suggestion: 'Optimize database queries and add connection pooling',
        expectedImprovement: '2-3x increase in throughput',
        implementation: 'Use connection pooling and query optimization'
      });
    }

    // Error rate optimizations
    if (results.metrics.errorRate > testSuite.thresholds.errorRate) {
      optimizations.push({
        category: 'Reliability',
        priority: 'critical',
        suggestion: 'Implement circuit breaker pattern and retry logic',
        expectedImprovement: 'Reduce errors by 80-90%',
        implementation: 'Add circuit breaker and exponential backoff'
      });
    }

    // Memory optimizations
    const memoryIssues = this.analyzeMemoryUsage(results);
    if (memoryIssues.length > 0) {
      optimizations.push({
        category: 'Memory',
        priority: 'medium',
        suggestion: 'Optimize memory usage through object pooling',
        expectedImprovement: 'Reduce memory usage by 40-60%',
        implementation: 'Implement object pooling and garbage collection optimization'
      });
    }

    // AI-powered pattern recognition
    const patterns = await this.identifyPerformancePatterns(results);
    optimizations.push(...patterns);

    return optimizations;
  }

  /**
   * AI-powered performance pattern identification
   */
  async identifyPerformancePatterns(results) {
    const patterns = [];

    // Analyze response time trends
    if (results.timeline.length > 10) {
      const recentAvg = results.timeline.slice(-10).reduce((sum, point) => sum + point.averageResponseTime, 0) / 10;
      const overallAvg = results.metrics.averageResponseTime;

      if (recentAvg > overallAvg * 1.2) {
        patterns.push({
          category: 'Performance Degradation',
          priority: 'high',
          suggestion: 'Performance degrades over time, possible memory leak',
          expectedImprovement: 'Stable performance throughout test duration',
          implementation: 'Investigate memory leaks and implement periodic cleanup'
        });
      }
    }

    // Analyze error patterns
    const errorSpike = this.findErrorSpikes(results);
    if (errorSpike) {
      patterns.push({
        category: 'Error Patterns',
        priority: 'high',
        suggestion: `Error spike detected at ${errorSpike.timestamp}`,
        expectedImprovement: 'Eliminate error spikes',
        implementation: 'Investigate resource exhaustion during peak load'
      });
    }

    return patterns;
  }

  // Helper methods
  generateId() {
    return crypto.randomUUID();
  }

  classifyError(error) {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.message.includes('connection')) return 'connection';
    if (error.message.includes('5')) return 'server';
    if (error.message.includes('4')) return 'client';
    return 'unknown';
  }

  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  calculateMaxSustainedLoad(results) {
    // Simplified calculation - in real implementation would be more sophisticated
    return results.metrics.throughput * 0.8; // 80% of peak throughput
  }

  findBreakingPoint(results) {
    // Find point where error rate spikes significantly
    for (let i = 1; i < results.timeline.length; i++) {
      const current = results.timeline[i];
      const previous = results.timeline[i - 1];

      if (current.errorRate > previous.errorRate * 2 && current.errorRate > 10) {
        return {
          timestamp: current.timestamp,
          requestsPerSecond: current.requestsPerSecond,
          errorRate: current.errorRate
        };
      }
    }

    return null;
  }

  analyzeErrorPatterns(errors) {
    const patterns = {};

    errors.forEach(error => {
      if (!patterns[error.type]) {
        patterns[error.type] = {
          count: 0,
          percentage: 0,
          examples: []
        };
      }

      patterns[error.type].count++;
      patterns[error.type].examples.push({
        timestamp: error.timestamp,
        message: error.message
      });
    });

    // Calculate percentages
    Object.values(patterns).forEach(pattern => {
      pattern.percentage = (pattern.count / errors.length) * 100;
    });

    return patterns;
  }

  generateRecommendations(results, testSuite, analysis) {
    const recommendations = [];

    if (analysis.performance.weaknesses.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize Response Times',
        description: 'Implement caching and query optimization to improve response times',
        impact: 'High - Direct user experience improvement'
      });
    }

    if (analysis.reliability.stabilityIssues.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'critical',
        title: 'Improve Error Handling',
        description: 'Add circuit breakers and retry logic to reduce errors under load',
        impact: 'Critical - System stability'
      });
    }

    if (results.metrics.throughput < testSuite.thresholds.throughput) {
      recommendations.push({
        type: 'scalability',
        priority: 'high',
        title: 'Increase Throughput',
        description: 'Optimize database queries and add horizontal scaling',
        impact: 'High - Support more concurrent users'
      });
    }

    return recommendations;
  }

  collectResourceMetrics(results) {
    // Simplified resource monitoring - in real implementation would use actual system metrics
    results.resourceMetrics.cpu.push({
      timestamp: new Date().toISOString(),
      usage: Math.random() * 100
    });

    results.resourceMetrics.memory.push({
      timestamp: new Date().toISOString(),
      usage: Math.random() * 100
    });
  }

  analyzeMemoryUsage(results) {
    // Simplified memory analysis
    return [];
  }

  findErrorSpikes(results) {
    for (let i = 2; i < results.timeline.length; i++) {
      const current = results.timeline[i];
      const previous = results.timeline[i - 1];

      if (current.errorRate > previous.errorRate * 3) {
        return current;
      }
    }

    return null;
  }

  async checkThresholds(results, testSuite) {
    const alerts = [];

    // Check response time threshold
    if (results.metrics.averageResponseTime > testSuite.thresholds.responseTime) {
      alerts.push({
        type: 'threshold',
        severity: 'warning',
        metric: 'response_time',
        value: results.metrics.averageResponseTime,
        threshold: testSuite.thresholds.responseTime,
        message: `Response time ${results.metrics.averageResponseTime}ms exceeds threshold ${testSuite.thresholds.responseTime}ms`
      });
    }

    // Check error rate threshold
    if (results.metrics.errorRate > testSuite.thresholds.errorRate) {
      alerts.push({
        type: 'threshold',
        severity: 'critical',
        metric: 'error_rate',
        value: results.metrics.errorRate,
        threshold: testSuite.thresholds.errorRate,
        message: `Error rate ${results.metrics.errorRate}% exceeds threshold ${testSuite.thresholds.errorRate}%`
      });
    }

    // Check throughput threshold
    if (results.metrics.throughput < testSuite.thresholds.throughput) {
      alerts.push({
        type: 'threshold',
        severity: 'warning',
        metric: 'throughput',
        value: results.metrics.throughput,
        threshold: testSuite.thresholds.throughput,
        message: `Throughput ${results.metrics.throughput} req/s below threshold ${testSuite.thresholds.throughput} req/s`
      });
    }

    this.alerts.push(...alerts);

    // Send notifications
    if (alerts.length > 0) {
      await this.sendAlerts(alerts, testSuite.notifications);
    }

    return alerts;
  }

  async sendAlerts(alerts, notificationChannels) {
    // Simplified notification sending
    console.log('🚨 Performance Test Alerts:', alerts);

    // In real implementation, would send to:
    // - Slack channels
    // - Email notifications
    // - PagerDuty
    // - Webhooks
  }

  /**
   * Export test results
   */
  exportResults(testResultId, format = 'json') {
    const results = this.testResults.get(testResultId);
    if (!results) {
      throw new Error('Test results not found');
    }

    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(results);
    } else if (format === 'html') {
      return this.generateHTMLReport(results);
    }

    return results;
  }

  convertToCSV(results) {
    const headers = [
      'Timestamp',
      'Response Time',
      'Status Code',
      'Success',
      'Size'
    ];

    const rows = results.samples.map(sample => [
      sample.timestamp,
      sample.responseTime,
      sample.statusCode,
      sample.success,
      sample.size
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  generateHTMLReport(results) {
    return `
      <html>
        <head>
          <title>Performance Test Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
            .metrics { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
            .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; min-width: 200px; }
            .metric h3 { margin: 0 0 10px 0; color: #333; }
            .metric .value { font-size: 24px; font-weight: bold; color: #007cba; }
            .chart { margin: 20px 0; }
            .recommendations { background: #fff9e6; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Performance Test Report</h1>
            <p><strong>Test Suite:</strong> ${results.testSuiteId}</p>
            <p><strong>Environment:</strong> ${results.environment}</p>
            <p><strong>Duration:</strong> ${(results.duration / 1000).toFixed(2)} seconds</p>
          </div>

          <div class="metrics">
            <div class="metric">
              <h3>Total Requests</h3>
              <div class="value">${results.metrics.totalRequests.toLocaleString()}</div>
            </div>
            <div class="metric">
              <h3>Average Response Time</h3>
              <div class="value">${results.metrics.averageResponseTime.toFixed(2)}ms</div>
            </div>
            <div class="metric">
              <h3>Throughput</h3>
              <div class="value">${results.metrics.throughput.toFixed(2)} req/s</div>
            </div>
            <div class="metric">
              <h3>Error Rate</h3>
              <div class="value">${results.metrics.errorRate.toFixed(2)}%</div>
            </div>
          </div>

          ${results.optimizations ? `
            <div class="recommendations">
              <h2>Optimization Recommendations</h2>
              ${results.optimizations.map(opt => `
                <div style="margin: 10px 0; padding: 10px; background: #fff; border-left: 4px solid #007cba;">
                  <strong>${opt.category}</strong> - ${opt.suggestion}
                  <br><em>Expected improvement: ${opt.expectedImprovement}</em>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </body>
      </html>
    `;
  }
}

export default PerformanceTestEngine;
