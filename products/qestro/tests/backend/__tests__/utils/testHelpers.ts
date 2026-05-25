/**
 * Test Helper Utilities
 * Provides common testing utilities and helper functions
 */

import { jest } from '@jest/globals';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// Mock data generators
export class MockDataGenerator {
  static generateUser(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user',
      subscriptionTier: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static generateTestScript(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      userId: randomUUID(),
      name: 'Test Script',
      description: 'A test script for testing',
      type: 'web',
      framework: 'playwright',
      content: {
        actions: [],
        assertions: []
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static generateRecordingSession(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      userId: randomUUID(),
      url: 'https://example.com',
      browserInfo: {
        name: 'chromium',
        version: '119.0.0.0'
      },
      viewport: {
        width: 1920,
        height: 1080
      },
      actions: [],
      status: 'active',
      createdAt: new Date(),
      ...overrides
    };
  }

  static generateTestExecution(overrides: Partial<any> = {}) {
    return {
      id: randomUUID(),
      testScriptId: randomUUID(),
      environment: {
        name: 'test',
        url: 'https://test.example.com'
      },
      browserInfo: {
        name: 'chromium',
        version: '119.0.0.0'
      },
      status: 'passed',
      duration: 5000,
      results: {
        passed: 5,
        failed: 0,
        skipped: 0
      },
      logs: [],
      metrics: {
        loadTime: 1200,
        firstPaint: 800
      },
      executedAt: new Date(),
      ...overrides
    };
  }
}

// Express mock utilities
export class ExpressMockUtils {
  static createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: undefined,
      ...overrides
    };
  }

  static createMockResponse(): Partial<Response> {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    return res;
  }

  static createMockNext() {
    return jest.fn();
  }
}

// Database test utilities
export class DatabaseTestUtils {
  static async cleanupDatabase() {
    // Implementation would depend on your database setup
    // This is a placeholder for database cleanup operations
    console.log('Database cleanup completed');
  }

  static async seedTestData() {
    // Implementation would depend on your database setup
    // This is a placeholder for seeding test data
    console.log('Test data seeded');
  }

  static async createTestTransaction() {
    // Implementation would depend on your database setup
    // This is a placeholder for creating test transactions
    console.log('Test transaction created');
  }

  static async rollbackTestTransaction() {
    // Implementation would depend on your database setup
    // This is a placeholder for rolling back test transactions
    console.log('Test transaction rolled back');
  }
}

// Async test utilities
export class AsyncTestUtils {
  static async waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.sleep(100);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

// Test environment utilities
export class TestEnvironmentUtils {
  static setTestEnvironmentVariables() {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/questro_test';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  }

  static resetEnvironmentVariables() {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.OPENAI_API_KEY;
  }

  static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

// Validation test utilities
export class ValidationTestUtils {
  static expectValidationError(result: any, field: string, message?: string) {
    expect(result.error).toBeDefined();
    expect(result.error.details).toBeDefined();
    
    const fieldError = result.error.details.find((detail: any) => 
      detail.path.includes(field)
    );
    
    expect(fieldError).toBeDefined();
    
    if (message) {
      expect(fieldError.message).toContain(message);
    }
  }

  static expectNoValidationError(result: any) {
    expect(result.error).toBeUndefined();
    expect(result.value).toBeDefined();
  }
}

// Performance test utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    return { result, duration };
  }

  static expectExecutionTimeUnder(duration: number, maxDuration: number) {
    expect(duration).toBeLessThan(maxDuration);
  }
}

// Error test utilities
export class ErrorTestUtils {
  static expectError(fn: () => any, errorType?: any, message?: string) {
    expect(fn).toThrow();
    
    if (errorType) {
      expect(fn).toThrow(errorType);
    }
    
    if (message) {
      expect(fn).toThrow(message);
    }
  }

  static async expectAsyncError(fn: () => Promise<any>, errorType?: any, message?: string) {
    await expect(fn()).rejects.toThrow();
    
    if (errorType) {
      await expect(fn()).rejects.toThrow(errorType);
    }
    
    if (message) {
      await expect(fn()).rejects.toThrow(message);
    }
  }
}

// Export all utilities
export {
  MockDataGenerator,
  ExpressMockUtils,
  DatabaseTestUtils,
  AsyncTestUtils,
  TestEnvironmentUtils,
  ValidationTestUtils,
  PerformanceTestUtils,
  ErrorTestUtils
};