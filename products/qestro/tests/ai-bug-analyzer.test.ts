/**
 * Tests for AI Bug Analyzer Service
 * Covers failure classification, root cause analysis, pattern detection,
 * regression analysis, and integration scenarios
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { AIBugAnalyzer, type BugAnalysisRequest, type TestFailure } from '../../src/services/ai/bug-analyzer';
import { AIManager } from '../../src/services/ai/ai-manager';
import { AICostTracker } from '../../src/services/ai/cost-tracker';
import { AICacheManager } from '../../src/services/ai/cache-manager';

// Mock dependencies
vi.mock('../../src/services/ai/ai-manager');
vi.mock('../../src/services/ai/cost-tracker');
vi.mock('../../src/services/ai/cache-manager');

describe('AIBugAnalyzer', () => {
  let bugAnalyzer: AIBugAnalyzer;
  let mockAIManager: Mocked<AIManager>;
  let mockCostTracker: Mocked<AICostTracker>;
  let mockCacheManager: Mocked<AICacheManager>;

  beforeEach(() => {
    mockAIManager = new AIManager() as Mocked<AIManager>;
    mockCostTracker = new AICostTracker() as Mocked<AICostTracker>;
    mockCacheManager = new AICacheManager() as Mocked<AICacheManager>;

    vi.mocked(AIManager).mockImplementation(() => mockAIManager);
    vi.mocked(AICostTracker).mockImplementation(() => mockCostTracker);
    vi.mocked(AICacheManager).mockImplementation(() => mockCacheManager);

    bugAnalyzer = new AIBugAnalyzer();
  });

  describe('Failure Analysis', () => {
    it('should analyze single failure with comprehensive classification', async () => {
      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [createMockFailure()],
        analysisType: 'single_failure',
        priority: 'high'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].category).toBe('element_not_found');
      expect(result.rootCauseAnalysis.primaryCause.type).toBe('ui_element_missing');
      expect(result.suggestedFixes).toHaveLength(1);
      expect(result.suggestedFixes[0].type).toBe('code_fix');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle multiple related failures', async () => {
      const failures = [
        createMockFailure('timeout_error', 'Test timed out after 30 seconds'),
        createMockFailure('timeout_error', 'Element not found within timeout'),
        createMockFailure('element_not_found', 'Button not available')
      ];

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        analysisType: 'comprehensive',
        priority: 'high'
      };

      const mockAIResponse = createMockAIAnalysisResponse({
        classifications: [
          {
            failureId: failures[0].id,
            category: 'timeout_error',
            severity: 'high',
            subcategory: 'element_load_timeout',
            description: 'Test failed due to timeout waiting for UI element',
            symptoms: ['Test execution exceeded timeout limit', 'Element not available within expected time'],
            potentialCauses: ['Slow network connection', 'Element loading delay', 'Synchronization issue'],
            diagnosticSteps: ['Check network speed', 'Verify element loading', 'Review wait strategies'],
            confidence: 0.85,
            relatedFailures: [failures[1].id],
            tags: ['timeout', 'synchronization', 'ui']
          }
        ]
      });

      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].relatedFailures).toContain(failures[1].id);
      expect(result.summary.totalFailures).toBe(3);
      expect(result.summary.highFailures).toBeGreaterThan(0);
    });

    it('should use cached analysis when available', async () => {
      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [createMockFailure()],
        analysisType: 'single_failure',
        priority: 'medium'
      };

      const cachedResult = createMockBugAnalysisResult();
      mockCacheManager.get.mockResolvedValue({
        response: { content: JSON.stringify(cachedResult) }
      } as any);

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result).toEqual(cachedResult);
      expect(mockAIManager.executeRequest).not.toHaveBeenCalled();
      expect(mockCostTracker.trackUsage).not.toHaveBeenCalled();
    });
  });

  describe('Pattern Analysis', () => {
    it('should detect failure patterns across multiple failures', async () => {
      const failures = [
        createMockFailure('timeout_error', 'Timeout waiting for element'),
        createMockFailure('timeout_error', 'Timeout in network request'),
        createMockFailure('timeout_error', 'Page load timeout'),
        createMockFailure('assertion_failure', 'Expected value mismatch')
      ];

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        analysisType: 'pattern_analysis',
        priority: 'medium'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.patternAnalysis).toBeDefined();
      expect(result.patternAnalysis?.detectedPatterns).toHaveLength(1);
      expect(result.patternAnalysis?.detectedPatterns[0].pattern).toBe('multiple_timeout_error_failures');
      expect(result.patternAnalysis?.detectedPatterns[0].frequency).toBe(3);
      expect(result.patternAnalysis?.detectedPatterns[0].affectedTests).toHaveLength(3);
    });

    it('should analyze failure correlations', async () => {
      const failures = [
        createMockFailure('network_error', 'Connection refused'),
        createMockFailure('network_error', 'Connection timeout'),
        createMockFailure('authentication_error', 'Authentication failed')
      ];

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        analysisType: 'pattern_analysis',
        priority: 'medium'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.patternAnalysis?.failureCorrelations).toBeDefined();
      // Should detect correlation between similar network errors
      const networkCorrelations = result.patternAnalysis?.failureCorrelations.filter(
        c => c.description.includes('High similarity')
      );
      expect(networkCorrelations?.length).toBeGreaterThan(0);
    });

    it('should identify environment-specific patterns', async () => {
      const failures = [
        createMockFailure('timeout_error', 'Timeout in production'),
        createMockFailure('timeout_error', 'Timeout in staging'),
        createMockFailure('element_not_found', 'Element missing in production')
      ];

      // Set environment contexts
      failures[0].executionContext = { environment: 'production' };
      failures[1].executionContext = { environment: 'staging' };
      failures[2].executionContext = { environment: 'production' };

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        analysisType: 'pattern_analysis',
        priority: 'medium'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.patternAnalysis?.environmentPatterns).toBeDefined();
      const prodPattern = result.patternAnalysis?.environmentPatterns.find(
        p => p.environment === 'production'
      );
      expect(prodPattern).toBeDefined();
      expect(prodPattern?.failureRate).toBeGreaterThan(0);
    });
  });

  describe('Regression Analysis', () => {
    it('should detect regressions linked to recent changes', async () => {
      const failures = [createMockFailure()];
      const recentChange = new Date();
      recentChange.setHours(recentChange.getHours() - 2); // 2 hours ago

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome'],
          applicationType: 'web',
          recentChanges: [
            {
              type: 'code',
              description: 'Updated authentication flow',
              timestamp: recentChange
            }
          ]
        },
        analysisType: 'regression_detection',
        priority: 'high'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.regressionAnalysis).toBeDefined();
      expect(result.regressionAnalysis?.regressionDetected).toBe(true);
      expect(result.regressionAnalysis?.suspectedChanges).toHaveLength(1);
      expect(result.regressionAnalysis?.suspectedChanges[0].description).toBe('Updated authentication flow');
      expect(result.regressionAnalysis?.firstSeenFailure).toBeDefined();
    });

    it('should assess regression impact severity', async () => {
      const criticalFailure = createMockFailure('authentication_error', 'Auth system completely broken');
      criticalFailure.errorMessage = 'Critical authentication system failure';

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [criticalFailure],
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome'],
          applicationType: 'web'
        },
        analysisType: 'regression_detection',
        priority: 'critical'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.regressionAnalysis?.impactAssessment.severity).toBe('critical');
      expect(result.summary.criticalFailures).toBeGreaterThan(0);
    });
  });

  describe('Error Processing', () => {
    it('should clean error messages for better analysis', () => {
      const errorMessages = [
        '2023-12-01T10:30:00.123Z ERROR: Failed to connect to https://api.example.com/users',
        'Timeout occurred at /app/src/components/UserProfile.tsx:45:12',
        'Network error: Unable to reach 192.168.1.100:8080'
      ];

      errorMessages.forEach(message => {
        const cleaned = bugAnalyzer['cleanErrorMessage'](message);

        expect(cleaned).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
        expect(cleaned).not.toMatch(/https?:\/\/[^\s]+/);
        expect(cleaned).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        expect(cleaned).toContain('[TIMESTAMP]');
        expect(cleaned).toContain('[URL]');
        expect(cleaned).toContain('[IP]');
      });
    });

    it('should clean stack traces effectively', () => {
      const stackTrace = `
        at UserProfileComponent.render (/app/src/components/UserProfile.tsx:45:12)
        at mountComponent (/app/node_modules/react-dom/cjs/react-dom.development.js:1234:56)
        at Object../src/App.js (/app/src/App.js:78:34)
      `;

      const cleaned = bugAnalyzer['cleanStackTrace'](stackTrace);

      expect(cleaned).toContain('[FILE_LOCATION]');
      expect(cleaned).toContain('[FUNCTION_CALL]');
      expect(cleaned).not.toMatch(/\/[\w\/\.-]+:\d+:\d+/);
    });

    it('should infer error types from messages', () => {
      const testCases = [
        { message: 'Timeout waiting for element', expected: 'timeout_error' },
        { message: 'Unable to locate button', expected: 'element_not_found' },
        { message: 'Network connection failed', expected: 'network_error' },
        { message: 'Authentication required', expected: 'authentication_error' },
        { message: 'Expected value to be true', expected: 'assertion_failure' },
        { message: 'Unknown error occurred', expected: 'unknown' }
      ];

      testCases.forEach(({ message, expected }) => {
        const inferred = bugAnalyzer['inferErrorType'](message);
        expect(inferred).toBe(expected);
      });
    });
  });

  describe('Severity Assessment', () => {
    it('should correctly assess severity levels', () => {
      const testCases = [
        { failure: createMockFailure('timeout_error', 'Element timeout'), expected: 'medium' },
        { failure: createMockFailure('network_error', 'Connection failed'), expected: 'high' },
        { failure: createMockFailure('authentication_error', 'Auth failed'), expected: 'high' },
        { failure: createMockFailure('element_not_found', 'Button missing'), expected: 'medium' }
      ];

      testCases.forEach(({ failure, expected }) => {
        const severity = bugAnalyzer['determineSeverity'](failure);
        expect(severity).toBe(expected);
      });
    });

    it('should detect critical severity from error content', () => {
      const criticalFailure = createMockFailure('unknown', 'CRASH: Application crashed');
      const severity = bugAnalyzer['determineSeverity'](criticalFailure);
      expect(severity).toBe('critical');
    });
  });

  describe('Fallback Analysis', () => {
    it('should provide fallback analysis when AI parsing fails', async () => {
      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [createMockFailure()],
        analysisType: 'single_failure',
        priority: 'medium'
      };

      // Mock AI to return invalid response
      mockAIManager.executeRequest.mockResolvedValue({
        content: 'Invalid response that cannot be parsed as JSON',
        confidence: 0.5
      } as any);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      // Should still provide basic analysis
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].category).toBe('element_not_found');
      expect(result.rootCauseAnalysis.primaryCause.type).toBe('unknown');
      expect(result.suggestedFixes).toHaveLength(1);
      expect(result.suggestedFixes[0].title).toBe('Manual Investigation Required');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle comprehensive analysis with all features', async () => {
      const failures = [
        createMockFailure('timeout_error', 'Timeout in critical path'),
        createMockFailure('network_error', 'API connection failed'),
        createMockFailure('assertion_failure', 'Expected response different')
      ];

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome', 'firefox'],
          applicationType: 'web',
          recentChanges: [
            {
              type: 'code',
              description: 'Updated API endpoints',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            }
          ],
          environmentInfo: {
            browser: 'chrome',
            networkConditions: '3G'
          }
        },
        analysisType: 'comprehensive',
        priority: 'high',
        integrationSettings: {
          bugTracker: 'jira',
          autoCreateTickets: true,
          notificationSettings: {
            slack: '#test-failures'
          }
        }
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      // Verify all analysis components are present
      expect(result.classifications).toHaveLength(3);
      expect(result.patternAnalysis).toBeDefined();
      expect(result.regressionAnalysis).toBeDefined();
      expect(result.summary.totalFailures).toBe(3);
      expect(result.summary.severityDistribution).toBeDefined();
      expect(result.summary.recommendedImmediateActions).toBeDefined();
      expect(result.summary.recommendedLongTermActions).toBeDefined();
    });

    it('should analyze API test failures appropriately', async () => {
      const apiFailure = createMockFailure('api_error', 'API endpoint returned 500');
      apiFailure.testType = 'api';
      apiFailure.networkLogs = [
        {
          url: 'https://api.example.com/users',
          method: 'GET',
          status: 500,
          responseTime: 5000,
          error: 'Internal Server Error'
        }
      ];

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [apiFailure],
        projectContext: {
          framework: 'jest',
          targetPlatforms: ['node'],
          applicationType: 'api'
        },
        analysisType: 'single_failure',
        priority: 'high'
      };

      const mockAIResponse = createMockAIAnalysisResponse({
        classifications: [
          {
            failureId: apiFailure.id,
            category: 'api_error',
            severity: 'high',
            subcategory: 'server_error',
            description: 'API endpoint returned server error',
            symptoms: ['500 status code', 'Long response time'],
            potentialCauses: ['Server issue', 'Database problem', 'Configuration error'],
            diagnosticSteps: ['Check server logs', 'Verify database connection', 'Test endpoint manually'],
            confidence: 0.95,
            relatedFailures: [],
            tags: ['api', 'server', '500']
          }
        ]
      });

      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.classifications[0].category).toBe('api_error');
      expect(result.classifications[0].severity).toBe('high');
    });

    it('should handle mobile test failures with device-specific context', async () => {
      const mobileFailure = createMockFailure('element_not_found', 'Button not found on mobile');
      mobileFailure.testType = 'mobile';
      mobileFailure.platform = 'iOS';
      mobileFailure.executionContext = {
        deviceState: {
          model: 'iPhone 14',
          osVersion: '16.1',
          orientation: 'portrait'
        }
      };

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [mobileFailure],
        projectContext: {
          framework: 'maestro',
          targetPlatforms: ['iOS', 'Android'],
          applicationType: 'mobile'
        },
        analysisType: 'single_failure',
        priority: 'medium'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const result = await bugAnalyzer.analyzeFailures(request);

      expect(result.classifications[0].category).toBe('element_not_found');
      expect(result.classifications[0].tags).toContain('mobile');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large numbers of failures efficiently', async () => {
      const failures = Array.from({ length: 50 }, (_, i) =>
        createMockFailure('timeout_error', `Timeout in test ${i}`)
      );

      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures,
        analysisType: 'pattern_analysis',
        priority: 'medium'
      };

      const mockAIResponse = createMockAIAnalysisResponse();
      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);
      mockCacheManager.get.mockResolvedValue(null);
      mockCostTracker.trackUsage.mockResolvedValue();

      const startTime = Date.now();
      const result = await bugAnalyzer.analyzeFailures(request);
      const executionTime = Date.now() - startTime;

      expect(result.summary.totalFailures).toBe(50);
      expect(result.patternAnalysis?.detectedPatterns[0].frequency).toBe(50);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle AI service failures gracefully', async () => {
      const request: BugAnalysisRequest = {
        userId: 'user-123',
        projectId: 'project-456',
        failures: [createMockFailure()],
        analysisType: 'single_failure',
        priority: 'medium'
      };

      mockAIManager.executeRequest.mockRejectedValue(new Error('AI service unavailable'));
      mockCacheManager.get.mockResolvedValue(null);

      await expect(bugAnalyzer.analyzeFailures(request)).rejects.toThrow('Failed to analyze failures: AI service unavailable');
    });
  });
});

// Helper functions
function createMockFailure(errorType = 'element_not_found', errorMessage = 'Element not found'): TestFailure {
  return {
    id: `failure-${Math.random().toString(36).substr(2, 9)}`,
    testCaseId: `test-${Math.random().toString(36).substr(2, 9)}`,
    testName: 'Sample Test Case',
    testType: 'web',
    platform: 'chrome',
    failureTime: new Date(),
    errorMessage,
    errorType,
    stackTrace: 'Error: Element not found\\n    at Object.handleClick (/app/src/component.js:10:5)',
    screenshots: ['screenshot.png'],
    networkLogs: [
      {
        url: 'https://api.example.com/test',
        method: 'GET',
        status: 200,
        responseTime: 500
      }
    ],
    consoleLogs: [
      {
        level: 'error',
        message: 'Test failed',
        timestamp: new Date(),
        source: 'test-runner'
      }
    ],
    executionContext: {
      environment: 'test'
    },
    previousRuns: [
      {
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        status: 'passed',
        duration: 2000
      }
    ]
  };
}

function createMockAIAnalysisResponse(overrides: any = {}) {
  return {
    id: 'ai-response-123',
    content: JSON.stringify({
      classifications: overrides.classifications || [
        {
          failureId: 'failure-123',
          category: 'element_not_found',
          severity: 'medium',
          subcategory: 'ui_element_missing',
          description: 'UI element not found during test execution',
          symptoms: ['Element not present in DOM', 'Selector not matching'],
          potentialCauses: ['Element removed', 'Incorrect selector', 'Timing issue'],
          diagnosticSteps: ['Inspect DOM', 'Verify selector', 'Check timing'],
          confidence: 0.9,
          relatedFailures: [],
          tags: ['ui', 'selector', 'timing']
        }
      ],
      rootCauseAnalysis: {
        primaryCause: {
          type: 'ui_element_missing',
          description: 'UI element expected in test is not present in the application',
          likelihood: 0.85,
          evidence: ['Element not found in DOM', 'Previous test passed']
        },
        contributingFactors: [
          {
            factor: 'Application changes',
            impact: 'high',
            description: 'Recent application changes may have affected UI structure',
            evidence: ['Recent deployment detected']
          }
        ],
        affectedComponents: [
          {
            component: 'User Interface',
            impactLevel: 'high',
            description: 'UI components are not loading as expected'
          }
        ],
        reproductionSteps: ['Navigate to page', 'Wait for element', 'Attempt interaction'],
        investigationPath: [
          {
            step: 1,
            action: 'Inspect page DOM',
            expectedOutcome: 'Identify missing element',
            tools: ['Browser DevTools']
          }
        ],
        confidence: 0.85
      },
      suggestedFixes: overrides.suggestedFixes || [
        {
          type: 'code_fix',
          title: 'Update element selector',
          description: 'Update the test selector to match the current UI structure',
          priority: 'medium',
          effort: 'low',
          risk: 'low',
          codeChanges: [
            {
              file: 'tests/e2e/login.spec.js',
              line: 25,
              original: "await page.locator('#old-button').click();",
              fixed: "await page.locator('#new-button').click();",
              explanation: 'Update selector to match new button ID'
            }
          ],
          steps: ['Update selector', 'Run test verification'],
          verificationSteps: ['Run updated test', 'Confirm element interaction'],
          estimatedTimeToFix: 15,
          confidence: 0.9
        }
      ],
      summary: {
        totalFailures: 1,
        criticalFailures: 0,
        highFailures: 0,
        categories: {
          element_not_found: 1
        },
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 1,
          low: 0
        },
        recommendedImmediateActions: ['Update test selectors'],
        recommendedLongTermActions: ['Implement better element waiting strategies'],
        estimatedResolutionTime: 30,
        potentialImpact: {
          usersAffected: 0,
          featuresAffected: ['login'],
          revenueImpact: 'low'
        }
      }
    }),
    confidence: 0.9
  };
}

function createMockBugAnalysisResult() {
  return {
    id: 'analysis-123',
    requestId: 'req-123',
    analysisType: 'single_failure',
    failures: [createMockFailure()],
    classifications: [
      {
        failureId: 'failure-123',
        category: 'element_not_found',
        severity: 'medium',
        subcategory: 'ui_element_missing',
        description: 'UI element not found during test execution',
        symptoms: ['Element not present in DOM'],
        potentialCauses: ['Element removed'],
        diagnosticSteps: ['Inspect DOM'],
        confidence: 0.9,
        relatedFailures: [],
        tags: ['ui']
      }
    ],
    rootCauseAnalysis: {
      primaryCause: {
        type: 'ui_element_missing',
        description: 'UI element missing',
        likelihood: 0.85,
        evidence: []
      },
      contributingFactors: [],
      affectedComponents: [],
      reproductionSteps: [],
      investigationPath: [],
      confidence: 0.85
    },
    suggestedFixes: [
      {
        id: 'fix-123',
        type: 'code_fix',
        title: 'Update selector',
        description: 'Fix element selector',
        priority: 'medium',
        effort: 'low',
        risk: 'low',
        steps: ['Update selector'],
        verificationSteps: ['Run test'],
        estimatedTimeToFix: 15,
        confidence: 0.9
      }
    ],
    summary: {
      totalFailures: 1,
      criticalFailures: 0,
      highFailures: 0,
      categories: { element_not_found: 1 },
      severityDistribution: { critical: 0, high: 0, medium: 1, low: 0 },
      recommendedImmediateActions: ['Update selector'],
      recommendedLongTermActions: ['Improve selectors'],
      estimatedResolutionTime: 30,
      potentialImpact: {
        usersAffected: 0,
        featuresAffected: ['login'],
        revenueImpact: 'low'
      }
    },
    confidence: 0.9,
    analyzedAt: new Date()
  };
}
