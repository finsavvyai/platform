/**
 * Comprehensive Error Handling System
 * Revolutionary error management with AI-powered analysis, recovery, and prevention
 */

import type { Env } from '../types';

export interface ErrorContext {
  request_id: string;
  user_id?: string;
  organization_id?: string;
  session_id?: string;
  product?: string;
  route?: string;
  method?: string;
  user_agent?: string;
  ip_address?: string;
  timestamp: string;
  environment: string;
  memory_usage?: number;
  cpu_usage?: number;
}

export interface ErrorInfo {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  code?: string;
  details?: any;
  stack?: string;
  context: ErrorContext;
  cause?: ErrorInfo;
  recoverable: boolean;
  user_friendly: boolean;
  retry_count: number;
  max_retries?: number;
  next_retry_after?: number;
  recovery_strategies?: RecoveryStrategy[];
  prevention_recommendations?: string[];
  ai_analysis?: AIErrorAnalysis;
}

export type ErrorType =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_API_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'BUSINESS_LOGIC_ERROR'
  | 'SYSTEM_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ErrorCategory =
  | 'USER_INPUT'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'BUSINESS_LOGIC'
  | 'EXTERNAL_DEPENDENCY'
  | 'SYSTEM_INFRASTRUCTURE'
  | 'DATA_INTEGRITY'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'AI_PROCESSING'
  | 'COMPLIANCE';

export interface RecoveryStrategy {
  name: string;
  description: string;
  action: () => Promise<boolean>;
  priority: number;
  success_rate: number;
  estimated_time: number;
  prerequisites: string[];
}

export interface AIErrorAnalysis {
  root_cause: string;
  confidence: number;
  impact_assessment: string;
  prevention_strategies: string[];
  related_errors: string[];
  learning_opportunities: string[];
  automation_potential: number;
  recommended_actions: string[];
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  severity_distribution: Record<ErrorSeverity, number>;
  common_causes: string[];
  effective_solutions: string[];
  last_occurrence: string;
  prevention_implemented: boolean;
}

export interface ErrorMetrics {
  total_errors: number;
  errors_by_type: Record<ErrorType, number>;
  errors_by_severity: Record<ErrorSeverity, number>;
  errors_by_category: Record<ErrorCategory, number>;
  recovery_rate: number;
  average_recovery_time: number;
  ai_analysis_accuracy: number;
  user_impact_score: number;
  trends: {
    daily: Array<{ date: string; count: number; severity: string }>;
    hourly: Array<{ hour: string; count: number; type: string }>;
  };
}

/**
 * Revolutionary Error Handler with AI-powered analysis and adaptive learning
 */
export class ErrorHandler {
  private env: Env;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorMetrics: ErrorMetrics;
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy[]> = new Map();
  private aiAnalysisCache: Map<string, AIErrorAnalysis> = new Map();
  private errorHistory: Map<string, ErrorInfo[]> = new Map();

  constructor(env: Env) {
    this.env = env;
    this.errorMetrics = {
      total_errors: 0,
      errors_by_type: {} as Record<ErrorType, number>,
      errors_by_severity: {} as Record<ErrorSeverity, number>,
      errors_by_category: {} as Record<ErrorCategory, number>,
      recovery_rate: 0,
      average_recovery_time: 0,
      ai_analysis_accuracy: 0.8,
      user_impact_score: 0,
      trends: {
        daily: [],
        hourly: []
      }
    };

    this.initializeRecoveryStrategies();
    this.loadErrorPatterns();
  }

