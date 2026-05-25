/**
 * Jest Setup Validation Test
 * Validates that Jest is properly configured with TypeScript and custom utilities
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  MockDataGenerator, 
  ExpressMockUtils, 
  AsyncTestUtils, 
  TestEnvironmentUtils,
  ValidationTestUtils,
  PerformanceTestUtils,
  ErrorTestUtils
} from '../utils/testHelpers.js';
import { 
  userFixtures, 
  testScriptFixtures, 
  recordingSessionFixtures,
  apiFixtures 
} from '../fixtures/testFixtures.js';
import { TestAssertions } from '../utils/customMatchers.js';

describe('Jest Setup Validation', () => {
  describe('Environment Configuration', () => {
    it('should have test environment variables configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.REDIS_URL).toBeDefined();
    });

    it('should validate test environment', () => {
      expect(TestEnvironmentUtils.isTestEnvironment()).toBe(true);
    });
  });

  describe('Custom Matchers', () => {
    it('should validate UUIDs correctly', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const invalidUUID = 'not-a-uuid';

      expect(validUUID).toBeValidUUID();
      expect(invalidUUID).not.toBeValidUUID();
    });

    it('should validate emails correctly', () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'not-an-email';

      expect(validEmail).toBeValidEmail();
      expect(invalidEmail).not.toBeValidEmail();
    });

    it('should validate test scripts correctly', () => {
      expect(testScriptFixtures.webTest).toBeValidTestScript();
      expect(testScriptFixtures.apiTest).toBeValidTestScript();
    });

    it('should validate recording sessions correctly', () => {
      expect(recordingSessionFixtures.activeSession).toBeValidRecordingSession();
      expect(recordingSessionFixtures.completedSession).toBeValidRecordingSession();
    });

    it('should validate API responses correctly', () => {
      expect(apiFixtures.loginResponse).toMatchApiResponse();
      expect(apiFixtures.errorResponse).toMatchApiResponse();
    });

    it('should validate timestamps correctly', () => {
      const validDate = new Date();
      const validDateString = '2024-01-01T00:00:00Z';
      const invalidDate = 'not-a-date';

      expect(validDate).toHaveValidTimestamp();
      expect(validDateString).toHaveValidTimestamp();
      expect(invalidDate).not.toHaveValidTimestamp();
    });
  });

  describe('Test Utilities', () => {
    describe('MockDataGenerator', () => {
      it('should generate valid user data', () => {
        const user = MockDataGenerator.generateUser();
        
        TestAssertions.expectValidUser(user);
        expect(user.email).toContain('@example.com');
        expect(user.name).toBe('Test User');
      });

      it('should generate user data with overrides', () => {
        const user = MockDataGenerator.generateUser({
          name: 'Custom User',
          role: 'admin'
        });

        expect(user.name).toBe('Custom User');
        expect(user.role).toBe('admin');
      });

      it('should generate valid test script data', () => {
        const testScript = MockDataGenerator.generateTestScript();
        
        TestAssertions.expectValidTestScript(testScript);
        expect(testScript.name).toBe('Test Script');
      });

      it('should generate valid recording session data', () => {
        const session = MockDataGenerator.generateRecordingSession();
        
        TestAssertions.expectValidRecordingSession(session);
        expect(session.url).toBe('https://example.com');
      });
    });

    describe('ExpressMockUtils', () => {
      it('should create mock request objects', () => {
        const req = ExpressMockUtils.createMockRequest({
          body: { test: 'data' },
          params: { id: '123' }
        });

        expect(req.body).toEqual({ test: 'data' });
        expect(req.params).toEqual({ id: '123' });
        expect(req.query).toEqual({});
        expect(req.headers).toEqual({});
      });

      it('should create mock response objects', () => {
        const res = ExpressMockUtils.createMockResponse();

        expect(res.status).toBeDefined();
        expect(res.json).toBeDefined();
        expect(res.send).toBeDefined();
        expect(typeof res.status).toBe('function');
      });

      it('should create mock next function', () => {
        const next = ExpressMockUtils.createMockNext();
        
        expect(typeof next).toBe('function');
      });
    });

    describe('AsyncTestUtils', () => {
      it('should wait for conditions', async () => {
        let condition = false;
        
        setTimeout(() => {
          condition = true;
        }, 100);

        await AsyncTestUtils.waitFor(() => condition, 1000);
        expect(condition).toBe(true);
      });

      it('should timeout when condition is not met', async () => {
        await expect(
          AsyncTestUtils.waitFor(() => false, 100)
        ).rejects.toThrow('Condition not met within 100ms');
      });

      it('should handle sleep correctly', async () => {
        const start = Date.now();
        await AsyncTestUtils.sleep(100);
        const end = Date.now();
        
        expect(end - start).toBeGreaterThanOrEqual(90); // Allow some variance
      });

      it('should handle timeouts correctly', async () => {
        const slowPromise = new Promise(resolve => setTimeout(resolve, 200));
        
        await expect(
          AsyncTestUtils.withTimeout(slowPromise, 100)
        ).rejects.toThrow('Operation timed out after 100ms');
      });
    });

    describe('PerformanceTestUtils', () => {
      it('should measure execution time', async () => {
        const testFunction = async () => {
          await AsyncTestUtils.sleep(50);
          return 'result';
        };

        const { result, duration } = await PerformanceTestUtils.measureExecutionTime(testFunction);
        
        expect(result).toBe('result');
        expect(duration).toBeGreaterThan(40); // Allow some variance
        expect(duration).toBeLessThan(100);
      });

      it('should validate execution time', () => {
        PerformanceTestUtils.expectExecutionTimeUnder(50, 100);
        
        expect(() => {
          PerformanceTestUtils.expectExecutionTimeUnder(150, 100);
        }).toThrow();
      });
    });

    describe('ErrorTestUtils', () => {
      it('should test synchronous errors', () => {
        const throwingFunction = () => {
          throw new Error('Test error');
        };

        ErrorTestUtils.expectError(throwingFunction, Error, 'Test error');
      });

      it('should test asynchronous errors', async () => {
        const throwingAsyncFunction = async () => {
          throw new Error('Async test error');
        };

        await ErrorTestUtils.expectAsyncError(
          throwingAsyncFunction, 
          Error, 
          'Async test error'
        );
      });
    });
  });

  describe('Test Fixtures', () => {
    it('should provide valid user fixtures', () => {
      TestAssertions.expectValidUser(userFixtures.validUser);
      TestAssertions.expectValidUser(userFixtures.adminUser);
      TestAssertions.expectValidUser(userFixtures.premiumUser);
    });

    it('should provide valid test script fixtures', () => {
      TestAssertions.expectValidTestScript(testScriptFixtures.webTest);
      TestAssertions.expectValidTestScript(testScriptFixtures.apiTest);
    });

    it('should provide valid recording session fixtures', () => {
      TestAssertions.expectValidRecordingSession(recordingSessionFixtures.activeSession);
      TestAssertions.expectValidRecordingSession(recordingSessionFixtures.completedSession);
    });

    it('should provide valid API fixtures', () => {
      TestAssertions.expectSuccessfulApiResponse(apiFixtures.loginResponse);
      TestAssertions.expectErrorApiResponse(apiFixtures.errorResponse);
    });
  });

  describe('Test Assertions', () => {
    it('should validate successful API responses', () => {
      const response = {
        success: true,
        data: { message: 'Success' }
      };

      TestAssertions.expectSuccessfulApiResponse(response, { message: 'Success' });
    });

    it('should validate error API responses', () => {
      const response = {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        }
      };

      TestAssertions.expectErrorApiResponse(response, 'TEST_ERROR');
    });

    it('should validate paginated responses', () => {
      const response = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        data: [1, 2, 3, 4, 5]
      };

      TestAssertions.expectValidPaginatedResponse(response, 5);
    });
  });

  describe('Coverage and Reporting', () => {
    it('should be included in coverage reports', () => {
      // This test ensures that the test infrastructure itself is covered
      const testFunction = (input: string) => {
        if (input === 'test') {
          return 'success';
        }
        return 'failure';
      };

      expect(testFunction('test')).toBe('success');
      expect(testFunction('other')).toBe('failure');
    });

    it('should handle different test scenarios', () => {
      // Test different code paths for coverage
      const scenarios = ['scenario1', 'scenario2', 'scenario3'];
      
      scenarios.forEach(scenario => {
        expect(scenario).toBeDefined();
        expect(typeof scenario).toBe('string');
      });
    });
  });
});

describe('TypeScript Integration', () => {
  it('should support TypeScript features', () => {
    // Test TypeScript-specific features
    interface TestInterface {
      id: string;
      name: string;
      optional?: boolean;
    }

    const testObject: TestInterface = {
      id: '123',
      name: 'Test Object'
    };

    expect(testObject.id).toBe('123');
    expect(testObject.name).toBe('Test Object');
    expect(testObject.optional).toBeUndefined();
  });

  it('should support async/await', async () => {
    const asyncFunction = async (value: string): Promise<string> => {
      await AsyncTestUtils.sleep(10);
      return `processed-${value}`;
    };

    const result = await asyncFunction('test');
    expect(result).toBe('processed-test');
  });

  it('should support ES modules', () => {
    // Test that ES module imports work correctly
    expect(MockDataGenerator).toBeDefined();
    expect(ExpressMockUtils).toBeDefined();
    expect(AsyncTestUtils).toBeDefined();
    expect(TestAssertions).toBeDefined();
  });
});