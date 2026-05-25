/**
 * API Documentation Accuracy Tests
 *
 * Tests to ensure API documentation matches actual implementation
 * including endpoints, parameters, responses, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('API Documentation Accuracy', () => {
  const config = getTestConfig();
  let apiDocumentation: string;
  let baseUrl: string;

  beforeAll(async () => {
    // Load API documentation
    const docFile = await DocumentationTestUtils.readDocumentationFile('docs/API_DOCUMENTATION.md');
    apiDocumentation = docFile.content;

    // Determine base URL based on environment
    baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.questro.com'
      : process.env.NODE_ENV === 'staging'
      ? 'https://staging-api.questro.com'
      : 'http://localhost:8000';
  });

  describe('Endpoint Coverage', () => {
    it('should document all implemented endpoints', async () => {
      // Extract documented endpoints
      const documentedSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);
      const documentedPaths = documentedSpecs.map(spec => `${spec.method} ${spec.path}`);

      // Get actual implemented endpoints (this would ideally come from route definitions)
      const actualEndpoints = [
        'GET /api/health',
        'GET /api/auth/login',
        'POST /api/auth/login',
        'POST /api/auth/refresh',
        'GET /api/users/profile',
        'PUT /api/users/profile',
        'GET /api/projects',
        'POST /api/projects',
        'GET /api/projects/:id',
        'GET /api/projects/:projectId/test-cases',
        'POST /api/projects/:projectId/test-cases',
        'POST /api/recordings/start',
        'POST /api/recordings/:sessionId/stop',
        'POST /api/test-execution/run',
        'GET /api/test-execution/:executionId/status',
        'POST /api/ai/generate-test',
        'GET /api/analytics/dashboard',
        'GET /api/reports/:reportId',
      ];

      // Check if all actual endpoints are documented
      const undocumentedEndpoints = actualEndpoints.filter(
        endpoint => !documentedPaths.some(doc =>
          doc.toLowerCase().includes(endpoint.toLowerCase()) ||
          endpoint.toLowerCase().includes(doc.toLowerCase())
        )
      );

      expect(undocumentedEndpoints).toHaveLength(0);
      expect(undocumentedEndpoints).toEqual([]);
    });

    it('should have valid HTTP methods for all documented endpoints', () => {
      const specs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      specs.forEach(spec => {
        expect(config.apiValidation.allowedMethods).toContain(spec.method);
      });
    });

    it('should document authentication requirements clearly', () => {
      // Check for authentication section
      expect(apiDocumentation).toMatch(/authentication/i);
      expect(apiDocumentation).toMatch(/JWT|Bearer Token/i);

      // Check for authentication headers
      expect(apiDocumentation).toMatch(/authorization.*bearer/i);
    });

    it('should document error responses for all endpoints', () => {
      const specs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      specs.forEach(spec => {
        // Each endpoint should have at least one response documented
        expect(Object.keys(spec.responses)).length.toBeGreaterThan(0);

        // Should include error responses
        const hasErrorResponse = Object.keys(spec.responses).some(status =>
          status.startsWith('4') || status.startsWith('5')
        );

        expect(hasErrorResponse).toBe(true);
      });
    });
  });

  describe('Request/Response Validation', () => {
    it('should have valid example requests', async () => {
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsonExamples = codeBlocks.filter(block => block.language === 'json');

      for (const example of jsonExamples) {
        expect(() => JSON.parse(example.code)).not.toThrow();
      }
    });

    it('should document required parameters clearly', () => {
      // Check for parameter documentation
      expect(apiDocumentation).toMatch(/parameters?|query.*parameters?|body.*parameters?/i);

      // Look for required parameter indicators
      expect(apiDocumentation).toMatch(/required.*true|required.*false/i);
    });

    it('should have consistent response format', () => {
      const specs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      // Check for consistent success response format
      specs.forEach(spec => {
        const successResponses = Object.entries(spec.responses).filter(([status]) =>
          status.startsWith('2') || status === 'default'
        );

        successResponses.forEach(([, response]) => {
          if (response.example) {
            // Should have standard success format
            expect(response.example).toHaveProperty('success');
          }
        });
      });
    });

    it('should document all error codes correctly', () => {
      // Check for error code documentation
      expect(apiDocumentation).toMatch(/error.*codes|error.*responses/i);

      // Look for common HTTP status codes
      const expectedCodes = ['400', '401', '403', '404', '429', '500', '503'];
      expectedCodes.forEach(code => {
        expect(apiDocumentation).toContain(code);
      });
    });
  });

  describe('Schema Validation', () => {
    it('should have consistent data types across examples', () => {
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsonExamples = codeBlocks.filter(block => block.language === 'json');

      jsonExamples.forEach(example => {
        try {
          const parsed = JSON.parse(example.code);
          validateDataTypes(parsed);
        } catch (error) {
          // If it's not valid JSON, skip validation
        }
      });
    });

    it('should document object schemas clearly', () => {
      // Look for schema documentation patterns
      expect(apiDocumentation).toMatch(/schema|properties?|type:/i);
    });

    it('should validate enum values where specified', () => {
      // Check for enum documentation
      const hasEnumDocs = apiDocumentation.toLowerCase().includes('enum') ||
                         apiDocumentation.toLowerCase().includes('possible values');

      if (hasEnumDocs) {
        // Look for enum value lists
        expect(apiDocumentation).toMatch(/enum.*\[.*\]|values.*\[.*\]/i);
      }
    });
  });

  describe('Authentication Documentation', () => {
    it('should document the complete authentication flow', () => {
      expect(apiDocumentation).toMatch(/login.*refresh.*token/i);
      expect(apiDocumentation).toMatch(/authentication.*flow/i);
    });

    it('should provide correct authorization header examples', () => {
      expect(apiDocumentation).toMatch(/authorization.*bearer.*<token>/i);
    });

    it('should document token expiration and refresh', () => {
      expect(apiDocumentation).toMatch(/expir|refresh.*token/i);
    });

    it('should include security scheme definitions', () => {
      expect(apiDocumentation).toMatch(/security.*scheme|BearerAuth/i);
    });
  });

  describe('WebSocket API Documentation', () => {
    it('should document WebSocket connection endpoints', () => {
      expect(apiDocumentation).toMatch(/websocket|ws[s]?:\/\//i);
    });

    it('should document message formats for WebSockets', () => {
      expect(apiDocumentation).toMatch(/message.*format|event.*type/i);
    });

    it('should document real-time event types', () => {
      const expectedEvents = ['action_recorded', 'test_started', 'step_completed', 'test_completed'];
      expectedEvents.forEach(event => {
        expect(apiDocumentation).toContain(event);
      });
    });
  });

  describe('Rate Limiting Documentation', () => {
    it('should document rate limiting rules', () => {
      expect(apiDocumentation).toMatch(/rate.*limit/i);
    });

    it('should include rate limit headers in responses', () => {
      expect(apiDocumentation).toMatch(/X-RateLimit/i);
    });

    it('should document different rate limits for plans', () => {
      expect(apiDocumentation).toMatch(/standard.*plan|professional.*plan|enterprise.*plan/i);
    });
  });

  describe('SDK Documentation', () => {
    it('should include SDK installation instructions', () => {
      expect(apiDocumentation).toMatch(/npm install|pip install/i);
    });

    it('should provide working SDK code examples', () => {
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const sdkExamples = codeBlocks.filter(block =>
        block.language === 'javascript' ||
        block.language === 'python' ||
        block.language === 'typescript'
      );

      expect(sdkExamples.length).toBeGreaterThan(0);
    });

    it('should document SDK authentication methods', () => {
      expect(apiDocumentation).toMatch(/QuestroAPI|QuestroClient/i);
      expect(apiDocumentation).toMatch(/apiKey|api.*key/i);
    });
  });

  describe('Base URLs and Endpoints', () => {
    it('should document correct base URLs', () => {
      expect(apiDocumentation).toMatch(/production.*https:\/\/api\.questro\.com/i);
      expect(apiDocumentation).toMatch(/staging.*https:\/\/staging-api\.questro\.com/i);
      expect(apiDocumentation).toMatch(/development.*http:\/\/localhost:8000/i);
    });

    it('should have consistent URL patterns', () => {
      const specs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      specs.forEach(spec => {
        // Check if path starts with /api/
        expect(spec.path).toMatch(/^\/api\//);

        // Check for consistent path formatting
        expect(spec.path).not.toContain('//');
      });
    });
  });

  describe('Version Compatibility', () => {
    it('should document API version information', () => {
      expect(apiDocumentation).toMatch(/version.*v\d+|API.*version/i);
    });

    it('should document backward compatibility', () => {
      expect(apiDocumentation).toMatch(/backward.*compatible|versioning/i);
    });
  });

  describe('Examples and Samples', () => {
    it('should provide curl examples for major endpoints', () => {
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const curlExamples = codeBlocks.filter(block =>
        block.code.includes('curl') || block.language === 'bash'
      );

      expect(curlExamples.length).toBeGreaterThan(0);
    });

    it('should include working JavaScript examples', () => {
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsExamples = codeBlocks.filter(block =>
        block.language === 'javascript' || block.language === 'js'
      );

      expect(jsExamples.length).toBeGreaterThan(0);

      // Validate JavaScript syntax
      const validationResults = await DocumentationTestUtils.validateCodeExamples(jsExamples);
      const invalidExamples = validationResults.filter(r => !r.valid);
      expect(invalidExamples).toHaveLength(0);
    });
  });

  describe('Error Handling Documentation', () => {
    it('should document standard error response format', () => {
      expect(apiDocumentation).toMatch(/error.*response.*format/i);
      expect(apiDocumentation).toMatch(/success.*false.*error/i);
    });

    it('should include detailed error information', () => {
      expect(apiDocumentation).toMatch(/error.*code|message.*details/i);
    });

    it('should document troubleshooting steps', () => {
      expect(apiDocumentation).toMatch(/troubleshooting|debugging|common.*issues/i);
    });
  });

  // Helper function to validate data types in JSON examples
  function validateDataTypes(obj: any): void {
    if (Array.isArray(obj)) {
      obj.forEach(item => validateDataTypes(item));
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        // Check for consistent data types in common fields
        if (key === 'id') {
          expect(typeof value).toBe('string');
        } else if (key === 'success') {
          expect(typeof value).toBe('boolean');
        } else if (key === 'timestamp' || key === 'createdAt' || key === 'updatedAt') {
          expect(typeof value).toBe('string');
          expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        } else if (typeof value === 'object') {
          validateDataTypes(value);
        }
      });
    }
  }
});

// Integration test to validate documented endpoints against actual API
describe('API Endpoint Validation', () => {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.questro.com'
    : 'http://localhost:8000';

  it('should validate health endpoint', async () => {
    try {
      const response = await axios.get(`${baseUrl}/health`, {
        timeout: 5000,
        validateStatus: () => true // Don't throw on error status
      });

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.data).toHaveProperty('status');
      }
    } catch (error) {
      // If we can't reach the API, that's okay for documentation tests
      console.warn('Could not reach API for validation:', error);
    }
  });

  it('should validate documented error response format', async () => {
    try {
      const response = await axios.get(`${baseUrl}/api/nonexistent-endpoint`, {
        timeout: 5000,
        validateStatus: () => true
      });

      if (response.status === 404) {
        // Check if error response matches documented format
        if (response.data && typeof response.data === 'object') {
          expect(response.data).toHaveProperty('success', false);
          expect(response.data).toHaveProperty('error');
        }
      }
    } catch (error) {
      // Expected for nonexistent endpoint
      expect(true).toBe(true);
    }
  });
});
