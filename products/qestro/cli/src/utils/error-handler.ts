/**
 * Professional Error Handling for Questro CLI
 * Provides comprehensive error handling with user-friendly messages and recovery suggestions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './logger';
import { config } from './config';

export enum ErrorCode {
  // Authentication Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Network/API Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Configuration Errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',

  // File/System Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',

  // Business Logic Errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  TEST_NOT_FOUND = 'TEST_NOT_FOUND',
  RECORDING_NOT_FOUND = 'RECORDING_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Integration Errors
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  MAESTRO_NOT_FOUND = 'MAESTRO_NOT_FOUND',
  PLAYWRIGHT_NOT_FOUND = 'PLAYWRIGHT_NOT_FOUND',

  // System Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface QuestroError extends Error {
  code: ErrorCode;
  statusCode?: number;
  details?: any;
  suggestions?: string[];
  command?: string;
  exitCode?: number;
}

export class QuestroErrorImpl extends Error implements QuestroError {
  public readonly code: ErrorCode;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly suggestions?: string[];
  public readonly command?: string;
  public readonly exitCode: number;

  constructor(options: {
    message: string;
    code: ErrorCode;
    statusCode?: number;
    details?: any;
    suggestions?: string[];
    command?: string;
    exitCode?: number;
  }) {
    super(options.message);
    this.name = 'QuestroError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.suggestions = options.suggestions;
    this.command = options.command;
    this.exitCode = options.exitCode || 1;
  }
}

export class ErrorHandler {
  private errorMap: Record<ErrorCode, (error: any) => QuestroError> = {
    [ErrorCode.UNAUTHORIZED]: this.handleUnauthorized,
    [ErrorCode.TOKEN_EXPIRED]: this.handleTokenExpired,
    [ErrorCode.INVALID_CREDENTIALS]: this.handleInvalidCredentials,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: this.handleInsufficientPermissions,

    [ErrorCode.NETWORK_ERROR]: this.handleNetworkError,
    [ErrorCode.API_ERROR]: this.handleApiError,
    [ErrorCode.TIMEOUT_ERROR]: this.handleTimeoutError,
    [ErrorCode.RATE_LIMITED]: this.handleRateLimited,
    [ErrorCode.SERVICE_UNAVAILABLE]: this.handleServiceUnavailable,

    [ErrorCode.CONFIG_INVALID]: this.handleConfigInvalid,
    [ErrorCode.CONFIG_MISSING]: this.handleConfigMissing,
    [ErrorCode.PROFILE_NOT_FOUND]: this.handleProfileNotFound,

    [ErrorCode.FILE_NOT_FOUND]: this.handleFileNotFound,
    [ErrorCode.FILE_READ_ERROR]: this.handleFileReadError,
    [ErrorCode.FILE_WRITE_ERROR]: this.handleFileWriteError,
    [ErrorCode.DIRECTORY_NOT_FOUND]: this.handleDirectoryNotFound,
    [ErrorCode.PERMISSION_DENIED]: this.handlePermissionDenied,

    [ErrorCode.VALIDATION_ERROR]: this.handleValidationError,
    [ErrorCode.INVALID_INPUT]: this.handleInvalidInput,
    [ErrorCode.REQUIRED_FIELD_MISSING]: this.handleRequiredFieldMissing,

    [ErrorCode.PROJECT_NOT_FOUND]: this.handleProjectNotFound,
    [ErrorCode.TEST_NOT_FOUND]: this.handleTestNotFound,
    [ErrorCode.RECORDING_NOT_FOUND]: this.handleRecordingNotFound,
    [ErrorCode.DUPLICATE_RESOURCE]: this.handleDuplicateResource,

    [ErrorCode.INTEGRATION_ERROR]: this.handleIntegrationError,
    [ErrorCode.MAESTRO_NOT_FOUND]: this.handleMaestroNotFound,
    [ErrorCode.PLAYWRIGHT_NOT_FOUND]: this.handlePlaywrightNotFound,

    [ErrorCode.UNKNOWN_ERROR]: this.handleUnknownError,
    [ErrorCode.INTERNAL_ERROR]: this.handleInternalError,
  };

  handleError(error: any, command?: string): QuestroErrorImpl {
    const questroError = this.transformError(error, command);
    this.displayError(questroError);
    return questroError;
  }

  private transformError(error: any, command?: string): QuestroErrorImpl {
    if (error instanceof QuestroErrorImpl) {
      return error;
    }

    // Handle HTTP errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        return new QuestroErrorImpl({
          message: 'Authentication required',
          code: ErrorCode.UNAUTHORIZED,
          statusCode: status,
          details: data,
          suggestions: [
            'Run "qestro auth login" to authenticate',
            'Check your credentials and try again',
          ],
          command,
        });
      }

      if (status === 403) {
        return new QuestroErrorImpl({
          message: 'Insufficient permissions',
          code: ErrorCode.INSUFFICIENT_PERMISSIONS,
          statusCode: status,
          details: data,
          suggestions: [
            'Check if you have the required permissions',
            'Contact your administrator for access',
          ],
          command,
        });
      }

      if (status === 404) {
        return new QuestroErrorImpl({
          message: data?.message || 'Resource not found',
          code: ErrorCode.API_ERROR,
          statusCode: status,
          details: data,
          suggestions: [
            'Verify the resource exists',
            'Check the resource identifier',
          ],
          command,
        });
      }

      if (status === 429) {
        return new QuestroErrorImpl({
          message: 'Rate limit exceeded',
          code: ErrorCode.RATE_LIMITED,
          statusCode: status,
          details: data,
          suggestions: [
            'Wait and try again later',
            'Check your usage limits',
          ],
          command,
        });
      }

      if (status >= 500) {
        return new QuestroErrorImpl({
          message: 'Service temporarily unavailable',
          code: ErrorCode.SERVICE_UNAVAILABLE,
          statusCode: status,
          details: data,
          suggestions: [
            'Try again later',
            'Check service status at https://status.questro.io',
          ],
          command,
        });
      }

      // Generic API error
      return new QuestroErrorImpl({
        message: data?.message || error.message || 'API request failed',
        code: ErrorCode.API_ERROR,
        statusCode: status,
        details: data,
        suggestions: [
          'Check your request parameters',
          'Try again with different options',
        ],
        command,
      });
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new QuestroErrorImpl({
        message: 'Network connection failed',
        code: ErrorCode.NETWORK_ERROR,
        details: error,
        suggestions: [
          'Check your internet connection',
          `Verify API URL: ${config.getApiUrl()}`,
          'Try again later',
        ],
        command,
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return new QuestroErrorImpl({
        message: 'Request timed out',
        code: ErrorCode.TIMEOUT_ERROR,
        details: error,
        suggestions: [
          'Increase timeout with --timeout option',
          'Try again with a smaller request',
        ],
        command,
      });
    }

    // Handle file system errors
    if (error.code === 'ENOENT') {
      return new QuestroErrorImpl({
        message: 'File or directory not found',
        code: ErrorCode.FILE_NOT_FOUND,
        details: { path: error.path },
        suggestions: [
          'Verify the file path is correct',
          'Check if the file exists',
        ],
        command,
      });
    }

    if (error.code === 'EACCES') {
      return new QuestroErrorImpl({
        message: 'Permission denied',
        code: ErrorCode.PERMISSION_DENIED,
        details: error,
        suggestions: [
          'Check file permissions',
          'Run with appropriate privileges',
        ],
        command,
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return new QuestroErrorImpl({
        message: error.message,
        code: ErrorCode.VALIDATION_ERROR,
        details: error.details,
        suggestions: [
          'Check input parameters',
          'Review command syntax',
        ],
        command,
      });
    }

    // Handle JWT errors
    if (error.name === 'TokenExpiredError') {
      return new QuestroErrorImpl({
        message: 'Authentication token has expired',
        code: ErrorCode.TOKEN_EXPIRED,
        details: error,
        suggestions: [
          'Run "qestro auth login" to refresh your token',
          'Check your session timeout',
        ],
        command,
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return new QuestroErrorImpl({
        message: 'Invalid authentication token',
        code: ErrorCode.INVALID_CREDENTIALS,
        details: error,
        suggestions: [
          'Run "qestro auth login" to authenticate',
          'Check your credentials',
        ],
        command,
      });
    }

    // Default unknown error
    return new QuestroErrorImpl({
      message: error.message || 'An unexpected error occurred',
      code: ErrorCode.UNKNOWN_ERROR,
      details: error,
      suggestions: [
        'Try again with different options',
        'Run with --verbose for more details',
        'Report this issue if it persists',
      ],
      command,
    });
  }

  private displayError(error: QuestroError): void {
    console.error('\n' + chalk.red.bold('✖ Error: ' + error.message));

    if (error.statusCode) {
      console.error(chalk.gray(`Status Code: ${error.statusCode}`));
    }

    if (error.code) {
      console.error(chalk.gray(`Error Code: ${error.code}`));
    }

    if (error.command) {
      console.error(chalk.gray(`Command: qestro ${error.command}`));
    }

    if (error.suggestions && error.suggestions.length > 0) {
      console.error(chalk.yellow('\n💡 Suggestions:'));
      error.suggestions.forEach((suggestion, index) => {
        console.error(chalk.yellow(`  ${index + 1}. ${suggestion}`));
      });
    }

    if (process.env.QESTRO_VERBOSE === 'true' && error.details) {
      console.error(chalk.gray('\n📋 Details:'));
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }

    console.error(); // Add empty line for better readability
  }

  // Specific error handlers
  private handleUnauthorized = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Authentication required',
    code: ErrorCode.UNAUTHORIZED,
    statusCode: 401,
    suggestions: [
      'Run "qestro auth login" to authenticate',
      'Check your credentials and try again',
    ],
  });

  private handleTokenExpired = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Authentication token has expired',
    code: ErrorCode.TOKEN_EXPIRED,
    suggestions: [
      'Run "qestro auth login" to refresh your token',
      'Check your session timeout settings',
    ],
  });

  private handleInvalidCredentials = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Invalid credentials provided',
    code: ErrorCode.INVALID_CREDENTIALS,
    suggestions: [
      'Verify your username and password',
      'Check for typos in your credentials',
    ],
  });

  private handleInsufficientPermissions = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'You do not have permission to perform this action',
    code: ErrorCode.INSUFFICIENT_PERMISSIONS,
    statusCode: 403,
    suggestions: [
      'Contact your administrator for access',
      'Check if you have the required role',
    ],
  });

  private handleNetworkError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Network connection failed',
    code: ErrorCode.NETWORK_ERROR,
    suggestions: [
      'Check your internet connection',
      'Verify the API URL is correct',
      'Try again later',
    ],
  });

  private handleApiError = (error: any): QuestroError => new QuestroErrorImpl({
    message: error.message || 'API request failed',
    code: ErrorCode.API_ERROR,
    suggestions: [
      'Check your request parameters',
      'Verify the API endpoint is correct',
      'Try again with different options',
    ],
  });

  private handleTimeoutError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Request timed out',
    code: ErrorCode.TIMEOUT_ERROR,
    suggestions: [
      'Increase timeout with --timeout option',
      'Try again with a smaller request',
      'Check your network connection',
    ],
  });

  private handleRateLimited = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Rate limit exceeded',
    code: ErrorCode.RATE_LIMITED,
    statusCode: 429,
    suggestions: [
      'Wait and try again later',
      'Check your usage limits',
      'Consider upgrading your plan',
    ],
  });

  private handleServiceUnavailable = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Service temporarily unavailable',
    code: ErrorCode.SERVICE_UNAVAILABLE,
    statusCode: 503,
    suggestions: [
      'Try again later',
      'Check service status at https://status.questro.io',
      'Subscribe to status notifications',
    ],
  });

  private handleConfigInvalid = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Configuration is invalid',
    code: ErrorCode.CONFIG_INVALID,
    suggestions: [
      'Run "qestro config validate" to check configuration',
      'Reset configuration with "qestro config reset"',
      'Check configuration syntax',
    ],
  });

  private handleConfigMissing = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Configuration is missing',
    code: ErrorCode.CONFIG_MISSING,
    suggestions: [
      'Run "qestro config init" to create configuration',
      'Check configuration file permissions',
    ],
  });

  private handleProfileNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Configuration profile not found',
    code: ErrorCode.PROFILE_NOT_FOUND,
    suggestions: [
      'Check available profiles with "qestro config list-profiles"',
      'Create new profile with "qestro config profile create"',
    ],
  });

  private handleFileNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: `File not found: ${error.path || 'unknown'}`,
    code: ErrorCode.FILE_NOT_FOUND,
    details: { path: error.path },
    suggestions: [
      'Verify the file path is correct',
      'Check if the file exists',
      'Ensure proper file permissions',
    ],
  });

  private handleFileReadError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Failed to read file',
    code: ErrorCode.FILE_READ_ERROR,
    suggestions: [
      'Check file permissions',
      'Verify the file is not corrupted',
      'Ensure the file is not locked by another process',
    ],
  });

  private handleFileWriteError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Failed to write file',
    code: ErrorCode.FILE_WRITE_ERROR,
    suggestions: [
      'Check file permissions',
      'Ensure directory exists',
      'Verify disk space is available',
    ],
  });

  private handleDirectoryNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Directory not found',
    code: ErrorCode.DIRECTORY_NOT_FOUND,
    suggestions: [
      'Create the directory if it doesn\'t exist',
      'Check the directory path',
      'Verify directory permissions',
    ],
  });

  private handlePermissionDenied = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Permission denied',
    code: ErrorCode.PERMISSION_DENIED,
    suggestions: [
      'Check file/directory permissions',
      'Run with appropriate privileges',
      'Verify ownership of the file/directory',
    ],
  });

  private handleValidationError = (error: any): QuestroError => new QuestroErrorImpl({
    message: error.message || 'Validation failed',
    code: ErrorCode.VALIDATION_ERROR,
    suggestions: [
      'Check input parameters',
      'Review command syntax and options',
      'Refer to command help documentation',
    ],
  });

  private handleInvalidInput = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Invalid input provided',
    code: ErrorCode.INVALID_INPUT,
    suggestions: [
      'Check input format and values',
      'Refer to command help for valid options',
      'Use --help to see command usage',
    ],
  });

  private handleRequiredFieldMissing = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Required field is missing',
    code: ErrorCode.REQUIRED_FIELD_MISSING,
    suggestions: [
      'Provide all required parameters',
      'Check command help for required fields',
      'Use interactive mode with --interactive',
    ],
  });

  private handleProjectNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Project not found',
    code: ErrorCode.PROJECT_NOT_FOUND,
    suggestions: [
      'List available projects with "qestro projects list"',
      'Verify the project ID or name',
      'Check if you have access to the project',
    ],
  });

  private handleTestNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Test not found',
    code: ErrorCode.TEST_NOT_FOUND,
    suggestions: [
      'List available tests with "qestro tests list"',
      'Verify the test ID or name',
      'Check if the test exists in the current project',
    ],
  });

  private handleRecordingNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Recording not found',
    code: ErrorCode.RECORDING_NOT_FOUND,
    suggestions: [
      'List available recordings with "qestro recordings list"',
      'Verify the recording ID or name',
      'Check if the recording exists in the current project',
    ],
  });

  private handleDuplicateResource = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Resource already exists',
    code: ErrorCode.DUPLICATE_RESOURCE,
    suggestions: [
      'Use a different name or identifier',
      'Check existing resources before creating',
      'Use --force option to overwrite if available',
    ],
  });

  private handleIntegrationError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Integration error occurred',
    code: ErrorCode.INTEGRATION_ERROR,
    suggestions: [
      'Check integration configuration',
      'Verify third-party service availability',
      'Review integration logs',
    ],
  });

  private handleMaestroNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Maestro not found or not installed',
    code: ErrorCode.MAESTRO_NOT_FOUND,
    suggestions: [
      'Install Maestro: https://maestro.mobile.dev',
      'Check Maestro installation path',
      'Verify Maestro is in your PATH',
    ],
  });

  private handlePlaywrightNotFound = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'Playwright not found or not installed',
    code: ErrorCode.PLAYWRIGHT_NOT_FOUND,
    suggestions: [
      'Install Playwright: npm install -g playwright',
      'Run "npx playwright install" to install browsers',
      'Check Playwright installation path',
    ],
  });

  private handleUnknownError = (error: any): QuestroError => new QuestroErrorImpl({
    message: error.message || 'An unknown error occurred',
    code: ErrorCode.UNKNOWN_ERROR,
    suggestions: [
      'Try again with different options',
      'Run with --verbose for more details',
      'Report this issue if it persists',
    ],
  });

  private handleInternalError = (error: any): QuestroError => new QuestroErrorImpl({
    message: 'An internal error occurred',
    code: ErrorCode.INTERNAL_ERROR,
    suggestions: [
      'Try again later',
      'Report this issue to the development team',
      'Check for updates to the CLI',
    ],
  });
}

export const errorHandler = new ErrorHandler();
export const handleError = (error: any, command?: string): QuestroErrorImpl => {
  logger.failCommand(command || 'unknown', error);
  return errorHandler.handleError(error, command);
};

export { QuestroErrorImpl as QuestroError };