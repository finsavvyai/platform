/**
 * AI Bug Analysis and Root Cause Detection Service
 *
 * Provides intelligent failure analysis, bug classification, and debugging assistance
 * with pattern recognition, root cause analysis, and automated fix suggestions.
 */

import { AIManager, AIRequest, AIRequestType } from './ai-manager';
import { AICostTracker } from './cost-tracker';
import { AICacheManager } from './cache-manager';

export interface BugAnalysisRequest {
  userId: string;
  projectId: string;
  failures: TestFailure[];
  projectContext?: {
    framework: string;
    targetPlatforms: string[];
    applicationType: 'mobile' | 'web' | 'api';
    recentChanges?: Array<{
      type: 'code' | 'config' | 'environment' | 'dependency';
      description: string;
      timestamp: Date;
    }>;
    environmentInfo?: {
      os?: string;
      browser?: string;
      device?: string;
      networkConditions?: string;
    };
  };
  analysisType: 'single_failure' | 'pattern_analysis' | 'regression_detection' | 'comprehensive';
  priority: 'low' | 'medium' | 'high' | 'critical';
  integrationSettings?: {
    bugTracker?: 'jira' | 'github' | 'gitlab' | 'azure';
    autoCreateTickets?: boolean;
    notificationSettings?: {
      slack?: string;
      email?: string;
      teams?: string;
    };
  };
}

export interface TestFailure {
  id: string;
  testCaseId: string;
  testName: string;
  testType: 'mobile' | 'web' | 'api';
  platform?: string;
  failureTime: Date;
  errorMessage: string;
  errorType?: string;
  stackTrace?: string;
  screenshots?: string[];
  networkLogs?: Array<{
    url: string;
    method: string;
    status: number;
    responseTime: number;
    error?: string;
  }>;
  consoleLogs?: Array<{
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    timestamp: Date;
    source?: string;
  }>;
  executionContext?: {
    testData?: any;
    environment?: string;
    deviceState?: any;
    browserState?: any;
  };
  previousRuns?: Array<{
    timestamp: Date;
    status: 'passed' | 'failed';
    error?: string;
    duration: number;
  }>;
  relatedFailures?: string[]; // IDs of related test failures
}

export interface BugAnalysisResult {
  id: string;
  requestId: string;
  analysisType: string;
  failures: TestFailure[];
  classifications: FailureClassification[];
  rootCauseAnalysis: RootCauseAnalysis;
  suggestedFixes: SuggestedFix[];
  patternAnalysis?: PatternAnalysis;
  regressionAnalysis?: RegressionAnalysis;
  relatedIssues?: RelatedIssue[];
  bugTickets?: BugTicket[];
  summary: AnalysisSummary;
  confidence: number;
  analyzedAt: Date;
}

export interface FailureClassification {
  failureId: string;
  category: FailureCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  subcategory: string;
  description: string;
  symptoms: string[];
  potentialCauses: string[];
  diagnosticSteps: string[];
  confidence: number;
  relatedFailures: string[];
  tags: string[];
}

export type FailureCategory =
  | 'assertion_failure'
  | 'timeout_error'
  | 'element_not_found'
  | 'network_error'
  | 'authentication_error'
  | 'data_validation_error'
  | 'environment_issue'
  | 'performance_issue'
  | 'synchronization_error'
  | 'configuration_error'
  | 'browser_compatibility'
  | 'device_specific'
  | 'api_error'
  | 'dependency_issue'
  | 'infrastructure_issue'
  | 'unknown';

export interface RootCauseAnalysis {
  primaryCause: {
    type: string;
    description: string;
    likelihood: number;
    evidence: string[];
  };
  contributingFactors: Array<{
    factor: string;
    impact: 'low' | 'medium' | 'high';
    description: string;
    evidence: string[];
  }>;
  affectedComponents: Array<{
    component: string;
    impactLevel: 'low' | 'medium' | 'high';
    description: string;
  }>;
  reproductionSteps: string[];
  investigationPath: Array<{
    step: number;
    action: string;
    expectedOutcome: string;
    tools: string[];
  }>;
  confidence: number;
}

export interface SuggestedFix {
  id: string;
  type: FixType;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  codeChanges?: Array<{
    file: string;
    line?: number;
    original: string;
    fixed: string;
    explanation: string;
  }>;
  configurationChanges?: Array<{
    config: string;
    key: string;
    currentValue: any;
    recommendedValue: any;
    explanation: string;
  }>;
  steps: string[];
  verificationSteps: string[];
  rollbackSteps?: string[];
  estimatedTimeToFix: number; // in minutes
  dependencies?: string[];
  confidence: number;
}

