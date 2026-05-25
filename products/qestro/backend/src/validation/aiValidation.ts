/**
 * AI Service Input Validation and Prompt Sanitization
 *
 * This module provides comprehensive validation and sanitization for all AI service inputs
 * to prevent prompt injection attacks, control costs, and ensure consistent behavior.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Base validation schemas
const baseAIRequestSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  type: z.enum(['test_generation', 'bug_analysis', 'performance_analysis', 'visual_testing', 'code_optimization']),
  feature: z.string().min(1).max(100),
  data: z.any(), // Will be validated by specific schemas
  planId: z.string().uuid().optional(),
});

// Test Generation Validation
const testGenerationRequestSchema = z.object({
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!?()[\]{}:;'"\/\\@#$%^&*+=<>\n\r\t]+$/,
      'Description contains invalid characters'),
  platform: z.enum(['web', 'mobile', 'api']),
  framework: z.enum(['puppeteer', 'playwright', 'cypress', 'selenium', 'maestro']).optional(),
  complexity: z.enum(['simple', 'medium', 'complex']),
});

// Bug Analysis Validation
const bugAnalysisRequestSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!?()[\]{}:;'"\/\\@#$%^&*+=<>]+$/,
      'Title contains invalid characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!?()[\]{}:;'"\/\\@#$%^&*+=<>\n\r\t]+$/,
      'Description contains invalid characters'),
  stackTrace: z.string()
    .max(10000, 'Stack trace must be less than 10000 characters')
    .optional(),
  browserInfo: z.any().optional(),
  reproductionSteps: z.array(z.string()
    .min(1, 'Step must be at least 1 character')
    .max(500, 'Step must be less than 500 characters')
  ).max(20, 'Maximum 20 reproduction steps allowed').optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// Performance Analysis Validation
const performanceAnalysisRequestSchema = z.object({
  metrics: z.array(z.object({
    name: z.string(),
    value: z.number(),
    unit: z.string(),
  })).min(1, 'At least one metric is required').max(50, 'Maximum 50 metrics allowed'),
  timeRange: z.string().regex(/^\d+[smhdw]$/, 'Invalid time range format'),
  baseline: z.any().optional(),
  platform: z.enum(['web', 'mobile']),
});

// Visual Testing Validation
const visualTestingRequestSchema = z.object({
  screenshotUrl: z.string().url('Invalid screenshot URL'),
  baselineUrl: z.string().url('Invalid baseline URL').optional(),
  comparisonOptions: z.object({
    tolerance: z.number().min(0).max(1).optional(),
    ignoreRegions: z.array(z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })).max(10, 'Maximum 10 ignore regions allowed').optional(),
  }).optional(),
});

// Code Optimization Validation
const codeOptimizationRequestSchema = z.object({
  code: z.string()
    .min(10, 'Code must be at least 10 characters')
    .max(10000, 'Code must be less than 10000 characters'),
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust']),
  optimizationGoals: z.array(z.enum([
    'performance', 'readability', 'maintainability', 'security', 'memory_usage'
  ])).min(1).max(5),
});

/**
 * Prompt injection patterns to detect and block
 */
