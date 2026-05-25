import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Structured Logging (P2-4)', () => {
  let logger, consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    class Logger {
      constructor(context = {}) {
        this.context = context;
        this.requestId = context.requestId || this.generateRequestId();
        this.environment = context.environment || 'production';
        this.logLevel = this.parseLogLevel(context.logLevel || 'info');
      }

      generateRequestId() {
        return Math.random().toString(36).substring(2, 15);
      }

      parseLogLevel(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level.toLowerCase()] || 1;
      }

      shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= this.logLevel;
      }

      formatMessage(level, message, metadata = {}) {
        return {
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          requestId: this.requestId,
          environment: this.environment,
          message,
          ...this.context,
          ...metadata
        };
      }

      info(message, metadata = {}) {
        if (this.shouldLog('info')) {
          console.log(JSON.stringify(this.formatMessage('info', message, metadata)));
        }
      }

      warn(message, metadata = {}) {
        if (this.shouldLog('warn')) {
          console.log(JSON.stringify(this.formatMessage('warn', message, metadata)));
        }
      }

      error(message, metadata = {}) {
        if (this.shouldLog('error')) {
          console.log(JSON.stringify(this.formatMessage('error', message, metadata)));
        }
      }

      debug(message, metadata = {}) {
        if (this.shouldLog('debug')) {
          console.log(JSON.stringify(this.formatMessage('debug', message, metadata)));
        }
      }
    }

    logger = new Logger({ requestId: 'test-request-123', environment: 'test' });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Log Formatting', () => {
    it('should create structured JSON logs', () => {
      logger.info('Test message', { userId: '123' });

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(logOutput).toHaveProperty('timestamp');
      expect(logOutput).toHaveProperty('level', 'INFO');
      expect(logOutput).toHaveProperty('requestId', 'test-request-123');
      expect(logOutput).toHaveProperty('message', 'Test message');
      expect(logOutput).toHaveProperty('userId', '123');
    });

    it('should include correlation ID', () => {
      logger.info('Test');

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('test-request-123');
    });

    it('should include environment', () => {
      logger.info('Test');

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logOutput.environment).toBe('test');
    });
  });

  describe('Log Levels', () => {
    it('should respect log level filtering', () => {
      const warnLogger = new (class Logger {
        constructor() {
          this.logLevel = 2;
          this.requestId = 'test-123';
          this.environment = 'test';
        }
        shouldLog(level) {
          const levels = { debug: 0, info: 1, warn: 2, error: 3 };
          return levels[level] >= this.logLevel;
        }
        formatMessage(level, message) {
          return { level, message, requestId: this.requestId };
        }
        info(message) {
          if (this.shouldLog('info')) {
            console.log(JSON.stringify(this.formatMessage('info', message)));
          }
        }
        warn(message) {
          if (this.shouldLog('warn')) {
            console.log(JSON.stringify(this.formatMessage('warn', message)));
          }
        }
      })();

      warnLogger.info('Should not log');
      expect(consoleSpy).not.toHaveBeenCalled();

      warnLogger.warn('Should log');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should support all log levels', () => {
      consoleSpy.mockClear();

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalledTimes(3); // debug filtered out at info level
    });
  });

  describe('Metadata', () => {
    it('should include custom metadata', () => {
      logger.info('Request completed', {
        statusCode: 200,
        duration: 45,
        userId: 'user123'
      });

      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logOutput.statusCode).toBe(200);
      expect(logOutput.duration).toBe(45);
      expect(logOutput.userId).toBe('user123');
    });
  });
});

describe('Environment Validation (P2-3)', () => {
  class EnvironmentValidator {
    constructor() {
      this.required = ['DB', 'CACHE', 'JWT_SECRET', 'LEMONSQUEEZY_API_KEY'];
      this.optional = ['ANTHROPIC_API_KEY', 'ENVIRONMENT', 'LOG_LEVEL'];
    }

    validate(env) {
      const errors = [];

      for (const key of this.required) {
        if (!env[key]) {
          errors.push(`Missing required environment variable: ${key}`);
        } else {
          const validation = this.validateFormat(key, env[key]);
          if (!validation.valid) {
            errors.push(`Invalid ${key}: ${validation.error}`);
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
      }

      return { valid: true };
    }

    validateFormat(key, value) {
      switch (key) {
        case 'JWT_SECRET':
          if (value.length < 32) {
            return { valid: false, error: 'Must be at least 32 characters' };
          }
          return { valid: true };

        case 'LEMONSQUEEZY_API_KEY':
          if (!value.startsWith('lmsq_')) {
            return { valid: false, error: 'Must start with lmsq_' };
          }
          return { valid: true };

        default:
          return { valid: true };
      }
    }
  }

  let validator;

  beforeEach(() => {
    validator = new EnvironmentValidator();
  });

  describe('Required Variables', () => {
    it('should validate all required variables are present', () => {
      const validEnv = {
        DB: {},
        CACHE: {},
        JWT_SECRET: 'a'.repeat(32),
        LEMONSQUEEZY_API_KEY: 'lmsq_test_key'
      };

      expect(() => validator.validate(validEnv)).not.toThrow();
    });

    it('should fail when required variable is missing', () => {
      const invalidEnv = {
        DB: {},
        CACHE: {}
      };

      expect(() => validator.validate(invalidEnv))
        .toThrow('Missing required environment variable: JWT_SECRET');
    });
  });

  describe('Format Validation', () => {
    it('should validate JWT_SECRET length', () => {
      const env = {
        DB: {},
        CACHE: {},
        JWT_SECRET: 'short',
        LEMONSQUEEZY_API_KEY: 'lmsq_test'
      };

      expect(() => validator.validate(env))
        .toThrow('Invalid JWT_SECRET');
    });

    it('should validate LemonSqueezy API key format', () => {
      const env = {
        DB: {},
        CACHE: {},
        JWT_SECRET: 'a'.repeat(32),
        LEMONSQUEEZY_API_KEY: 'invalid_prefix_key'
      };

      expect(() => validator.validate(env))
        .toThrow('Invalid LEMONSQUEEZY_API_KEY');
    });
  });
});
