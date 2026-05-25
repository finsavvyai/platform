/**
 * Custom Jest Matchers
 * Provides domain-specific matchers for better test assertions
 */

import { expect } from '@jest/globals';

// Extend Jest matchers interface
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidTestScript(): R;
      toBeValidRecordingSession(): R;
      toBeValidTestExecution(): R;
      toHaveValidTimestamp(): R;
      toMatchApiResponse(): R;
      toHaveValidPagination(): R;
      toBeWithinTimeRange(start: Date, end: Date): R;
      toHaveValidErrorStructure(): R;
    }
  }
}

// UUID validation matcher
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
      pass,
    };
  },
});

// Email validation matcher
expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`,
      pass,
    };
  },
});

// Test script validation matcher
expect.extend({
  toBeValidTestScript(received: any) {
    const requiredFields = ['id', 'userId', 'name', 'type', 'framework', 'content'];
    const hasRequiredFields = requiredFields.every(field => received && received[field] !== undefined);
    
    const hasValidContent = received?.content && 
                           Array.isArray(received.content.actions) && 
                           Array.isArray(received.content.assertions);

    const pass = hasRequiredFields && hasValidContent;

    return {
      message: () =>
        pass
          ? `Expected object not to be a valid test script`
          : `Expected object to be a valid test script with required fields: ${requiredFields.join(', ')}`,
      pass,
    };
  },
});

// Recording session validation matcher
expect.extend({
  toBeValidRecordingSession(received: any) {
    const requiredFields = ['id', 'userId', 'url', 'browserInfo', 'viewport', 'status'];
    const hasRequiredFields = requiredFields.every(field => received && received[field] !== undefined);
    
    const hasValidBrowserInfo = received?.browserInfo && 
                               received.browserInfo.name && 
                               received.browserInfo.version;

    const hasValidViewport = received?.viewport && 
                            typeof received.viewport.width === 'number' && 
                            typeof received.viewport.height === 'number';

    const validStatuses = ['active', 'completed', 'failed', 'cancelled'];
    const hasValidStatus = validStatuses.includes(received?.status);

    const pass = hasRequiredFields && hasValidBrowserInfo && hasValidViewport && hasValidStatus;

    return {
      message: () =>
        pass
          ? `Expected object not to be a valid recording session`
          : `Expected object to be a valid recording session`,
      pass,
    };
  },
});

// Test execution validation matcher
expect.extend({
  toBeValidTestExecution(received: any) {
    const requiredFields = ['id', 'testScriptId', 'environment', 'status', 'executedAt'];
    const hasRequiredFields = requiredFields.every(field => received && received[field] !== undefined);
    
    const validStatuses = ['passed', 'failed', 'running', 'cancelled', 'skipped'];
    const hasValidStatus = validStatuses.includes(received?.status);

    const hasValidEnvironment = received?.environment && received.environment.name;

    const pass = hasRequiredFields && hasValidStatus && hasValidEnvironment;

    return {
      message: () =>
        pass
          ? `Expected object not to be a valid test execution`
          : `Expected object to be a valid test execution`,
      pass,
    };
  },
});

// Timestamp validation matcher
expect.extend({
  toHaveValidTimestamp(received: any) {
    const timestamp = received instanceof Date ? received : new Date(received);
    const pass = timestamp instanceof Date && !isNaN(timestamp.getTime());

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid timestamp`
          : `Expected ${received} to be a valid timestamp`,
      pass,
    };
  },
});

// API response validation matcher
expect.extend({
  toMatchApiResponse(received: any) {
    const hasSuccessField = received && typeof received.success === 'boolean';
    const hasDataOrError = received && (received.data !== undefined || received.error !== undefined);
    
    const pass = hasSuccessField && hasDataOrError;

    return {
      message: () =>
        pass
          ? `Expected object not to match API response structure`
          : `Expected object to match API response structure with 'success' field and 'data' or 'error'`,
      pass,
    };
  },
});