export type FixType =
  | 'code_fix'
  | 'configuration_update'
  | 'environment_fix'
  | 'test_modification'
  | 'infrastructure_change'
  | 'dependency_update'
  | 'data_fix'
  | 'wait_strategy'
  | 'assertion_update'
  | 'browser_compatibility';

export interface PatternAnalysis {
  detectedPatterns: Array<{
    pattern: string;
    description: string;
    frequency: number;
    affectedTests: string[];
    timeSpan: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  failureCorrelations: Array<{
    failure1: string;
    failure2: string;
    correlation: number;
    description: string;
  }>;
  environmentPatterns: Array<{
    environment: string;
    failureRate: number;
    commonFailures: string[];
    notes: string;
  }>;
  temporalPatterns: Array<{
    timePattern: string;
    description: string;
    likelyCause: string;
  }>;
}

export interface RegressionAnalysis {
  regressionDetected: boolean;
  suspectedChanges: Array<{
    changeType: string;
    description: string;
    likelihood: number;
    evidence: string[];
  }>;
  impactAssessment: {
    affectedFeatures: string[];
    affectedTests: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  firstSeenFailure?: Date;
  lastKnownGoodCommit?: string;
  recommendedActions: string[];
}

export interface RelatedIssue {
  id: string;
  source: 'jira' | 'github' | 'gitlab' | 'internal';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  similarity: number;
  url?: string;
  lastUpdated: Date;
}

export interface BugTicket {
  id: string;
  platform: 'jira' | 'github' | 'gitlab';
  ticketId: string;
  url: string;
  title: string;
  description: string;
  priority: string;
  severity: string;
  assignee?: string;
  labels: string[];
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: Date;
}

export interface AnalysisSummary {
  totalFailures: number;
  criticalFailures: number;
  highFailures: number;
  categories: Record<FailureCategory, number>;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendedImmediateActions: string[];
  recommendedLongTermActions: string[];
  estimatedResolutionTime: number; // in minutes
  potentialImpact: {
    usersAffected: number;
    featuresAffected: string[];
    revenueImpact?: string;
  };
}

export class AIBugAnalyzer {
  private aiManager: AIManager;
  private costTracker: AICostTracker;
  private cacheManager: AICacheManager;

  constructor() {
    this.aiManager = new AIManager();
    this.costTracker = new AICostTracker();
    this.cacheManager = new AICacheManager();
  }

  /**
   * Analyze test failures and provide comprehensive bug analysis
   */
  async analyzeFailures(request: BugAnalysisRequest): Promise<BugAnalysisResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheResult = await this.cacheManager.get({
        id: '',
        type: AIRequestType.GENERATE_TESTS,
        userId: request.userId,
        input: JSON.stringify(request),
        metadata: { analysisType: request.analysisType }
      });

      if (cacheResult?.response) {
        return JSON.parse(cacheResult.response.content);
      }

      // Preprocess failures for analysis
      const processedFailures = this.preprocessFailures(request.failures);

      // Generate AI analysis request
      const aiRequest = await this.buildAnalysisRequest(request, processedFailures);
      const aiResponse = await this.aiManager.executeRequest(aiRequest);

      // Parse and structure the analysis results
      const analysisResults = await this.parseAnalysisResults(
        aiResponse.content,
        request.failures
      );

      // Perform pattern analysis if requested
      let patternAnalysis: PatternAnalysis | undefined;
      if (request.analysisType === 'pattern_analysis' || request.analysisType === 'comprehensive') {
        patternAnalysis = await this.performPatternAnalysis(request.failures);
      }

      // Perform regression analysis if requested
      let regressionAnalysis: RegressionAnalysis | undefined;
      if (request.analysisType === 'regression_detection' || request.analysisType === 'comprehensive') {
        regressionAnalysis = await this.performRegressionAnalysis(request);
      }

      // Find related issues
      const relatedIssues = await this.findRelatedIssues(request, analysisResults.classifications);

      // Create bug tickets if integration is enabled
      let bugTickets: BugTicket[] = [];
      if (request.integrationSettings?.autoCreateTickets) {
        bugTickets = await this.createBugTickets(request, analysisResults);
      }

