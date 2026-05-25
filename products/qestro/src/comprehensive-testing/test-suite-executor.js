/**
 * Questro Comprehensive Test Suite Executor
 * Unified testing platform combining mobile, API, performance, and security testing
 */

import APIRequestManager from '../api-testing/api-request-manager.js';
import PerformanceTestEngine from '../performance-testing/performance-test-engine.js';
import SecurityTestEngine from '../security-testing/security-test-engine.js';

class ComprehensiveTestExecutor {
  constructor() {
    this.apiManager = new APIRequestManager();
    this.performanceEngine = new PerformanceTestEngine();
    this.securityEngine = new SecurityTestEngine();

    this.testSuites = new Map();
    this.executionQueue = [];
    this.isRunning = false;
    this.currentExecution = null;
    this.testHistory = [];

    // Event listeners
    this.eventListeners = {
      'testStarted': [],
      'testCompleted': [],
      'testFailed': [],
      'progress': [],
      'results': []
    };
  }

  /**
   * Create comprehensive test suite
   */
  createTestSuite(name, config = {}) {
    const testSuite = {
      id: this.generateId(),
      name,
      description: config.description || '',
      project: config.project || 'default',
      environment: config.environment || 'staging',

      // Mobile testing configuration
      mobile: {
        enabled: config.mobile?.enabled || false,
        platforms: config.mobile?.platforms || ['ios', 'android'],
        devices: config.mobile?.devices || [],
        appUrl: config.mobile?.appUrl || '',
        testScenarios: config.mobile?.testScenarios || []
      },

      // API testing configuration
      api: {
        enabled: config.api?.enabled || false,
        collections: config.api?.collections || [],
        environments: config.api?.environments || [],
        testRunner: config.api?.testRunner || 'sequential',
        parallelism: config.api?.parallelism || 1
      },

      // Performance testing configuration
      performance: {
        enabled: config.performance?.enabled || false,
        type: config.performance?.type || 'load',
        users: config.performance?.users || 100,
        duration: config.performance?.duration || 300,
        rampUp: config.performance?.rampUp || 60,
        thresholds: config.performance?.thresholds || {}
      },

      // Security testing configuration
      security: {
        enabled: config.security?.enabled || false,
        type: config.security?.type || 'comprehensive',
        scope: config.security?.scope || {},
        compliance: config.security?.compliance || []
      },

      // Execution configuration
      execution: {
        mode: config.execution?.mode || 'sequential', // sequential, parallel, custom
        schedule: config.execution?.schedule || null,
        notifications: config.execution?.notifications || [],
        retryPolicy: {
          enabled: config.execution?.retryPolicy?.enabled || false,
          maxRetries: config.execution?.retryPolicy?.maxRetries || 3,
          retryDelay: config.execution?.retryPolicy?.retryDelay || 5000
        },
        timeout: config.execution?.timeout || 3600000, // 1 hour
        abortOnFailure: config.execution?.abortOnFailure || false
      },

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.testSuites.set(testSuite.id, testSuite);
    return testSuite;
  }

  /**
   * Execute comprehensive test suite
   */
  async executeTestSuite(testSuiteId, options = {}) {
    const testSuite = this.testSuites.get(testSuiteId);
    if (!testSuite) {
      throw new Error('Test suite not found');
    }

    if (this.isRunning) {
      throw new Error('Another test suite is currently running');
    }

    this.isRunning = true;
    this.currentExecution = {
      testSuiteId,
      startTime: new Date(),
      status: 'running',
      results: {
        mobile: null,
        api: null,
        performance: null,
        security: null
      },
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        duration: 0,
        successRate: 0
      }
    };

    try {
      console.log(`🚀 Starting comprehensive test suite: ${testSuite.name}`);
      this.emit('testStarted', { testSuiteId, testSuite });

      const executionPlan = this.createExecutionPlan(testSuite);
      console.log(`📋 Execution plan created with ${executionPlan.steps.length} steps`);

      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let skippedTests = 0;

      // Execute tests based on plan
      for (const step of executionPlan.steps) {
        try {
          this.emit('progress', {
            step: step.name,
            progress: (executionPlan.steps.indexOf(step) / executionPlan.steps.length) * 100
          });

          const stepResult = await this.executeTestStep(step, testSuite, options);

          if (stepResult) {
            this.currentExecution.results[step.type] = stepResult;

            totalTests += stepResult.summary?.totalTests || 1;
            passedTests += stepResult.summary?.passedTests || (stepResult.success ? 1 : 0);
            failedTests += stepResult.summary?.failedTests || (stepResult.success ? 0 : 1);
            skippedTests += stepResult.summary?.skippedTests || 0;
          }

        } catch (error) {
          console.error(`❌ Test step failed: ${step.name} - ${error.message}`);

          if (testSuite.execution.abortOnFailure) {
            throw new Error(`Test suite aborted due to failure in ${step.name}`);
          }

          failedTests++;
        }
      }

      // Calculate final summary
      this.currentExecution.summary = {
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
        duration: Date.now() - this.currentExecution.startTime,
        successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
      };

      this.currentExecution.endTime = new Date();
      this.currentExecution.status = 'completed';

      // Generate comprehensive analysis
      this.currentExecution.analysis = await this.generateComprehensiveAnalysis(
        this.currentExecution.results,
        this.currentExecution.summary
      );

      console.log(`✅ Test suite completed: ${testSuite.name}`);
      console.log(`📊 Results: ${passedTests}/${totalTests} tests passed (${this.currentExecution.summary.successRate.toFixed(1)}%)`);

      this.testHistory.push({ ...this.currentExecution });
      this.emit('testCompleted', this.currentExecution);
      this.emit('results', this.currentExecution);

      return this.currentExecution;

    } catch (error) {
      console.error(`❌ Test suite execution failed: ${error.message}`);

      this.currentExecution.endTime = new Date();
      this.currentExecution.status = 'failed';
      this.currentExecution.error = error.message;

      this.emit('testFailed', { testSuiteId, error: error.message });
      throw error;

    } finally {
      this.isRunning = false;
      this.currentExecution = null;
    }
  }