  /**
   * Handle and analyze an error
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    options: {
      customMessage?: string;
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      recoverable?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<ErrorInfo> {
    const errorInfo = await this.createErrorInfo(error, context, options);

    // Update metrics
    this.updateMetrics(errorInfo);

    // Analyze with AI if available
    if (this.env.AI && errorInfo.severity !== 'LOW') {
      await this.analyzeWithAI(errorInfo);
    }

    // Check for patterns
    await this.detectPatterns(errorInfo);

    // Store error for learning
    await this.storeError(errorInfo);

    // Notify if critical
    if (errorInfo.severity === 'CRITICAL') {
      await this.notifyCriticalError(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Create structured error information
   */
  private async createErrorInfo(
    error: Error,
    context: ErrorContext,
    options: any
  ): Promise<ErrorInfo> {
    const errorType = this.classifyError(error);
    const severity = options.severity || this.determineSeverity(errorType, error);
    const category = options.category || this.determineCategory(errorType, context);

    return {
      id: `error_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`,
      type: errorType,
      severity,
      category,
      message: options.customMessage || error.message,
      code: (error as any).code,
      details: this.extractErrorDetails(error),
      stack: error.stack,
      context,
      recoverable: options.recoverable !== false && this.isRecoverable(errorType),
      user_friendly: this.isUserFriendly(errorType, severity),
      retry_count: 0,
      max_retries: options.maxRetries || this.getMaxRetries(errorType),
      recovery_strategies: this.getRecoveryStrategies(errorType),
      prevention_recommendations: []
    };
  }

  /**
   * Classify error type based on error characteristics
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.constructor.name.toLowerCase();

    // Database errors
    if (message.includes('database') || message.includes('sql') || name.includes('database')) {
      return 'DATABASE_ERROR';
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }

    // Authentication/Authorization
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('authentication')) {
      return message.includes('unauthorized') ? 'AUTHENTICATION_ERROR' : 'AUTHORIZATION_ERROR';
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT_EXCEEDED';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || name.includes('zod')) {
      return 'VALIDATION_ERROR';
    }

    // External API errors
    if (message.includes('api') || message.includes('external')) {
      return 'EXTERNAL_API_ERROR';
    }

    // AI service errors
    if (message.includes('ai') || message.includes('model') || message.includes('inference')) {
      return 'AI_SERVICE_ERROR';
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }

    // System errors
    if (name.includes('system') || message.includes('internal')) {
      return 'SYSTEM_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(errorType: ErrorType, error: Error): ErrorSeverity {
    const criticalErrors = ['DATABASE_ERROR', 'SYSTEM_ERROR', 'SECURITY'];
    const highErrors = ['AI_SERVICE_ERROR', 'EXTERNAL_API_ERROR', 'TIMEOUT_ERROR'];
    const mediumErrors = ['BUSINESS_LOGIC_ERROR', 'CONFIGURATION_ERROR'];
    const lowErrors = ['VALIDATION_ERROR', 'RESOURCE_NOT_FOUND'];

    if (criticalErrors.includes(errorType)) return 'CRITICAL';
    if (highErrors.includes(errorType)) return 'HIGH';
    if (mediumErrors.includes(errorType)) return 'MEDIUM';
    if (lowErrors.includes(errorType)) return 'LOW';

    // Check error message for severity indicators
    const message = error.message.toLowerCase();
    if (message.includes('critical') || message.includes('severe')) return 'CRITICAL';
    if (message.includes('warning') || message.includes('deprecated')) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Determine error category
   */
  private determineCategory(errorType: ErrorType, context: ErrorContext): ErrorCategory {
    switch (errorType) {
      case 'AUTHENTICATION_ERROR':
      case 'AUTHORIZATION_ERROR':
        return 'AUTHENTICATION';
      case 'VALIDATION_ERROR':
        return 'USER_INPUT';
      case 'DATABASE_ERROR':
        return 'DATA_INTEGRITY';
      case 'EXTERNAL_API_ERROR':
      case 'AI_SERVICE_ERROR':
        return 'EXTERNAL_DEPENDENCY';
      case 'SYSTEM_ERROR':
      case 'CONFIGURATION_ERROR':
        return 'SYSTEM_INFRASTRUCTURE';
      case 'RATE_LIMIT_EXCEEDED':
        return 'SECURITY';
      case 'TIMEOUT_ERROR':
      case 'NETWORK_ERROR':
        return 'PERFORMANCE';
      default:
        return 'BUSINESS_LOGIC';
    }
  }

  /**
   * Extract detailed error information
   */
  private extractErrorDetails(error: Error): any {
    const details: any = {
      name: error.name,
      message: error.message
    };

    // Add stack trace if available
    if (error.stack) {
      details.stack_trace = error.stack.split('\n').slice(0, 10); // Limit stack trace
    }

    // Add custom properties if they exist
    if ((error as any).code) details.code = (error as any).code;
    if ((error as any).status) details.http_status = (error as any).status;
    if ((error as any).path) details.path = (error as any).path;

    return details;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(errorType: ErrorType): boolean {
    const recoverableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'EXTERNAL_API_ERROR'
    ];

    return recoverableErrors.includes(errorType);
  }

