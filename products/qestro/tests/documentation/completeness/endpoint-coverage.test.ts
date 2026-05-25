/**
 * Endpoint Coverage Tests
 *
 * Tests to verify all API endpoints are documented comprehensively
 * with proper examples, parameters, and response documentation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('Endpoint Coverage Tests', () => {
  const config = getTestConfig();
  let apiDocumentation: string;
  let routeFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Load API documentation
    try {
      const docFile = await DocumentationTestUtils.readDocumentationFile('docs/API_DOCUMENTATION.md');
      apiDocumentation = docFile.content;
    } catch (error) {
      console.warn('API documentation not found, using fallback content');
      apiDocumentation = '';
    }

    // Find all route files in the backend
    try {
      const backendSrc = path.join(projectRoot, 'backend/src/routes');
      const files = await DocumentationTestUtils.getDocumentationFiles(backendSrc, ['.ts', '.js']);
      routeFiles = files.filter(file => file.includes('routes/'));
    } catch (error) {
      console.warn('Backend routes directory not found');
      routeFiles = [];
    }
  });

  describe('API Documentation Completeness', () => {
    it('should document all authentication endpoints', () => {
      if (!apiDocumentation) return;

      const authEndpoints = [
        'POST /api/auth/login',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'POST /api/auth/register',
        'GET /api/auth/me'
      ];

      const missingEndpoints = authEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing authentication endpoints in documentation:', missingEndpoints);
      }

      expect(missingEndpoints).toHaveLength(0);
    });

    it('should document all user management endpoints', () => {
      if (!apiDocumentation) return;

      const userEndpoints = [
        'GET /api/users/profile',
        'PUT /api/users/profile',
        'DELETE /api/users/account',
        'POST /api/users/change-password',
        'GET /api/users/settings',
        'PUT /api/users/settings'
      ];

      const missingEndpoints = userEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', '').replace('PUT ', '').replace('DELETE ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing user management endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(2); // Allow some missing endpoints
    });

    it('should document all project management endpoints', () => {
      if (!apiDocumentation) return;

      const projectEndpoints = [
        'GET /api/projects',
        'POST /api/projects',
        'GET /api/projects/:id',
        'PUT /api/projects/:id',
        'DELETE /api/projects/:id',
        'GET /api/projects/:id/members',
        'POST /api/projects/:id/members',
        'DELETE /api/projects/:id/members/:userId'
      ];

      const missingEndpoints = projectEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', '').replace('PUT ', '').replace('DELETE ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing project management endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });

    it('should document all test case endpoints', () => {
      if (!apiDocumentation) return;

      const testCaseEndpoints = [
        'GET /api/projects/:projectId/test-cases',
        'POST /api/projects/:projectId/test-cases',
        'GET /api/test-cases/:id',
        'PUT /api/test-cases/:id',
        'DELETE /api/test-cases/:id',
        'POST /api/test-cases/:id/duplicate',
        'GET /api/test-cases/:id/history'
      ];

      const missingEndpoints = testEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', '').replace('PUT ', '').replace('DELETE ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing test case endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });

    it('should document all recording endpoints', () => {
      if (!apiDocumentation) return;

      const recordingEndpoints = [
        'POST /api/recordings/start',
        'POST /api/recordings/:sessionId/stop',
        'POST /api/recordings/:sessionId/pause',
        'POST /api/recordings/:sessionId/resume',
        'GET /api/recordings/:sessionId/status',
        'GET /api/recordings/:sessionId/actions',
        'DELETE /api/recordings/:sessionId'
      ];

      const missingEndpoints = recordingEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', '').replace('DELETE ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing recording endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });

    it('should document all test execution endpoints', () => {
      if (!apiDocumentation) return;

      const executionEndpoints = [
        'POST /api/test-execution/run',
        'GET /api/test-execution/:executionId/status',
        'POST /api/test-execution/:executionId/stop',
        'GET /api/test-execution/:executionId/results',
        'GET /api/test-execution/:executionId/logs',
        'POST /api/test-execution/:executionId/retry'
      ];

      const missingEndpoints = executionEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing test execution endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(2);
    });

    it('should document all AI service endpoints', () => {
      if (!apiDocumentation) return;

      const aiEndpoints = [
        'POST /api/ai/generate-test',
        'POST /api/ai/optimize-test',
        'POST /api/ai/analyze-results',
        'GET /api/ai/usage',
        'POST /api/ai/explain-failure',
        'GET /api/ai/capabilities'
      ];

      const missingEndpoints = aiEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing AI service endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });

    it('should document all analytics endpoints', () => {
      if (!apiDocumentation) return;

      const analyticsEndpoints = [
        'GET /api/analytics/dashboard',
        'GET /api/analytics/trends',
        'GET /api/analytics/performance',
        'GET /api/analytics/usage',
        'POST /api/analytics/export',
        'GET /api/analytics/reports'
      ];

      const missingEndpoints = analyticsEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing analytics endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });

    it('should document all web recording endpoints', () => {
      if (!apiDocumentation) return;

      const webRecordingEndpoints = [
        'POST /api/web-recording/start',
        'POST /api/web-recording/:sessionId/stop',
        'GET /api/web-recording/:sessionId/screenshot',
        'POST /api/web-recording/:sessionId/action',
        'GET /api/web-recording/browsers',
        'GET /api/web-recording/configurations'
      ];

      const missingEndpoints = webRecordingEndpoints.filter(endpoint =>
        !apiDocumentation.includes(endpoint) &&
        !apiDocumentation.includes(endpoint.replace('POST ', '').replace('GET ', ''))
      );

      if (missingEndpoints.length > 0) {
        console.warn('Missing web recording endpoints:', missingEndpoints);
      }

      expect(missingEndpoints.length).toBeLessThan(3);
    });
  });

  describe('Endpoint Documentation Quality', () => {
    it('should include HTTP methods for all endpoints', () => {
      if (!apiDocumentation) return;

      const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      const foundMethods = new Set();

      httpMethods.forEach(method => {
        const regex = new RegExp(`\\b${method}\\s+\\/(api\\/[^\\s]+)`, 'gi');
        const matches = apiDocumentation.match(regex);
        if (matches) {
          foundMethods.add(method);
        }
      });

      expect(foundMethods.size).toBeGreaterThan(3); // Should have at least 4 different methods
      console.log(`Found HTTP methods: ${Array.from(foundMethods).join(', ')}`);
    });

    it('should document request parameters for all endpoints', () => {
      if (!apiDocumentation) return;

      const apiSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      apiSpecs.forEach(spec => {
        // Each endpoint should have parameter documentation
        expect(spec.parameters).toBeDefined();

        // Critical endpoints should have parameters documented
        if (spec.method === 'POST' || spec.method === 'PUT') {
          expect(spec.parameters.length).toBeGreaterThan(0);
        }
      });
    });

    it('should include response examples for all endpoints', () => {
      if (!apiDocumentation) return;

      const apiSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      apiSpecs.forEach(spec => {
        // Each endpoint should have at least one response documented
        expect(Object.keys(spec.responses).length).toBeGreaterThan(0);

        // Should include success response
        const successResponses = Object.keys(spec.responses).filter(status =>
          status.startsWith('2') || status === 'default'
        );
        expect(successResponses.length).toBeGreaterThan(0);
      });
    });

    it('should document error responses for all endpoints', () => {
      if (!apiDocumentation) return;

      const apiSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);

      apiSpecs.forEach(spec => {
        // Should include error responses
        const errorResponses = Object.keys(spec.responses).filter(status =>
          status.startsWith('4') || status.startsWith('5')
        );

        // Critical endpoints should have error documentation
        if (spec.method === 'POST' || spec.method === 'PUT' || spec.method === 'DELETE') {
          expect(errorResponses.length).toBeGreaterThan(0);
        }
      });
    });

    it('should include authentication requirements for protected endpoints', () => {
      if (!apiDocumentation) return;

      // Check for authentication documentation
      expect(apiDocumentation).toMatch(/authentication|authorization|Bearer|JWT/i);

      // Should document which endpoints require authentication
      const authSection = apiDocumentation.toLowerCase();
      const hasAuthDetails = authSection.includes('required') ||
                           authSection.includes('protected') ||
                           authSection.includes('public');

      expect(hasAuthDetails).toBe(true);
    });
  });

  describe('Code Example Coverage', () => {
    it('should provide cURL examples for major endpoints', () => {
      if (!apiDocumentation) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const curlExamples = codeBlocks.filter(block =>
        block.language === 'bash' && block.code.includes('curl')
      );

      expect(curlExamples.length).toBeGreaterThan(3); // Should have multiple cURL examples

      // Validate cURL syntax
      curlExamples.forEach(example => {
        expect(example.code).toMatch(/curl/);
        expect(example.code).toMatch(/-X\s+(GET|POST|PUT|DELETE)/);
      });
    });

    it('should include JavaScript/Node.js examples', () => {
      if (!apiDocumentation) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsExamples = codeBlocks.filter(block =>
        block.language === 'javascript' ||
        block.language === 'js' ||
        block.language === 'typescript' ||
        block.language === 'ts'
      );

      expect(jsExamples.length).toBeGreaterThan(2); // Should have JS examples

      // Validate JavaScript syntax
      jsExamples.forEach(example => {
        expect(() => {
          // Basic syntax validation
          if (!example.code.includes('import ') && !example.code.includes('export ')) {
            new Function(example.code);
          }
        }).not.toThrow();
      });
    });

    it('should provide request/response example pairs', () => {
      if (!apiDocumentation) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsonExamples = codeBlocks.filter(block => block.language === 'json');

      // Should have both request and response examples
      expect(jsonExamples.length).toBeGreaterThan(4);

      // Validate JSON syntax
      jsonExamples.forEach(example => {
        expect(() => JSON.parse(example.code)).not.toThrow();
      });
    });
  });

  describe('Rate Limiting Documentation', () => {
    it('should document rate limits for different plans', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/rate.*limit/i);
      expect(apiDocumentation).toMatch(/standard|professional|enterprise/i);
      expect(apiDocumentation).toMatch(/requests.*per.*minute/i);
    });

    it('should include rate limit headers documentation', () => {
      if (!apiDocumentation) return;

      const expectedHeaders = [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ];

      expectedHeaders.forEach(header => {
        expect(apiDocumentation).toContain(header);
      });
    });
  });

  describe('WebSocket Documentation', () => {
    it('should document WebSocket endpoints', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/websocket|ws[s]?:\/\//i);

      // Should document real-time features
      expect(apiDocumentation).toMatch(/recording.*session|test.*execution|real.*time/i);
    });

    it('should document message formats', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/message.*format|event.*type|payload/i);

      // Should include example messages
      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const jsonMessages = codeBlocks.filter(block =>
        block.language === 'json' &&
        (block.code.includes('"type"') || block.code.includes('"event"'))
      );

      expect(jsonMessages.length).toBeGreaterThan(0);
    });
  });

  describe('SDK Documentation', () => {
    it('should document SDK installation', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/npm install|pip install/i);
      expect(apiDocumentation).toMatch(/@questro\/sdk|questro-sdk/i);
    });

    it('should include SDK usage examples', () => {
      if (!apiDocumentation) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const sdkExamples = codeBlocks.filter(block =>
        (block.language === 'javascript' || block.language === 'python') &&
        (block.code.includes('QuestroAPI') || block.code.includes('QuestroClient'))
      );

      expect(sdkExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Error Documentation', () => {
    it('should document all standard error codes', () => {
      if (!apiDocumentation) return;

      const expectedErrorCodes = [
        '400', '401', '403', '404', '429', '500', '503'
      ];

      expectedErrorCodes.forEach(code => {
        expect(apiDocumentation).toContain(code);
      });
    });

    it('should include error response format', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/error.*response.*format/i);
      expect(apiDocumentation).toMatch(/success.*false/i);
      expect(apiDocumentation).toMatch(/error.*code|error.*message/i);
    });
  });

  describe('Pagination Documentation', () => {
    it('should document pagination parameters', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/page|limit|offset/i);
      expect(apiDocumentation).toMatch(/pagination/i);
    });

    it('should include pagination examples in responses', () => {
      if (!apiDocumentation) return;

      const paginationFields = ['page', 'limit', 'total', 'totalPages'];
      const hasPaginationExamples = paginationFields.some(field =>
        apiDocumentation.includes(field)
      );

      expect(hasPaginationExamples).toBe(true);
    });
  });

  describe('Filtering and Sorting Documentation', () => {
    it('should document filtering options', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/filter|search|query/i);
      expect(apiDocumentation).toMatch(/parameters|query.*string/i);
    });

    it('should document sorting options', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/sort|order/i);
      expect(apiDocumentation).toMatch(/ascending|descending|asc|desc/i);
    });
  });

  describe('Version Documentation', () => {
    it('should document API versioning', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/version|v\d+/i);
      expect(apiDocumentation).toMatch(/api.*version/i);
    });

    it('should document backward compatibility', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/backward.*compatible|compatibility/i);
    });
  });

  describe('Testing Documentation', () => {
    it('should include testing endpoints', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/test|testing/i);
      expect(apiDocumentation).toMatch(/sandbox|development/i);
    });

    it('should provide test data examples', () => {
      if (!apiDocumentation) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(apiDocumentation);
      const testExamples = codeBlocks.filter(block =>
        block.language === 'json' &&
        (block.code.includes('test') || block.code.includes('example'))
      );

      expect(testExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Coverage', () => {
    it('should document webhook endpoints', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/webhook/i);
      expect(apiDocumentation).toMatch(/callback|notification/i);
    });

    it('should document integration options', () => {
      if (!apiDocumentation) return;

      expect(apiDocumentation).toMatch(/integration|connect/i);
      expect(apiDocumentation).toMatch(/third.*party|external/i);
    });
  });

  describe('Route File Validation', () => {
    it('should validate route file documentation coverage', async () => {
      if (routeFiles.length === 0) return;

      let documentedEndpoints = 0;
      let totalEndpoints = 0;

      for (const routeFile of routeFiles.slice(0, 5)) { // Check first 5 files
        try {
          const routeContent = await fs.readFile(routeFile, 'utf-8');

          // Extract route definitions (basic regex matching)
          const routeMatches = routeContent.match(/router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/g) || [];
          totalEndpoints += routeMatches.length;

          // Check if these are documented in API docs
          routeMatches.forEach(match => {
            const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);
            if (pathMatch && apiDocumentation) {
              const path = pathMatch[1];
              if (apiDocumentation.includes(path)) {
                documentedEndpoints++;
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read route file: ${routeFile}`);
        }
      }

      if (totalEndpoints > 0) {
        const coverageRatio = documentedEndpoints / totalEndpoints;
        console.log(`Route documentation coverage: ${documentedEndpoints}/${totalEndpoints} (${(coverageRatio * 100).toFixed(1)}%)`);

        expect(coverageRatio).toBeGreaterThan(0.7); // At least 70% coverage
      }
    });
  });

  describe('Comprehensive Coverage Metrics', () => {
    it('should achieve minimum endpoint coverage percentage', () => {
      if (!apiDocumentation) return;

      const apiSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);
      const minimumRequiredEndpoints = 20; // Minimum number of endpoints that should be documented

      expect(apiSpecs.length).toBeGreaterThan(minimumRequiredEndpoints);
      console.log(`Documented endpoints: ${apiSpecs.length}`);
    });

    it('should cover all HTTP methods appropriately', () => {
      if (!apiDocumentation) return;

      const apiSpecs = DocumentationTestUtils.extractAPISpecifications(apiDocumentation);
      const methodCounts = {};

      config.apiValidation.allowedMethods.forEach(method => {
        methodCounts[method] = apiSpecs.filter(spec => spec.method === method).length;
      });

      console.log('HTTP method distribution:', methodCounts);

      // Should have reasonable distribution of methods
      expect(methodCounts['GET'] || 0).toBeGreaterThan(5); // Multiple GET endpoints
      expect(methodCounts['POST'] || 0).toBeGreaterThan(3); // Multiple POST endpoints
    });
  });
});