const PROMPT_INJECTION_PATTERNS = [
  // System instruction overrides
  /ignore\s+(previous|all)\s+instructions/gi,
  /disregard\s+(the\s+)?(above|previous)\s+(instructions|prompts?)/gi,
  /forget\s+(everything|all\s+previous|the\s+above)/gi,
  /system\s*:\s*you\s+are\s+now/gi,
  /act\s+as\s+if\s+you\s+are/gi,
  /pretend\s+to\s+be/gi,
  /roleplay\s+as/gi,

  // Jailbreak attempts
  /jailbreak/gi,
  /dan\s+1\d\.0/gi,
  /do\s+anything\s+now/gi,
  /developer\s+mode/gi,
  /evil\s+mode/gi,
  /unrestricted\s+mode/gi,

  // Information disclosure attempts
  /tell\s+me\s+(about\s+)?your\s+(training|data|instructions)/gi,
  /what\s+(are\s+)?your\s+(instructions|guidelines|rules)/gi,
  /how\s+(do|are)\s+you\s+(trained|built)/gi,
  /show\s+me\s+your\s+(prompt|instructions)/gi,
  /reveal\s+your\s+(instructions|system\s+prompt)/gi,

  // Harmful content requests
  /hate\s+speech/gi,
  /violent\s+content/gi,
  /illegal\s+activities/gi,
  /malicious\s+code/gi,
  /harmful\s+instructions/gi,

  // Data extraction attempts
  /extract\s+(all\s+)?(the\s+)?(data|information)/gi,
  /output\s+(all\s+)?(the\s+)?(data|information)/gi,
  /return\s+(all\s+)?(the\s+)?(data|information)/gi,
  /provide\s+(all\s+)?(the\s+)?(data|information)/gi,
];

/**
 * Content sanitization patterns
 */
const SANITIZATION_PATTERNS = [
  // Remove or escape special characters that could cause issues
  // eslint-disable-next-line no-control-regex
  { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, replacement: '' }, // Control characters
  { pattern: /[\uFFFE\uFFFF]/g, replacement: '' }, // Invalid Unicode
  { pattern: /\\n/g, replacement: ' ' }, // Normalize newlines
  { pattern: /\\r/g, replacement: ' ' }, // Normalize carriage returns
  { pattern: /\\t/g, replacement: ' ' }, // Normalize tabs
  { pattern: /\s+/g, replacement: ' ' }, // Normalize whitespace
];

export class AIInputValidator {
  /**
   * Validate base AI request structure
   */
  static validateBaseRequest(request: any) {
    try {
      return baseAIRequestSchema.parse(request);
    } catch (error) {
      logger.warn('Invalid base AI request:', { error: error.message, request });
      throw new Error(`Invalid request format: ${error.message}`);
    }
  }

  /**
   * Validate test generation request
   */
  static validateTestGenerationRequest(data: any) {
    try {
      const validated = testGenerationRequestSchema.parse(data);

      // Additional business logic validation
      if (validated.platform === 'mobile' && !validated.framework) {
        throw new Error('Framework is required for mobile test generation');
      }

      // Check for prompt injection
      this.validateForPromptInjection(validated.description);

      // Sanitize description
      validated.description = this.sanitizeText(validated.description);

      return validated;
    } catch (error) {
      logger.warn('Invalid test generation request:', { error: error.message, data });
      throw new Error(`Invalid test generation request: ${error.message}`);
    }
  }

  /**
   * Validate bug analysis request
   */
  static validateBugAnalysisRequest(data: any) {
    try {
      const validated = bugAnalysisRequestSchema.parse(data);

      // Check for prompt injection in text fields
      this.validateForPromptInjection(validated.title);
      this.validateForPromptInjection(validated.description);

      if (validated.stackTrace) {
        this.validateForPromptInjection(validated.stackTrace);
      }

      if (validated.reproductionSteps) {
        validated.reproductionSteps = validated.reproductionSteps.map(step =>
          this.sanitizeText(step)
        );
      }

      // Sanitize text fields
      validated.title = this.sanitizeText(validated.title);
      validated.description = this.sanitizeText(validated.description);

      return validated;
    } catch (error) {
      logger.warn('Invalid bug analysis request:', { error: error.message, data });
      throw new Error(`Invalid bug analysis request: ${error.message}`);
    }
  }