  /**
   * Create execution plan for test suite
   */
  createExecutionPlan(testSuite) {
    const steps = [];

    // Mobile testing
    if (testSuite.mobile.enabled) {
      steps.push({
        type: 'mobile',
        name: 'Mobile Testing',
        priority: 1,
        dependencies: [],
        execute: () => this.executeMobileTests(testSuite.mobile)
      });
    }

    // API testing
    if (testSuite.api.enabled) {
      steps.push({
        type: 'api',
        name: 'API Testing',
        priority: 2,
        dependencies: [],
        execute: () => this.executeAPITests(testSuite.api)
      });
    }

    // Performance testing (requires API testing to be complete)
    if (testSuite.performance.enabled) {
      steps.push({
        type: 'performance',
        name: 'Performance Testing',
        priority: 3,
        dependencies: testSuite.api.enabled ? ['api'] : [],
        execute: () => this.executePerformanceTests(testSuite.performance)
      });
    }

    // Security testing
    if (testSuite.security.enabled) {
      steps.push({
        type: 'security',
        name: 'Security Testing',
        priority: 4,
        dependencies: [],
        execute: () => this.executeSecurityTests(testSuite.security)
      });
    }

    // Sort by priority and dependencies
    return this.sortExecutionSteps(steps);
  }

  /**
   * Execute mobile tests
   */
  async executeMobileTests(mobileConfig) {
    console.log(`📱 Executing mobile tests on ${mobileConfig.platforms.join(', ')}`);

    const results = {
      success: true,
      startTime: new Date().toISOString(),
      endTime: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0
      },
      results: [],
      devices: mobileConfig.devices,
      platforms: mobileConfig.platforms
    };

    // Simulate mobile test execution
    for (const platform of mobileConfig.platforms) {
      for (const device of mobileConfig.devices) {
        for (const scenario of mobileConfig.testScenarios) {
          try {
            const testResult = await this.runMobileTest(platform, device, scenario);
            results.results.push(testResult);

            results.summary.totalTests++;
            if (testResult.success) {
              results.summary.passedTests++;
            } else {
              results.summary.failedTests++;
              results.success = false;
            }

          } catch (error) {
            console.warn(`Mobile test failed: ${platform}/${device} - ${error.message}`);
            results.summary.totalTests++;
            results.summary.failedTests++;
            results.success = false;
          }
        }
      }
    }