      const result: BugAnalysisResult = {
        id: `analysis_${Date.now()}`,
        requestId: aiRequest.id || '',
        analysisType: request.analysisType,
        failures: request.failures,
        ...analysisResults,
        patternAnalysis,
        regressionAnalysis,
        relatedIssues,
        bugTickets,
        confidence: aiResponse.confidence || 0.8,
        analyzedAt: new Date()
      };

      // Cache the result
      await this.cacheManager.set(aiRequest, {
        content: JSON.stringify(result),
        confidence: result.confidence,
        metadata: { analysisType: request.analysisType }
      });

      // Track usage
      await this.costTracker.trackUsage(aiRequest, aiResponse);

      console.log(`Bug analysis completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('Error analyzing failures:', error);
      throw new Error(`Failed to analyze failures: ${error.message}`);
    }
  }

  /**
   * Preprocess failures for better analysis
   */
  private preprocessFailures(failures: TestFailure[]): TestFailure[] {
    return failures.map(failure => ({
      ...failure,
      errorMessage: this.cleanErrorMessage(failure.errorMessage),
      stackTrace: failure.stackTrace ? this.cleanStackTrace(failure.stackTrace) : undefined,
      errorType: failure.errorType || this.inferErrorType(failure.errorMessage)
    }));
  }

  /**
   * Clean error message for better analysis
   */
  private cleanErrorMessage(errorMessage: string): string {
    // Remove timestamps, URLs, and other noise
    return errorMessage
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g, '[TIMESTAMP]')
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
      .trim();
  }

  /**
   * Clean stack trace for better analysis
   */
  private cleanStackTrace(stackTrace: string): string {
    // Remove file paths, line numbers, and other noise
    return stackTrace
      .replace(/\/[\w\/\.-]+:\d+:\d+/g, '[FILE_LOCATION]')
      .replace(/at \w+ \([\w\/\.-]+:\d+:\d+\)/g, '[FUNCTION_CALL]')
      .trim();
  }

  /**
   * Infer error type from error message
   */
  private inferErrorType(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout_error';
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('unable to locate')) {
      return 'element_not_found';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return 'network_error';
    }
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return 'authentication_error';
    }
    if (lowerMessage.includes('assert') || lowerMessage.includes('expected')) {
      return 'assertion_failure';
    }

    return 'unknown';
  }

  /**
   * Build AI analysis request
   */
  private async buildAnalysisRequest(
    request: BugAnalysisRequest,
    processedFailures: TestFailure[]
  ): Promise<AIRequest> {
    const prompt = this.buildAnalysisPrompt(request, processedFailures);

    return {
      id: `analysis_req_${Date.now()}`,
      type: AIRequestType.GENERATE_TESTS,
      userId: request.userId,
      input: prompt,
      context: {
        analysisType: request.analysisType,
        projectContext: request.projectContext,
        priority: request.priority
      },
      metadata: {
        failureCount: request.failures.length,
        analysisFocus: request.analysisType,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Build comprehensive analysis prompt for AI
   */
  private buildAnalysisPrompt(
    request: BugAnalysisRequest,
    processedFailures: TestFailure[]
  ): string {
    const failureDetails = processedFailures.map((failure, index) => `
FAILURE ${index + 1}:
ID: ${failure.id}
Test: ${failure.testName} (${failure.testType})
Platform: ${failure.platform || 'Unknown'}
Time: ${failure.failureTime.toISOString()}
Error Type: ${failure.errorType}
Severity: ${this.determineSeverity(failure)}
Message: ${failure.errorMessage}
${failure.stackTrace ? `Stack Trace: ${failure.stackTrace.substring(0, 500)}` : ''}
${failure.screenshots?.length ? `Screenshots: ${failure.screenshots.length} available` : ''}
${failure.networkLogs?.length ? `Network Logs: ${failure.networkLogs.length} entries` : ''}
${failure.consoleLogs?.length ? `Console Logs: ${failure.consoleLogs.length} entries` : ''}
${failure.previousRuns?.length ? `Previous Runs: ${failure.previousRuns.length} runs available` : ''}
Related Failures: ${failure.relatedFailures?.join(', ') || 'None'}
`).join('\n');

    const projectContext = request.projectContext ? `
PROJECT CONTEXT:
Framework: ${request.projectContext.framework}
Application Type: ${request.projectContext.applicationType}
Target Platforms: ${request.projectContext.targetPlatforms.join(', ')}
Recent Changes: ${request.projectContext.recentChanges?.map(c => `${c.type}: ${c.description}`).join('; ') || 'None'}
Environment: ${request.projectContext.environmentInfo ? JSON.stringify(request.projectContext.environmentInfo) : 'Standard'}
` : '';

    return `
You are an expert software debugging specialist and failure analysis expert. Analyze the following test failures and provide comprehensive bug analysis, root cause identification, and debugging assistance.

${projectContext}

ANALYSIS TYPE: ${request.analysisType}
PRIORITY: ${request.priority}

FAILURES TO ANALYZE:
${failureDetails}

ANALYSIS REQUIREMENTS:

1. **FAILURE CLASSIFICATION**:
   - Categorize each failure into specific types (timeout, element_not_found, network_error, etc.)
   - Assign severity levels based on impact and urgency
   - Identify symptoms and potential causes
   - Provide diagnostic steps for each failure

2. **ROOT CAUSE ANALYSIS**:
   - Identify the primary root cause with confidence levels
   - List contributing factors and their impact
   - Determine affected components and systems
   - Provide clear reproduction steps and investigation path

3. **SUGGESTED FIXES**:
   - Provide specific, actionable fix recommendations
   - Include code changes, configuration updates, or environmental fixes
   - Estimate effort, risk, and time to resolution
   - Include verification and rollback procedures

4. ${request.analysisType === 'pattern_analysis' || request.analysisType === 'comprehensive' ? '**PATTERN ANALYSIS**:\n   - Identify recurring failure patterns\n   - Find correlations between different failures\n   - Detect environment-specific patterns\n   - Analyze temporal patterns' : ''}

5. ${request.analysisType === 'regression_detection' || request.analysisType === 'comprehensive' ? '**REGRESSION ANALYSIS**:\n   - Identify if failures represent regressions\n   - Link failures to recent changes\n   - Assess impact on features and users\n   - Recommend containment actions' : ''}

RESPONSE FORMAT:
Provide a JSON response with the following structure:
{
  "classifications": [
    {
      "failureId": "failure-id",
      "category": "failure_category",
      "severity": "low|medium|high|critical",
      "subcategory": "specific subcategory",
      "description": "Detailed description",
      "symptoms": ["symptom1", "symptom2"],
      "potentialCauses": ["cause1", "cause2"],
      "diagnosticSteps": ["step1", "step2"],
      "confidence": 0.0-1.0,
      "relatedFailures": ["id1", "id2"],
      "tags": ["tag1", "tag2"]
    }
  ],
  "rootCauseAnalysis": {
    "primaryCause": {
      "type": "cause_type",
      "description": "Primary cause description",
      "likelihood": 0.0-1.0,
      "evidence": ["evidence1", "evidence2"]
    },
    "contributingFactors": [
      {
        "factor": "factor description",
        "impact": "low|medium|high",
        "description": "Factor description",
        "evidence": ["evidence1"]
      }
    ],
    "affectedComponents": [
      {
        "component": "component_name",
        "impactLevel": "low|medium|high",
        "description": "Impact description"
      }
    ],
    "reproductionSteps": ["step1", "step2"],
    "investigationPath": [
      {
        "step": 1,
        "action": "action to take",
        "expectedOutcome": "what to expect",
        "tools": ["tool1", "tool2"]
      }
    ],
    "confidence": 0.0-1.0
  },
  "suggestedFixes": [
    {
      "type": "code_fix|configuration_update|environment_fix|test_modification",
      "title": "Brief fix title",
      "description": "Detailed fix description",
      "priority": "low|medium|high|critical",
      "effort": "low|medium|high",
      "risk": "low|medium|high",
      "codeChanges": [{
        "file": "path/to/file",
        "line": 123,
        "original": "original code",
        "fixed": "fixed code",
        "explanation": "why this fixes the issue"
      }],
      "steps": ["step1", "step2"],
      "verificationSteps": ["verify1", "verify2"],
      "rollbackSteps": ["rollback1"],
      "estimatedTimeToFix": 30,
      "dependencies": ["dependency1"],
      "confidence": 0.0-1.0
    }
  ],
  "summary": {
    "totalFailures": number,
    "criticalFailures": number,
    "highFailures": number,
    "categories": {"timeout_error": 2, "element_not_found": 1},
    "severityDistribution": {"critical": 1, "high": 2, "medium": 3, "low": 1},
    "recommendedImmediateActions": ["action1", "action2"],
    "recommendedLongTermActions": ["action1", "action2"],
    "estimatedResolutionTime": 120,
    "potentialImpact": {
      "usersAffected": 1000,
      "featuresAffected": ["feature1", "feature2"],
      "revenueImpact": "high"
    }
  }
}

Focus on actionable insights with clear implementation steps. Consider the ${request.priority} priority level and provide solutions appropriate for the ${request.projectContext?.applicationType || 'unknown'} application type.
`;
  }

  /**
   * Determine severity based on failure characteristics
   */
  private determineSeverity(failure: TestFailure): 'low' | 'medium' | 'high' | 'critical' {
    // Critical failures
    if (failure.errorMessage.toLowerCase().includes('crash') ||
        failure.errorMessage.toLowerCase().includes('security') ||
        failure.errorMessage.toLowerCase().includes('data loss')) {
      return 'critical';
    }

    // High severity failures
    if (failure.errorType === 'authentication_error' ||
        failure.errorType === 'network_error' ||
        failure.testType === 'api') {
      return 'high';
    }

    // Medium severity failures
    if (failure.errorType === 'timeout_error' ||
        failure.errorType === 'element_not_found') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Parse analysis results from AI response
   */
  private async parseAnalysisResults(
    aiResponse: string,
    failures: TestFailure[]
  ): Promise<Pick<BugAnalysisResult, 'classifications' | 'rootCauseAnalysis' | 'suggestedFixes' | 'summary'>> {
    try {
      const response = JSON.parse(aiResponse);

      if (!response.classifications || !response.rootCauseAnalysis || !response.suggestedFixes) {
        throw new Error('Invalid AI response format');
      }

      return {
        classifications: response.classifications,
        rootCauseAnalysis: response.rootCauseAnalysis,
        suggestedFixes: response.suggestedFixes,
        summary: response.summary
      };

    } catch (error) {
      console.error('Error parsing analysis results:', error);

      // Fallback: generate basic analysis
      return this.generateFallbackAnalysis(failures);
    }
  }

  /**
   * Generate fallback analysis when AI parsing fails
   */
  private generateFallbackAnalysis(failures: TestFailure[]): Pick<BugAnalysisResult, 'classifications' | 'rootCauseAnalysis' | 'suggestedFixes' | 'summary'> {
    const classifications = failures.map(failure => ({
      failureId: failure.id,
      category: this.inferErrorType(failure.errorMessage) as FailureCategory,
      severity: this.determineSeverity(failure),
      subcategory: 'unclassified',
      description: `Failed in test: ${failure.testName}`,
      symptoms: [failure.errorMessage],
      potentialCauses: ['Unknown - requires manual investigation'],
      diagnosticSteps: ['Review error logs', 'Check test environment'],
      confidence: 0.5,
      relatedFailures: failure.relatedFailures || [],
      tags: [failure.testType, failure.errorType || 'unknown']
    }));

    const criticalFailures = classifications.filter(c => c.severity === 'critical').length;
    const highFailures = classifications.filter(c => c.severity === 'high').length;

    const categories = classifications.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<FailureCategory, number>);

    const severityDistribution = {
      critical: classifications.filter(c => c.severity === 'critical').length,
      high: classifications.filter(c => c.severity === 'high').length,
      medium: classifications.filter(c => c.severity === 'medium').length,
      low: classifications.filter(c => c.severity === 'low').length
    };

    return {
      classifications,
      rootCauseAnalysis: {
        primaryCause: {
          type: 'unknown',
          description: 'Unable to determine primary cause automatically',
          likelihood: 0.5,
          evidence: []
        },
        contributingFactors: [],
        affectedComponents: [],
        reproductionSteps: ['Run test again', 'Check logs', 'Investigate environment'],
        investigationPath: [{
          step: 1,
          action: 'Review failure logs',
          expectedOutcome: 'Identify error patterns',
          tools: ['Log analyzer']
        }],
        confidence: 0.5
      },
      suggestedFixes: [{
        id: `fallback_fix_${Date.now()}`,
        type: 'test_modification',
        title: 'Manual Investigation Required',
        description: 'This failure requires manual investigation to determine the appropriate fix',
        priority: 'medium',
        effort: 'medium',
        risk: 'low',
        steps: ['Investigate failure', 'Identify root cause', 'Implement fix', 'Verify resolution'],
        verificationSteps: ['Run test', 'Check functionality'],
        estimatedTimeToFix: 60,
        confidence: 0.5
      }],
      summary: {
        totalFailures: failures.length,
        criticalFailures,
        highFailures,
        categories,
        severityDistribution,
        recommendedImmediateActions: ['Review critical failures', 'Check system status'],
        recommendedLongTermActions: ['Improve error handling', 'Add more tests'],
        estimatedResolutionTime: 120,
        potentialImpact: {
          usersAffected: 0,
          featuresAffected: [],
          revenueImpact: 'unknown'
        }
      }
    };
  }

  /**
   * Perform pattern analysis on failures
   */
  private async performPatternAnalysis(failures: TestFailure[]): Promise<PatternAnalysis> {
    // Detect failure patterns
    const patterns = this.detectFailurePatterns(failures);

    // Analyze failure correlations
    const correlations = this.analyzeFailureCorrelations(failures);

    // Identify environment-specific patterns
    const environmentPatterns = this.identifyEnvironmentPatterns(failures);

    // Analyze temporal patterns
    const temporalPatterns = this.analyzeTemporalPatterns(failures);

    return {
      detectedPatterns: patterns,
      failureCorrelations: correlations,
      environmentPatterns,
      temporalPatterns
    };
  }

  /**
   * Detect failure patterns
   */
  private detectFailurePatterns(failures: TestFailure[]): Array<{
    pattern: string;
    description: string;
    frequency: number;
    affectedTests: string[];
    timeSpan: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const patterns = [];

    // Group by error type
    const errorTypeGroups = failures.reduce((groups, failure) => {
      const type = failure.errorType || 'unknown';
      groups[type] = groups[type] || [];
      groups[type].push(failure);
      return groups;
    }, {} as Record<string, TestFailure[]>);

    Object.entries(errorTypeGroups).forEach(([type, group]) => {
      if (group.length > 1) {
        patterns.push({
          pattern: `multiple_${type}_failures`,
          description: `Multiple failures of type: ${type}`,
          frequency: group.length,
          affectedTests: group.map(f => f.testCaseId),
          timeSpan: this.calculateTimeSpan(group),
          trend: this.calculateTrend(group)
        });
      }
    });

    return patterns;
  }

  /**
   * Analyze failure correlations
   */
  private analyzeFailureCorrelations(failures: TestFailure[]): Array<{
    failure1: string;
    failure2: string;
    correlation: number;
    description: string;
  }> {
    const correlations = [];

    // Simple correlation based on similar error messages and timing
    for (let i = 0; i < failures.length; i++) {
      for (let j = i + 1; j < failures.length; j++) {
        const failure1 = failures[i];
        const failure2 = failures[j];

        const similarity = this.calculateFailureSimilarity(failure1, failure2);
        if (similarity > 0.7) {
          correlations.push({
            failure1: failure1.id,
            failure2: failure2.id,
            correlation: similarity,
            description: `High similarity between failures: ${failure1.testName} and ${failure2.testName}`
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Identify environment-specific patterns
   */
  private identifyEnvironmentPatterns(failures: TestFailure[]): Array<{
    environment: string;
    failureRate: number;
    commonFailures: string[];
    notes: string;
  }> {
    const environments = failures.reduce((envs, failure) => {
      const env = failure.executionContext?.environment || 'unknown';
      envs[env] = envs[env] || [];
      envs[env].push(failure);
      return envs;
    }, {} as Record<string, TestFailure[]>);

    return Object.entries(environments).map(([env, envFailures]) => ({
      environment: env,
      failureRate: envFailures.length / failures.length,
      commonFailures: envFailures.map(f => f.errorType || 'unknown'),
      notes: envFailures.length > failures.length * 0.3 ?
        'High failure rate in this environment' :
        'Normal failure rate'
    }));
  }

  /**
   * Analyze temporal patterns
   */
  private analyzeTemporalPatterns(failures: TestFailure[]): Array<{
    timePattern: string;
    description: string;
    likelyCause: string;
  }> {
    const patterns = [];

    // Group failures by time of day
    const timeGroups = failures.reduce((groups, failure) => {
      const hour = failure.failureTime.getHours();
      const timeSlot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      groups[timeSlot] = groups[timeSlot] || [];
      groups[timeSlot].push(failure);
      return groups;
    }, {} as Record<string, TestFailure[]>);

    Object.entries(timeGroups).forEach(([timeSlot, group]) => {
      if (group.length > failures.length * 0.3) {
        patterns.push({
          timePattern: timeSlot,
          description: `Higher failure rate during ${timeSlot}`,
          likelyCause: timeSlot === 'morning' ? 'System maintenance or deployments' :
                       timeSlot === 'afternoon' ? 'High load or resource contention' :
                       'Backup processes or cron jobs'
        });
      }
    });

    return patterns;
  }

  /**
   * Perform regression analysis
   */
  private async performRegressionAnalysis(request: BugAnalysisRequest): Promise<RegressionAnalysis> {
    const recentChanges = request.projectContext?.recentChanges || [];
    const failures = request.failures;

    // Check if failures started after recent changes
    const firstFailure = failures.reduce((earliest, failure) =>
      failure.failureTime < earliest.failureTime ? failure : earliest
    );

    const suspectedChanges = recentChanges
      .filter(change => new Date(change.timestamp) >= firstFailure.failureTime)
      .map(change => ({
        changeType: change.type,
        description: change.description,
        likelihood: 0.7, // Default likelihood
        evidence: [`Change occurred at ${change.timestamp}`, `First failure at ${firstFailure.failureTime}`]
      }));

    const affectedTests = failures.map(f => f.testCaseId);
    const affectedFeatures = [...new Set(failures.map(f => f.testName.split(' ')[0]))];

    return {
      regressionDetected: suspectedChanges.length > 0,
      suspectedChanges,
      impactAssessment: {
        affectedFeatures,
        affectedTests,
        severity: this.assessRegressionSeverity(failures)
      },
      firstSeenFailure: firstFailure.failureTime,
      recommendedActions: suspectedChanges.length > 0 ?
        ['Review recent changes', 'Consider rollback', 'Investigate impact'] :
        ['Monitor for patterns', 'Check system health']
    };
  }

  /**
   * Find related issues from external systems
   */
  private async findRelatedIssues(
    request: BugAnalysisRequest,
    classifications: FailureClassification[]
  ): Promise<RelatedIssue[]> {
    // This would integrate with external bug tracking systems
    // For now, return empty array
    return [];
  }

  /**
   * Create bug tickets in external systems
   */
  private async createBugTickets(
    request: BugAnalysisRequest,
    analysisResults: Pick<BugAnalysisResult, 'classifications' | 'rootCauseAnalysis' | 'suggestedFixes' | 'summary'>
  ): Promise<BugTicket[]> {
    // This would integrate with Jira, GitHub, etc.
    // For now, return empty array
    return [];
  }

  // Helper methods
  private calculateTimeSpan(failures: TestFailure[]): string {
    if (failures.length < 2) return 'single occurrence';

    const earliest = new Date(Math.min(...failures.map(f => f.failureTime.getTime())));
    const latest = new Date(Math.max(...failures.map(f => f.failureTime.getTime())));
    const hours = Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60));

    return hours < 24 ? `${hours} hours` : `${Math.round(hours / 24)} days`;
  }

  private calculateTrend(failures: TestFailure[]): 'increasing' | 'decreasing' | 'stable' {
    if (failures.length < 3) return 'stable';

    const sortedFailures = failures.sort((a, b) => a.failureTime.getTime() - b.failureTime.getTime());
    const firstHalf = sortedFailures.slice(0, Math.floor(sortedFailures.length / 2));
    const secondHalf = sortedFailures.slice(Math.floor(sortedFailures.length / 2));

    return secondHalf.length > firstHalf.length ? 'increasing' :
           secondHalf.length < firstHalf.length ? 'decreasing' : 'stable';
  }

  private calculateFailureSimilarity(failure1: TestFailure, failure2: TestFailure): number {
    let similarity = 0;

    // Error type similarity
    if (failure1.errorType === failure2.errorType) similarity += 0.3;

    // Error message similarity (simplified)
    const words1 = failure1.errorMessage.toLowerCase().split(' ');
    const words2 = failure2.errorMessage.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    similarity += (commonWords.length / Math.max(words1.length, words2.length)) * 0.4;

    // Test type similarity
    if (failure1.testType === failure2.testType) similarity += 0.2;

    // Platform similarity
    if (failure1.platform === failure2.platform) similarity += 0.1;

    return Math.min(similarity, 1);
  }

  private assessRegressionSeverity(failures: TestFailure[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = failures.filter(f => this.determineSeverity(f) === 'critical').length;
    const highCount = failures.filter(f => this.determineSeverity(f) === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > failures.length * 0.5) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }
}