  /**
   * Validate performance analysis request
   */
  static validatePerformanceAnalysisRequest(data: any) {
    try {
      const validated = performanceAnalysisRequestSchema.parse(data);

      // Validate time range format more strictly
      const timeRangeMatch = validated.timeRange.match(/^(\d+)([smhdw])$/);
      if (!timeRangeMatch) {
        throw new Error('Invalid time range format');
      }

      const value = parseInt(timeRangeMatch[1]);
      const unit = timeRangeMatch[2];

      // Set reasonable limits
      const maxHours = { s: 1, m: 60, h: 24, d: 7, w: 4 };
      if (value > (maxHours[unit as keyof typeof maxHours] || 24)) {
        throw new Error(`Time range too large for ${unit} unit`);
      }

      return validated;
    } catch (error) {
      logger.warn('Invalid performance analysis request:', { error: error.message, data });
      throw new Error(`Invalid performance analysis request: ${error.message}`);
    }
  }

  /**
   * Validate visual testing request
   */
  static validateVisualTestingRequest(data: any) {
    try {
      const validated = visualTestingRequestSchema.parse(data);

      // Validate URLs are accessible (in a real implementation)
      // This would involve making HTTP requests to verify URLs

      return validated;
    } catch (error) {
      logger.warn('Invalid visual testing request:', { error: error.message, data });
      throw new Error(`Invalid visual testing request: ${error.message}`);
    }
  }

  /**
   * Validate code optimization request
   */
  static validateCodeOptimizationRequest(data: any) {
    try {
      const validated = codeOptimizationRequestSchema.parse(data);

      // Check for prompt injection in code
      this.validateForPromptInjection(validated.code);

      // Basic code structure validation
      if (validated.code.length < 10) {
        throw new Error('Code is too short to analyze');
      }

      // Check for potentially malicious code patterns
      const maliciousPatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /child_process/gi,
        /require\s*\(\s*['"`]child_process['"`]\s*\)/gi,
        /fs\s*\.\s*rm/gi,
        /fs\s*\.\s*unlink/gi,
      ];

      for (const pattern of maliciousPatterns) {
        if (pattern.test(validated.code)) {
          logger.warn('Potentially malicious code pattern detected:', { code: validated.code.substring(0, 100) });
          throw new Error('Code contains potentially malicious patterns');
        }
      }

      return validated;
    } catch (error) {
      logger.warn('Invalid code optimization request:', { error: error.message, data });
      throw new Error(`Invalid code optimization request: ${error.message}`);
    }
  }

  /**
   * Check for prompt injection patterns
   */
  static validateForPromptInjection(text: string): void {
    const lowerText = text.toLowerCase();

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(lowerText)) {
        logger.warn('Prompt injection attempt detected:', {
          pattern: pattern.source,
          text: text.substring(0, 100)
        });
        throw new Error('Input contains potentially harmful content');
      }
    }
  }

  /**
   * Sanitize text input
   */
  static sanitizeText(text: string): string {
    let sanitized = text;

    for (const { pattern, replacement } of SANITIZATION_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    // Trim excessive whitespace
    sanitized = sanitized.trim();

    // Ensure reasonable length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000) + '...';
    }

    return sanitized;
  }

  /**
   * Validate AI response content
   */
  static validateAIResponse(response: any): any {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format');
    }

    // Check for required fields
    if (!response.success) {
      throw new Error('AI response missing success flag');
    }

    if (response.success && !response.result) {
      throw new Error('Successful AI response missing result');
    }

    // Sanitize response content
    if (response.result && typeof response.result === 'object') {
      response.result = this.sanitizeResponseObject(response.result);
    }

    return response;
  }

  /**
   * Recursively sanitize response objects
   */
  private static sanitizeResponseObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeResponseObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeResponseObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate user's AI usage limits
   */
  static validateUsageLimits(userId: string, requestType: string, currentUsage: any): void {
    // This would integrate with your subscription service
    // For now, implement basic rate limiting

    const dailyLimits = {
      test_generation: 10,
      bug_analysis: 25,
      performance_analysis: 15,
      visual_testing: 20,
      code_optimization: 15,
    };

    const limit = dailyLimits[requestType as keyof typeof dailyLimits] || 10;

    if (currentUsage[requestType] >= limit) {
      throw new Error(`Daily limit exceeded for ${requestType}. Limit: ${limit}`);
    }
  }
}

export default AIInputValidator;