  /**
   * Check if error is user-friendly
   */
  private isUserFriendly(errorType: ErrorType, severity: ErrorSeverity): boolean {
    const userFriendlyErrors = [
      'VALIDATION_ERROR',
      'RESOURCE_NOT_FOUND',
      'RATE_LIMIT_EXCEEDED'
    ];

    return userFriendlyErrors.includes(errorType) || severity === 'LOW';
  }

  /**
   * Get maximum retry count for error type
   */
  private getMaxRetries(errorType: ErrorType): number {
    const retryMap: Record<ErrorType, number> = {
      'NETWORK_ERROR': 3,
      'TIMEOUT_ERROR': 2,
      'EXTERNAL_API_ERROR': 2,
      'RATE_LIMIT_EXCEEDED': 1,
      'AI_SERVICE_ERROR': 1,
      'DATABASE_ERROR': 1,
      'SYSTEM_ERROR': 0,
      'UNKNOWN_ERROR': 0
    };

    return retryMap[errorType] || 0;
  }

  /**
   * Analyze error with AI to get insights
   */
  private async analyzeWithAI(errorInfo: ErrorInfo): Promise<void> {
    const cacheKey = `${errorInfo.type}_${errorInfo.message.substring(0, 100)}`;

    // Check cache first
    if (this.aiAnalysisCache.has(cacheKey)) {
      errorInfo.ai_analysis = this.aiAnalysisCache.get(cacheKey);
      return;
    }

    try {
      const analysisPrompt = `Analyze this error and provide insights:

Error Type: ${errorInfo.type}
Error Severity: ${errorInfo.severity}
Error Category: ${errorInfo.category}
Error Message: ${errorInfo.message}
Context: ${JSON.stringify(errorInfo.context, null, 2)}

Return JSON with:
- root_cause: most likely cause of the error
- confidence: 0-1
- impact_assessment: business impact description
- prevention_strategies: array of prevention strategies
- related_errors: array of related error types
- learning_opportunities: array of learning opportunities
- automation_potential: 0-1 (can this be prevented with automation)
- recommended_actions: array of specific recommended actions`;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.2,
        max_tokens: 500
      });

      if (response?.response) {
        const analysis = JSON.parse(response.response);

        const aiAnalysis: AIErrorAnalysis = {
          root_cause: analysis.root_cause || 'Unknown',
          confidence: analysis.confidence || 0.5,
          impact_assessment: analysis.impact_assessment || 'Unknown',
          prevention_strategies: analysis.prevention_strategies || [],
          related_errors: analysis.related_errors || [],
          learning_opportunities: analysis.learning_opportunities || [],
          automation_potential: analysis.automation_potential || 0,
          recommended_actions: analysis.recommended_actions || []
        };

        errorInfo.ai_analysis = aiAnalysis;
        this.aiAnalysisCache.set(cacheKey, aiAnalysis);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  }

  /**
   * Detect patterns in errors
   */
  private async detectPatterns(errorInfo: ErrorInfo): Promise<void> {
    const patternKey = `${errorInfo.type}_${errorInfo.message.substring(0, 50)}`;

    if (this.errorPatterns.has(patternKey)) {
      const pattern = this.errorPatterns.get(patternKey)!;
      pattern.frequency++;
      pattern.last_occurrence = errorInfo.context.timestamp;

      // Update pattern severity distribution
      pattern.severity_distribution[errorInfo.severity] =
        (pattern.severity_distribution[errorInfo.severity] || 0) + 1;

      // Check if this is a recurring pattern that needs attention
      if (pattern.frequency > 5 && !pattern.prevention_implemented) {
        await this.notifyPatternAlert(pattern, errorInfo);
      }
    } else {
      // Create new pattern
      const pattern: ErrorPattern = {
        pattern: patternKey,
        frequency: 1,
        severity_distribution: { [errorInfo.severity]: 1 },
        common_causes: [],
        effective_solutions: [],
        last_occurrence: errorInfo.context.timestamp,
        prevention_implemented: false
      };

      this.errorPatterns.set(patternKey, pattern);
    }
  }