// Pagination validation matcher
expect.extend({
  toHaveValidPagination(received: any) {
    const requiredFields = ['page', 'limit', 'total', 'totalPages'];
    const hasRequiredFields = requiredFields.every(field => 
      received && typeof received[field] === 'number' && received[field] >= 0
    );
    
    const hasValidData = received && Array.isArray(received.data);
    
    const pass = hasRequiredFields && hasValidData;

    return {
      message: () =>
        pass
          ? `Expected object not to have valid pagination`
          : `Expected object to have valid pagination with fields: ${requiredFields.join(', ')}`,
      pass,
    };
  },
});

// Time range validation matcher
expect.extend({
  toBeWithinTimeRange(received: Date | string, start: Date, end: Date) {
    const timestamp = received instanceof Date ? received : new Date(received);
    const pass = timestamp >= start && timestamp <= end;

    return {
      message: () =>
        pass
          ? `Expected ${timestamp.toISOString()} not to be within range ${start.toISOString()} - ${end.toISOString()}`
          : `Expected ${timestamp.toISOString()} to be within range ${start.toISOString()} - ${end.toISOString()}`,
      pass,
    };
  },
});

// Error structure validation matcher
expect.extend({
  toHaveValidErrorStructure(received: any) {
    const hasErrorField = received && received.error;
    const hasCode = received?.error?.code && typeof received.error.code === 'string';
    const hasMessage = received?.error?.message && typeof received.error.message === 'string';
    
    const pass = hasErrorField && hasCode && hasMessage;

    return {
      message: () =>
        pass
          ? `Expected object not to have valid error structure`
          : `Expected object to have valid error structure with 'error.code' and 'error.message'`,
      pass,
    };
  },
});

// Export custom matchers setup function
export function setupCustomMatchers() {
  // Custom matchers are automatically extended when this module is imported
  console.log('Custom Jest matchers loaded');
}

// Test utilities for common assertions
export class TestAssertions {
  static expectValidUser(user: any) {
    expect(user).toBeDefined();
    expect(user.id).toBeValidUUID();
    expect(user.email).toBeValidEmail();
    expect(user.name).toBeDefined();
    expect(user.role).toMatch(/^(user|admin|moderator)$/);
    expect(user.createdAt).toHaveValidTimestamp();
  }

  static expectValidTestScript(testScript: any) {
    expect(testScript).toBeValidTestScript();
    expect(testScript.id).toBeValidUUID();
    expect(testScript.userId).toBeValidUUID();
    expect(testScript.createdAt).toHaveValidTimestamp();
    expect(testScript.updatedAt).toHaveValidTimestamp();
  }

  static expectValidRecordingSession(session: any) {
    expect(session).toBeValidRecordingSession();
    expect(session.id).toBeValidUUID();
    expect(session.userId).toBeValidUUID();
    expect(session.createdAt).toHaveValidTimestamp();
  }

  static expectValidTestExecution(execution: any) {
    expect(execution).toBeValidTestExecution();
    expect(execution.id).toBeValidUUID();
    expect(execution.testScriptId).toBeValidUUID();
    expect(execution.executedAt).toHaveValidTimestamp();
  }

  static expectSuccessfulApiResponse(response: any, expectedData?: any) {
    expect(response).toMatchApiResponse();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    
    if (expectedData) {
      expect(response.data).toMatchObject(expectedData);
    }
  }

  static expectErrorApiResponse(response: any, expectedCode?: string) {
    expect(response).toMatchApiResponse();
    expect(response.success).toBe(false);
    expect(response).toHaveValidErrorStructure();
    
    if (expectedCode) {
      expect(response.error.code).toBe(expectedCode);
    }
  }

  static expectValidPaginatedResponse(response: any, expectedItemCount?: number) {
    expect(response).toHaveValidPagination();
    
    if (expectedItemCount !== undefined) {
      expect(response.data).toHaveLength(expectedItemCount);
    }
  }
}

export { TestAssertions };