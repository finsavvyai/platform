/**
 * AI Service Validation Middleware
 *
 * This middleware provides comprehensive validation for all AI service requests,
 * integrating input validation, prompt sanitization, and usage limit checking.
 */

import { Request, Response, NextFunction } from 'express';
import { AIInputValidator } from '../validation/aiValidation.js';
import { logger } from '../utils/logger.js';

export interface ValidatedAIRequest extends Request {
  validatedAIRequest?: {
    userId: string;
    type: string;
    feature: string;
    data: any;
    planId?: string;
  };
}

/**
 * AI Validation Middleware Factory
 */
export function createAIValidationMiddleware(requestType: string) {
  return async (req: ValidatedAIRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get user from request (should be set by auth middleware)
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required for AI services'
        });
        return;
      }

      // Construct base AI request structure
      const aiRequest = {
        userId: user.id,
        type: requestType,
        feature: req.body.feature || 'general',
        data: req.body,
        planId: user.planId
      };

      // Validate base request structure
      const validatedBaseRequest = AIInputValidator.validateBaseRequest(aiRequest);

      // Validate specific request data based on type
      let validatedData;
      switch (validatedBaseRequest.type) {
        case 'test_generation':
          validatedData = AIInputValidator.validateTestGenerationRequest(validatedBaseRequest.data);
          break;
        case 'bug_analysis':
          validatedData = AIInputValidator.validateBugAnalysisRequest(validatedBaseRequest.data);
          break;
        case 'performance_analysis':
          validatedData = AIInputValidator.validatePerformanceAnalysisRequest(validatedBaseRequest.data);
          break;
        case 'visual_testing':
          validatedData = AIInputValidator.validateVisualTestingRequest(validatedBaseRequest.data);
          break;
        case 'code_optimization':
          validatedData = AIInputValidator.validateCodeOptimizationRequest(validatedBaseRequest.data);
          break;
        default:
          // For enhanced AI services that don't match the standard types
          validatedData = validateEnhancedAIRequest(validatedBaseRequest.type, validatedBaseRequest.data);
          break;
      }

      // Attach validated request to request object
      req.validatedAIRequest = {
        userId: validatedBaseRequest.userId || user.id,
        type: validatedBaseRequest.type || requestType,
        feature: validatedBaseRequest.feature || 'general',
        data: validatedData,
        planId: validatedBaseRequest.planId
      };

      // Log successful validation
      logger.info('AI request validation successful', {
        userId: user.id,
        type: validatedBaseRequest.type,
        feature: validatedBaseRequest.feature
      });

      next();
    } catch (error) {
      logger.warn('AI validation failed:', {
        error: error.message,
        userId: (req as any).user?.id,
        path: req.path
      });

      res.status(400).json({
        error: 'Invalid Request',
        message: error.message,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return;
    }
  };
}

/**
 * Validate enhanced AI service requests (plugin generation, test maintenance, etc.)
 */
function validateEnhancedAIRequest(type: string, data: any): any {
  switch (type) {
    case 'enhanced_test_generation':
      return validateEnhancedTestGeneration(data);
    case 'plugin_generation':
      return validatePluginGeneration(data);
    case 'test_maintenance':
      return validateTestMaintenance(data);
    default:
      // Apply basic validation for unknown types
      return validateBasicAIRequest(data);
  }
}

/**
 * Validate enhanced test generation request
 */
function validateEnhancedTestGeneration(data: any): any {
  // Basic structure validation
  if (!data.description || typeof data.description !== 'string') {
    throw new Error('Description is required and must be a string');
  }

  if (data.description.length < 10 || data.description.length > 2000) {
    throw new Error('Description must be between 10 and 2000 characters');
  }

  if (!data.platform || !['web', 'mobile', 'api'].includes(data.platform)) {
    throw new Error('Valid platform is required (web, mobile, or api)');
  }

  if (!data.complexity || !['simple', 'medium', 'complex'].includes(data.complexity)) {
    throw new Error('Valid complexity is required (simple, medium, or complex)');
  }

  // Check for prompt injection
  AIInputValidator.validateForPromptInjection(data.description);

  // Sanitize description
  data.description = AIInputValidator.sanitizeText(data.description);

  return data;
}

/**
 * Validate plugin generation request
 */
function validatePluginGeneration(data: any): any {
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Plugin name is required');
  }

  if (data.name.length < 3 || data.name.length > 50) {
    throw new Error('Plugin name must be between 3 and 50 characters');
  }

  if (!data.description || typeof data.description !== 'string') {
    throw new Error('Plugin description is required');
  }

  if (data.description.length < 10 || data.description.length > 300) {
    throw new Error('Plugin description must be between 10 and 300 characters');
  }

  // Validate category
  const validCategories = ['recording', 'validation', 'reporting', 'integration', 'utility', 'custom'];
  if (!data.category || !validCategories.includes(data.category)) {
    throw new Error(`Valid category is required: ${validCategories.join(', ')}`);
  }

  // Check for prompt injection
  AIInputValidator.validateForPromptInjection(data.description);

  return data;
}

/**
 * Validate test maintenance request
 */
function validateTestMaintenance(data: any): any {
  if (!data.testCaseId && !data.testSuiteId) {
    throw new Error('Either testCaseId or testSuiteId is required');
  }

  if (data.maintenanceType && !['optimization', 'refactoring', 'updating', 'debugging'].includes(data.maintenanceType)) {
    throw new Error('Invalid maintenance type');
  }

  if (data.description && data.description.length > 1000) {
    throw new Error('Description must be less than 1000 characters');
  }

  return data;
}

/**
 * Basic AI request validation for unknown types
 */
function validateBasicAIRequest(data: any): any {
  // Ensure data is an object
  if (!data || typeof data !== 'object') {
    throw new Error('Request data must be an object');
  }

  // Check for obviously malicious content
  const dataString = JSON.stringify(data);
  AIInputValidator.validateForPromptInjection(dataString);

  return data;
}

/**
 * Pre-built validation middleware for common AI request types
 */
export const aiValidationMiddleware = {
  testGeneration: createAIValidationMiddleware('test_generation'),
  bugAnalysis: createAIValidationMiddleware('bug_analysis'),
  performanceAnalysis: createAIValidationMiddleware('performance_analysis'),
  visualTesting: createAIValidationMiddleware('visual_testing'),
  codeOptimization: createAIValidationMiddleware('code_optimization'),
  enhancedTestGeneration: createAIValidationMiddleware('enhanced_test_generation'),
  pluginGeneration: createAIValidationMiddleware('plugin_generation'),
  testMaintenance: createAIValidationMiddleware('test_maintenance'),
};

export default createAIValidationMiddleware;