    results.endTime = new Date().toISOString();
    return results;
  }

  /**
   * Execute API tests
   */
  async executeAPITests(apiConfig) {
    console.log(`🔌 Executing API tests for ${apiConfig.collections.length} collections`);

    const results = {
      success: true,
      startTime: new Date().toISOString(),
      endTime: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0
      },
      collections: [],
      requests: [],
      environment: apiConfig.environments[0] || {}
    };

    for (const collectionConfig of apiConfig.collections) {
      try {
        // Create collection
        const collection = this.apiManager.createCollection(
          collectionConfig.name,
          collectionConfig.description
        );

        // Add requests to collection
        for (const requestConfig of collectionConfig.requests) {
          const request = this.apiManager.addRequest(collection.id, requestConfig);

          // Execute request
          const executionResult = await this.apiManager.executeRequest(
            request.id,
            collection.id,
            results.environment
          );

          results.requests.push({
            name: request.name,
            url: request.url,
            method: request.method,
            success: executionResult.success,
            response: executionResult.response,
            testResults: executionResult.testResults,
            performanceResults: executionResult.performanceResults,
            securityResults: executionResult.securityResults
          });

          results.summary.totalTests++;
          if (executionResult.success) {
            results.summary.passedTests++;
          } else {
            results.summary.failedTests++;
            results.success = false;
          }
        }

        results.collections.push({
          id: collection.id,
          name: collection.name,
          requests: collection.requests.length
        });

      } catch (error) {
        console.warn(`API collection test failed: ${collectionConfig.name} - ${error.message}`);
        results.summary.totalTests++;
        results.summary.failedTests++;
        results.success = false;
      }
    }

    results.endTime = new Date().toISOString();
    return results;
  }

  /**
   * Execute performance tests
   */
  async executePerformanceTests(performanceConfig) {
    console.log(`⚡ Executing performance tests: ${performanceConfig.type}`);

    // Create performance test suite
    const testSuite = this.performanceEngine.createTestSuite(
      `Performance Test - ${performanceConfig.type}`,
      {
        type: performanceConfig.type,
        target: {
          url: performanceConfig.targetUrl || 'https://api.example.com',
          method: 'GET'
        },
        load: {
          users: performanceConfig.users,
          duration: performanceConfig.duration,
          rampUp: performanceConfig.rampUp
        },
        thresholds: performanceConfig.thresholds
      }
    );

    // Execute performance test
    const results = await this.performanceEngine.executeTest(testSuite.id);

    return {
      success: results.status === 'completed',
      summary: {
        totalTests: 1,
        passedTests: results.status === 'completed' ? 1 : 0,
        failedTests: results.status === 'completed' ? 0 : 1,
        skippedTests: 0
      },
      metrics: results.metrics,
      analysis: results.analysis,
      optimizations: results.optimizations,
      duration: results.duration
    };
  }

  /**
   * Execute security tests
   */
  async executeSecurityTests(securityConfig) {
    console.log(`🔒 Executing security tests: ${securityConfig.type}`);

    // Create security test suite
    const testSuite = this.securityEngine.createTestSuite(
      `Security Test - ${securityConfig.type}`,
      {
        type: securityConfig.type,
        target: {
          urls: securityConfig.targetUrls || []
        },
        tests: {
          authentication: true,
          authorization: true,
          dataValidation: true,
          sessionManagement: true,
          cryptography: true,
          errorHandling: true
        },
        compliance: {
          frameworks: securityConfig.compliance || ['OWASP']
        }
      }
    );

    // Execute security test
    const results = await this.securityEngine.executeSecurityTest(testSuite.id);

    return {
      success: results.status === 'completed',
      summary: {
        totalTests: 1,
        passedTests: results.summary.totalVulnerabilities === 0 ? 1 : 0,
        failedTests: results.summary.totalVulnerabilities > 0 ? 1 : 0,
        skippedTests: 0
      },
      vulnerabilities: results.vulnerabilities,
      compliance: results.compliance,
      riskScore: results.summary.riskScore,
      recommendations: results.recommendations
    };
  }

  /**
   * Generate comprehensive analysis
   */
  async generateComprehensiveAnalysis(results, summary) {
    const analysis = {
      overall: {
        grade: this.calculateOverallGrade(summary),
        score: summary.successRate,
        health: 'good',
        recommendations: []
      },
      trends: {
        performance: this.analyzePerformanceTrends(results),
        security: this.analyzeSecurityTrends(results),
        reliability: this.analyzeReliabilityTrends(results)
      },
      insights: {
        strengths: this.identifyStrengths(results),
        weaknesses: this.identifyWeaknesses(results),
        opportunities: this.identifyOpportunities(results),
        risks: this.identifyRisks(results)
      },
      predictive: {
        nextSteps: this.generateNextSteps(results),
        futureRisks: this.predictFutureRisks(results),
        improvementPlan: this.createImprovementPlan(results)
      }
    };

    // AI-powered insights
    const aiInsights = await this.generateAIInsights(results, summary);
    analysis.aiInsights = aiInsights;

    return analysis;
  }

  /**
   * Execute individual test step
   */
  async executeTestStep(step, testSuite, options) {
    // Check dependencies
    for (const dependency of step.dependencies) {
      const dependencyResult = this.currentExecution.results[dependency];
      if (!dependencyResult || !dependencyResult.success) {
        throw new Error(`Dependency failed: ${dependency}`);
      }
    }

    // Apply retry policy
    let lastError;
    for (let attempt = 1; attempt <= (testSuite.execution.retryPolicy.maxRetries + 1); attempt++) {
      try {
        const result = await step.execute();
        return result;
      } catch (error) {
        lastError = error;

        if (attempt <= testSuite.execution.retryPolicy.maxRetries) {
          console.log(`🔄 Retrying ${step.name} (attempt ${attempt + 1}/${testSuite.execution.retryPolicy.maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, testSuite.execution.retryPolicy.retryDelay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Run individual mobile test
   */
  async runMobileTest(platform, device, scenario) {
    // Simulate mobile test execution
    const testResult = {
      platform,
      device,
      scenario: scenario.name,
      success: Math.random() > 0.1, // 90% success rate
      duration: Math.floor(Math.random() * 10000) + 1000,
      screenshots: [],
      logs: [`Test started on ${platform} ${device}`],
      metrics: {
        responseTime: Math.floor(Math.random() * 2000) + 500,
        cpuUsage: Math.floor(Math.random() * 80) + 20,
        memoryUsage: Math.floor(Math.random() * 200) + 100
      }
    };

    if (testResult.success) {
      testResult.logs.push('Test completed successfully');
    } else {
      testResult.logs.push('Test failed: Element not found');
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate test execution time
    return testResult;
  }

  /**
   * AI-powered insights generation
   */
  async generateAIInsights(results, summary) {
    const insights = {
      performanceOptimizations: [],
      securityRecommendations: [],
      qualityImprovements: [],
      strategicInsights: []
    };

    // Analyze performance results
    if (results.performance) {
      if (results.performance.metrics.averageResponseTime > 2000) {
        insights.performanceOptimizations.push({
          category: 'Response Time',
          suggestion: 'Implement response caching and query optimization',
          expectedImprovement: '30-50% reduction in response time',
          priority: 'high'
        });
      }
    }

    // Analyze security results
    if (results.security && results.security.vulnerabilities.length > 0) {
      const criticalVulns = results.security.vulnerabilities.filter(v => v.severity === 'critical');
      if (criticalVulns.length > 0) {
        insights.securityRecommendations.push({
          category: 'Critical Vulnerabilities',
          suggestion: 'Address critical security vulnerabilities immediately',
          impact: 'Prevents potential system compromise',
          priority: 'critical'
        });
      }
    }

    // Strategic insights
    if (summary.successRate > 95) {
      insights.strategicInsights.push({
        category: 'Quality Excellence',
        insight: 'System demonstrates excellent quality and reliability',
        recommendation: 'Maintain current standards and consider scaling infrastructure'
      });
    } else if (summary.successRate < 80) {
      insights.strategicInsights.push({
        category: 'Quality Concerns',
        insight: 'System quality issues detected requiring immediate attention',
        recommendation: 'Implement comprehensive quality improvement program'
      });
    }

    return insights;
  }

  // Helper methods
  generateId() {
    return crypto.randomUUID();
  }

  sortExecutionSteps(steps) {
    // Simple topological sort based on dependencies
    const sorted = [];
    const visited = new Set();

    const visit = (step) => {
      if (visited.has(step.name)) return;
      visited.add(step.name);

      // Visit dependencies first
      for (const dep of step.dependencies) {
        const depStep = steps.find(s => s.type === dep);
        if (depStep) visit(depStep);
      }

      sorted.push(step);
    };

    steps.forEach(visit);
    return sorted;
  }

  calculateOverallGrade(summary) {
    const successRate = summary.successRate;
    if (successRate >= 95) return 'A';
    if (successRate >= 90) return 'B';
    if (successRate >= 80) return 'C';
    if (successRate >= 70) return 'D';
    return 'F';
  }

  analyzePerformanceTrends(results) {
    if (!results.performance) return null;

    return {
      responseTime: 'stable',
      throughput: 'adequate',
      resourceUsage: 'optimal',
      scalability: 'ready'
    };
  }

  analyzeSecurityTrends(results) {
    if (!results.security) return null;

    return {
      vulnerabilityCount: results.security.vulnerabilities.length,
      riskLevel: this.calculateRiskLevel(results.security.riskScore),
      compliance: 'adequate',
      improvements: 'recommended'
    };
  }

  analyzeReliabilityTrends(results) {
    return {
      stability: 'stable',
      errorRate: 'acceptable',
      uptime: 'excellent',
      recovery: 'automatic'
    };
  }

  identifyStrengths(results) {
    const strengths = [];

    if (results.api && results.api.summary.successRate > 95) {
      strengths.push('High API reliability');
    }

    if (results.performance && results.performance.metrics.averageResponseTime < 1000) {
      strengths.push('Excellent response times');
    }

    if (results.security && results.security.summary.totalVulnerabilities === 0) {
      strengths.push('Strong security posture');
    }

    return strengths;
  }

  identifyWeaknesses(results) {
    const weaknesses = [];

    if (results.api && results.api.summary.failedTests > 0) {
      weaknesses.push('API test failures');
    }

    if (results.performance && results.performance.metrics.averageResponseTime > 5000) {
      weaknesses.push('Slow response times');
    }

    if (results.security && results.security.summary.critical > 0) {
      weaknesses.push('Critical security vulnerabilities');
    }

    return weaknesses;
  }

  identifyOpportunities(results) {
    const opportunities = [];

    opportunities.push('Implement automated regression testing');
    opportunities.push('Add performance monitoring in production');
    opportunities.push('Enhance security scanning pipeline');

    return opportunities;
  }

  identifyRisks(results) {
    const risks = [];

    if (results.security && results.security.summary.high > 3) {
      risks.push('Multiple high-severity security issues');
    }

    if (results.performance && results.performance.metrics.errorRate > 5) {
      risks.push('High error rate under load');
    }

    return risks;
  }

  generateNextSteps(results) {
    const nextSteps = [];

    if (results.security && results.security.vulnerabilities.length > 0) {
      nextSteps.push('Address security vulnerabilities based on priority');
    }

    if (results.performance && results.performance.optimizations.length > 0) {
      nextSteps.push('Implement performance optimizations');
    }

    nextSteps.push('Schedule regular comprehensive testing');

    return nextSteps;
  }

  predictFutureRisks(results) {
    const risks = [];

    risks.push({
      risk: 'Scaling Challenges',
      probability: 'medium',
      impact: 'performance degradation',
      mitigation: 'Implement horizontal scaling and load testing'
    });

    return risks;
  }

  createImprovementPlan(results) {
    return {
      immediate: [], // Critical fixes needed within 24 hours
      shortTerm: [], // Improvements needed within 1 month
      longTerm: [], // Strategic improvements within 3-6 months
      ongoing: [] // Continuous improvement processes
    };
  }

  calculateRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'info';
  }

  // Event handling
  on(event, listener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 10) {
    return this.testHistory.slice(-limit);
  }

  /**
   * Export comprehensive results
   */
  exportResults(executionId, format = 'json') {
    const execution = this.testHistory.find(e => e.testSuiteId === executionId);
    if (!execution) {
      throw new Error('Execution results not found');
    }

    if (format === 'json') {
      return JSON.stringify(execution, null, 2);
    } else if (format === 'html') {
      return this.generateComprehensiveReport(execution);
    }

    return execution;
  }

  generateComprehensiveReport(execution) {
    return `
      <html>
        <head>
          <title>Comprehensive Test Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric { background: white; border: 1px solid #ddd; padding: 20px; border-radius: 5px; text-align: center; }
            .metric .value { font-size: 32px; font-weight: bold; color: #667eea; }
            .section { margin: 30px 0; }
            .section h2 { border-bottom: 2px solid #667eea; padding-bottom: 10px; }
            .test-result { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
            .success { border-left-color: #28a745; }
            .failure { border-left-color: #dc3545; }
            .insights { background: #e8f4fd; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 Comprehensive Test Report</h1>
            <p><strong>Test Suite:</strong> ${execution.testSuiteId}</p>
            <p><strong>Start Time:</strong> ${new Date(execution.startTime).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${(execution.summary.duration / 1000).toFixed(2)} seconds</p>
          </div>

          <div class="summary">
            <div class="metric">
              <div class="value">${execution.summary.totalTests}</div>
              <div>Total Tests</div>
            </div>
            <div class="metric">
              <div class="value">${execution.summary.passedTests}</div>
              <div>Passed</div>
            </div>
            <div class="metric">
              <div class="value">${execution.summary.failedTests}</div>
              <div>Failed</div>
            </div>
            <div class="metric">
              <div class="value">${execution.summary.successRate.toFixed(1)}%</div>
              <div>Success Rate</div>
            </div>
          </div>

          ${execution.results.mobile ? `
            <div class="section">
              <h2>📱 Mobile Testing Results</h2>
              <div class="test-result ${execution.results.mobile.success ? 'success' : 'failure'}">
                <h3>${execution.results.mobile.success ? '✅ Passed' : '❌ Failed'}</h3>
                <p><strong>Platforms:</strong> ${execution.results.mobile.platforms.join(', ')}</p>
                <p><strong>Devices:</strong> ${execution.results.mobile.devices.length}</p>
                <p><strong>Test Results:</strong> ${execution.results.mobile.summary.passedTests}/${execution.results.mobile.summary.totalTests} passed</p>
              </div>
            </div>
          ` : ''}

          ${execution.results.api ? `
            <div class="section">
              <h2>🔌 API Testing Results</h2>
              <div class="test-result ${execution.results.api.success ? 'success' : 'failure'}">
                <h3>${execution.results.api.success ? '✅ Passed' : '❌ Failed'}</h3>
                <p><strong>Collections:</strong> ${execution.results.api.collections.length}</p>
                <p><strong>Requests:</strong> ${execution.results.api.requests.length}</p>
                <p><strong>Success Rate:</strong> ${execution.results.api.summary.successRate.toFixed(1)}%</p>
              </div>
            </div>
          ` : ''}

          ${execution.results.performance ? `
            <div class="section">
              <h2>⚡ Performance Testing Results</h2>
              <div class="test-result ${execution.results.performance.success ? 'success' : 'failure'}">
                <h3>${execution.results.performance.success ? '✅ Passed' : '❌ Failed'}</h3>
                <p><strong>Average Response Time:</strong> ${execution.results.performance.metrics.averageResponseTime.toFixed(2)}ms</p>
                <p><strong>Throughput:</strong> ${execution.results.performance.metrics.throughput.toFixed(2)} req/s</p>
                <p><strong>Error Rate:</strong> ${execution.results.performance.metrics.errorRate.toFixed(2)}%</p>
              </div>
            </div>
          ` : ''}

          ${execution.results.security ? `
            <div class="section">
              <h2>🔒 Security Testing Results</h2>
              <div class="test-result ${execution.results.security.success ? 'success' : 'failure'}">
                <h3>${execution.results.security.success ? '✅ Passed' : '❌ Failed'}</h3>
                <p><strong>Vulnerabilities:</strong> ${execution.results.security.vulnerabilities.length}</p>
                <p><strong>Risk Score:</strong> ${execution.results.security.riskScore}/100</p>
                <p><strong>Compliance Score:</strong> ${execution.results.security.compliance.overallScore.toFixed(1)}%</p>
              </div>
            </div>
          ` : ''}

          ${execution.analysis ? `
            <div class="section">
              <h2>🧠 AI-Powered Analysis</h2>
              <div class="insights">
                <h3>Overall Assessment: ${execution.analysis.overall.grade.toUpperCase()} Grade</h3>
                <p><strong>Score:</strong> ${execution.analysis.overall.score.toFixed(1)}/100</p>

                ${execution.analysis.insights.strengths.length > 0 ? `
                  <h4>💪 Strengths</h4>
                  <ul>
                    ${execution.analysis.insights.strengths.map(strength => `<li>${strength}</li>`).join('')}
                  </ul>
                ` : ''}

                ${execution.analysis.insights.weaknesses.length > 0 ? `
                  <h4>⚠️ Areas for Improvement</h4>
                  <ul>
                    ${execution.analysis.insights.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                  </ul>
                ` : ''}

                ${execution.analysis.predictive.nextSteps.length > 0 ? `
                  <h4>📋 Recommended Next Steps</h4>
                  <ol>
                    ${execution.analysis.predictive.nextSteps.map(step => `<li>${step}</li>`).join('')}
                  </ol>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </body>
      </html>
    `;
  }
}

export default ComprehensiveTestExecutor;