  /**
   * Store error for learning and analysis
   */
  private async storeError(errorInfo: ErrorInfo): Promise<void> {
    const contextKey = errorInfo.context.organization_id || 'global';

    if (!this.errorHistory.has(contextKey)) {
      this.errorHistory.set(contextKey, []);
    }

    const history = this.errorHistory.get(contextKey)!;
    history.push(errorInfo);

    // Keep only last 1000 errors
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Store in KV for persistence
    try {
      await this.env.AGENT_MEMORY.put(
        `error_${contextKey}_${errorInfo.id}`,
        JSON.stringify(errorInfo),
        { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
      );
    } catch (error) {
      console.error('Failed to store error:', error);
    }
  }

  /**
   * Notify about critical errors
   */
  private async notifyCriticalError(errorInfo: ErrorInfo): Promise<void> {
    const notification = {
      alert_type: 'critical_error',
      error_id: errorInfo.id,
      error_type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      context: errorInfo.context,
      timestamp: new Date().toISOString(),
      user_impact: await this.calculateUserImpact(errorInfo)
    };

    // Send to monitoring service
    if (this.env.MONITORING_WEBHOOK) {
      try {
        await fetch(this.env.MONITORING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error) {
        console.error('Failed to send critical error notification:', error);
      }
    }

    // Log critical error
    console.error('🚨 CRITICAL ERROR:', notification);
  }

  /**
   * Notify about detected patterns
   */
  private async notifyPatternAlert(pattern: ErrorPattern, errorInfo: ErrorInfo): Promise<void> {
    const alert = {
      alert_type: 'recurring_pattern',
      pattern: pattern.pattern,
      frequency: pattern.frequency,
      severity_distribution: pattern.severity_distribution,
      last_error: errorInfo,
      timestamp: new Date().toISOString(),
      recommendations: pattern.effective_solutions
    };

    if (this.env.MONITORING_WEBHOOK) {
      try {
        await fetch(this.env.MONITORING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
      } catch (error) {
        console.error('Failed to send pattern alert:', error);
      }
    }

    console.warn('⚠️ RECURRING PATTERN DETECTED:', alert);
  }

  /**
   * Calculate user impact score
   */
  private async calculateUserImpact(errorInfo: ErrorInfo): Promise<number> {
    let impact = 0;

    // Severity impact
    const severityScores = {
      'LOW': 0.1,
      'MEDIUM': 0.3,
      'HIGH': 0.7,
      'CRITICAL': 1.0
    };
    impact += severityScores[errorInfo.severity];

    // User-friendliness reduces impact
    if (errorInfo.user_friendly) {
      impact *= 0.5;
    }

    // Recoverability reduces impact
    if (errorInfo.recoverable) {
      impact *= 0.3;
    }

    return Math.min(1.0, impact);
  }

  /**
   * Update error metrics
   */
  private updateMetrics(errorInfo: ErrorInfo): void {
    this.errorMetrics.total_errors++;

    // Update type counts
    this.errorMetrics.errors_by_type[errorInfo.type] =
      (this.errorMetrics.errors_by_type[errorInfo.type] || 0) + 1;

    // Update severity counts
    this.errorMetrics.errors_by_severity[errorInfo.severity] =
      (this.errorMetrics.errors_by_severity[errorInfo.severity] || 0) + 1;

    // Update category counts
    this.errorMetrics.errors_by_category[errorInfo.category] =
      (this.errorMetrics.errors_by_category[errorInfo.category] || 0) + 1;

    // Update trends
    this.updateTrends(errorInfo);
  }

  /**
   * Update trend data
   */
  private updateTrends(errorInfo: ErrorInfo): void {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const hourKey = `${dateKey}T${now.getHours().toString().padStart(2, '0')}`;

    // Update daily trend
    const dailyTrend = this.errorMetrics.trends.daily.find(t => t.date === dateKey);
    if (dailyTrend) {
      dailyTrend.count++;
    } else {
      this.errorMetrics.trends.daily.push({
        date: dateKey,
        count: 1,
        severity: errorInfo.severity
      });
    }

    // Keep only last 30 days
    if (this.errorMetrics.trends.daily.length > 30) {
      this.errorMetrics.trends.daily.splice(0, this.errorMetrics.trends.daily.length - 30);
    }

    // Update hourly trend
    const hourlyTrend = this.errorMetrics.trends.hourly.find(t => t.hour === hourKey);
    if (hourlyTrend) {
      hourlyTrend.count++;
    } else {
      this.errorMetrics.trends.hourly.push({
        hour: hourKey,
        count: 1,
        type: errorInfo.type
      });
    }

    // Keep only last 24 hours
    if (this.errorMetrics.trends.hourly.length > 24) {
      this.errorMetrics.trends.hourly.splice(0, this.errorMetrics.trends.hourly.length - 24);
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get error history
   */
  getErrorHistory(organizationId?: string): ErrorInfo[] {
    const contextKey = organizationId || 'global';
    return this.errorHistory.get(contextKey) || [];
  }

  /**
   * Get recovery strategies for error
   */
  getRecoveryStrategies(errorType: ErrorType): RecoveryStrategy[] {
    return this.recoveryStrategies.get(errorType) || [];
  }

  /**
   * Try to recover from an error
   */
  async attemptRecovery(errorInfo: ErrorInfo): Promise<boolean> {
    if (!errorInfo.recoverable || !errorInfo.recovery_strategies) {
      return false;
    }

    const strategies = errorInfo.recovery_strategies.sort((a, b) => b.priority - a.priority);

    for (const strategy of strategies) {
      try {
        const success = await strategy.action();
        if (success) {
          console.log(`✅ Recovery strategy '${strategy.name}' succeeded`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Recovery strategy '${strategy.name}' failed:`, error);
      }
    }

    return false;
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.set('NETWORK_ERROR', [
      {
        name: 'Retry with exponential backoff',
        description: 'Retry the operation with exponential backoff',
        action: async () => {
          // Implementation would retry with backoff
          return true;
        },
        priority: 1,
        success_rate: 0.8,
        estimated_time: 5000,
        prerequisites: []
      },
      {
        name: 'Check network connectivity',
        description: 'Verify network connection and DNS resolution',
        action: async () => {
          // Implementation would check network
          return true;
        },
        priority: 2,
        success_rate: 0.9,
        estimated_time: 2000,
        prerequisites: []
      }
    ]);

    // Timeout error recovery
    this.recoveryStrategies.set('TIMEOUT_ERROR', [
      {
        name: 'Increase timeout and retry',
        description: 'Increase timeout value and retry operation',
        action: async () => {
          // Implementation would adjust timeout
          return true;
        },
        priority: 1,
        success_rate: 0.7,
        estimated_time: 3000,
        prerequisites: []
      }
    ]);

    // Rate limit recovery
    this.recoveryStrategies.set('RATE_LIMIT_EXCEEDED', [
      {
        name: 'Wait and retry',
        description: 'Wait for rate limit to reset and retry',
        action: async () => {
          // Implementation would wait for rate limit reset
          return true;
        },
        priority: 1,
        success_rate: 0.9,
        estimated_time: 60000,
        prerequisites: []
      }
    ]);
  }

  /**
   * Load existing error patterns
   */
  private async loadErrorPatterns(): Promise<void> {
    try {
      // Load from KV storage
      const patternsData = await this.env.AGENT_MEMORY.get('error_patterns');
      if (patternsData) {
        const patterns = JSON.parse(patternsData);
        for (const [key, pattern] of Object.entries(patterns)) {
          this.errorPatterns.set(key, pattern);
        }
      }
    } catch (error) {
      console.error('Failed to load error patterns:', error);
    }
  }
}

/**
 * Global error handler instance
 */
export let globalErrorHandler: ErrorHandler;

/**
 * Initialize error handler with environment
 */
export function initializeErrorHandler(env: Env): ErrorHandler {
  globalErrorHandler = new ErrorHandler(env);
  return globalErrorHandler;
}

/**
 * Handle error globally
 */
export async function handleError(error: Error, context: ErrorContext, options?: any): Promise<ErrorInfo> {
  if (!globalErrorHandler) {
    console.error('Error handler not initialized:', error);
    throw error;
  }
  return globalErrorHandler.handleError(error, context, options);
}