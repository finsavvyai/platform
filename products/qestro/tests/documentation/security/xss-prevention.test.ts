/**
 * XSS Prevention Tests
 *
 * Tests to ensure documentation does not contain XSS vulnerabilities
 * and user input sanitization is properly documented.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('XSS Prevention Security Tests', () => {
  const config = getTestConfig();
  let documentationFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Get all documentation files
    documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      path.join(projectRoot, 'docs'),
      ['.md', '.html', '.txt', '.json']
    );

    console.log(`Found ${documentationFiles.length} documentation files for XSS testing`);
  });

  describe('XSS Payload Detection', () => {
    it('should not contain XSS attack vectors in documentation', () => {
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick, onload, etc.
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi,
        /<embed[^>]*>/gi,
        /<link[^>]*>/gi,
        /<meta[^>]*>/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /<img[^>]*onerror[^>]*>/gi,
        /<svg[^>]*>.*?<script[^>]*>.*?<\/script>.*?<\/svg>/gi,
        /expression\s*\(/gi, // CSS expression
      ];

      const xssVulnerabilities: Array<{ file: string; type: string; line?: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          xssPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Check if it's clearly documentation/examples vs actual malicious code
                const isExample = match.toLowerCase().includes('example') ||
                                match.toLowerCase().includes('malicious') ||
                                match.toLowerCase().includes('attack') ||
                                match.toLowerCase().includes('xss') ||
                                match.toLowerCase().includes('do not') ||
                                match.includes('`') || // Code block indicators
                                match.includes('\\'); // Escaped characters

                if (!isExample) {
                  xssVulnerabilities.push({
                    file: filePath,
                    type: 'xss_pattern',
                    line: match.substring(0, 100) + (match.length > 100 ? '...' : '')
                  });
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for XSS check: ${filePath}`);
        }
      }

      if (xssVulnerabilities.length > 0) {
        console.error('POTENTIAL XSS VULNERABILITIES FOUND:', xssVulnerabilities);
      }

      expect(xssVulnerabilities).toHaveLength(0);
    });

    it('should not contain HTML event handlers in user-facing content', () => {
      const eventHandlerPatterns = [
        /onclick\s*=/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onmouseover\s*=/gi,
        /onfocus\s*=/gi,
        /onblur\s*=/gi,
        /onchange\s*=/gi,
        /onsubmit\s*=/gi,
        /onkeydown\s*=/gi,
        /onkeyup\s*=/gi,
        /onkeypress\s*=/gi,
      ];

      const eventHandlerVulnerabilities: Array<{ file: string; handler: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          eventHandlerPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Check if it's in code examples or clearly marked as documentation
                const isExample = content.includes('```') ||
                                content.includes('example') ||
                                content.includes('malicious') ||
                                content.includes('attack');

                if (!isExample) {
                  eventHandlerVulnerabilities.push({
                    file: filePath,
                    handler: match.trim()
                  });
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for event handler check: ${filePath}`);
        }
      }

      if (eventHandlerVulnerabilities.length > 0) {
        console.warn('Potentially unsafe event handlers found:', eventHandlerVulnerabilities);
      }

      expect(eventHandlerVulnerabilities).toHaveLength(0);
    });

    it('should not contain dangerous HTML attributes', () => {
      const dangerousAttributePatterns = [
        /formaction\s*=/gi,
        /href\s*=\s*["']javascript:/gi,
        /src\s*=\s*["']javascript:/gi,
        /style\s*=\s*["'][^"']*expression\s*\(/gi,
        /background\s*=\s*["']javascript:/gi,
        /dynsrc\s*=/gi,
        /lowsrc\s*=/gi,
      ];

      const dangerousAttributes: Array<{ file: string; attribute: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          dangerousAttributePatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Check if it's clearly documentation or examples
                const isExample = content.includes('```') ||
                                content.includes('example') ||
                                content.includes('malicious') ||
                                content.includes('attack');

                if (!isExample) {
                  dangerousAttributes.push({
                    file: filePath,
                    attribute: match.trim()
                  });
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for dangerous attribute check: ${filePath}`);
        }
      }

      if (dangerousAttributes.length > 0) {
        console.warn('Dangerous HTML attributes found:', dangerousAttributes);
      }

      expect(dangerousAttributes).toHaveLength(0);
    });
  });

  describe('Input Sanitization Documentation', () => {
    it('should document input sanitization requirements', async () => {
      let sanitizationDocs = false;
      let sanitizationDetails = 0;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('input sanitization') ||
              content.includes('sanitize input') ||
              content.includes('input validation') ||
              content.includes('xss prevention') ||
              content.includes('escape input') ||
              content.includes('clean input')) {
            sanitizationDocs = true;

            // Check for specific sanitization methods
            if (content.includes('escape') ||
                content.includes('encode') ||
                content.includes('sanitize') ||
                content.includes('validate') ||
                content.includes('filter')) {
              sanitizationDetails++;
            }
          }
        } catch (error) {
          console.warn(`Could not read file for sanitization docs check: ${filePath}`);
        }
      }

      expect(sanitizationDocs).toBe(true);
      expect(sanitizationDetails).toBeGreaterThan(0);
    });

    it('should document XSS prevention techniques', async () => {
      let xssPreventionDocs = false;
      let preventionTechniques = 0;

      const expectedTechniques = [
        'content security policy',
        'csp',
        'output encoding',
        'html escaping',
        'contextual encoding',
        'input validation',
        'xss protection',
        'secure headers',
        'http-only cookies',
        'same-site cookies'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          expectedTechniques.forEach(technique => {
            if (content.includes(technique)) {
              preventionTechniques++;
            }
          });

          if (content.includes('xss prevention') ||
              content.includes('prevent xss') ||
              content.includes('cross-site scripting') ||
              content.includes('xss protection')) {
            xssPreventionDocs = true;
          }
        } catch (error) {
          console.warn(`Could not read file for XSS prevention docs check: ${filePath}`);
        }
      }

      expect(xssPreventionDocs).toBe(true);
      expect(preventionTechniques).toBeGreaterThan(2); // Should document multiple techniques
    });

    it('should include secure coding examples', async () => {
      let secureExamples = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          // Look for secure coding patterns in code examples
          const codeBlocks = DocumentationTestUtils.extractCodeBlocks(content);

          for (const block of codeBlocks) {
            const blockContent = block.code.toLowerCase();

            if ((blockContent.includes('escape') ||
                 blockContent.includes('encode') ||
                 blockContent.includes('sanitize') ||
                 blockContent.includes('validate')) &&
                (blockContent.includes('input') ||
                 blockContent.includes('output') ||
                 blockContent.includes('html') ||
                 blockContent.includes('xss'))) {
              secureExamples = true;
              break;
            }
          }

          if (secureExamples) break;
        } catch (error) {
          console.warn(`Could not read file for secure examples check: ${filePath}`);
        }
      }

      expect(secureExamples).toBe(true);
    });
  });

  describe('Content Security Policy Documentation', () => {
    it('should document CSP implementation', async () => {
      let cspDocs = false;
      let cspDetails = 0;

      const cspDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'connect-src',
        'font-src',
        'object-src',
        'media-src',
        'frame-src',
        'child-src',
        'worker-src',
        'manifest-src',
        'upgrade-insecure-requests'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('content security policy') ||
              content.includes('csp') ||
              content.includes('security policy')) {
            cspDocs = true;

            cspDirectives.forEach(directive => {
              if (content.includes(directive)) {
                cspDetails++;
              }
            });
          }
        } catch (error) {
          console.warn(`Could not read file for CSP docs check: ${filePath}`);
        }
      }

      expect(cspDocs).toBe(true);
      expect(cspDetails).toBeGreaterThan(2); // Should document multiple CSP directives
    });

    it('should provide CSP configuration examples', async () => {
      let cspExamples = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          // Look for CSP examples in code blocks
          const codeBlocks = DocumentationTestUtils.extractCodeBlocks(content);

          for (const block of codeBlocks) {
            const blockContent = block.code.toLowerCase();

            if ((blockContent.includes('content-security-policy') ||
                 blockContent.includes('csp') ||
                 blockContent.includes('script-src') ||
                 blockContent.includes('default-src')) &&
                (block.language === 'http' ||
                 block.language === 'nginx' ||
                 block.language === 'apache' ||
                 block.language === 'javascript' ||
                 block.language === 'html')) {
              cspExamples = true;
              break;
            }
          }

          if (cspExamples) break;
        } catch (error) {
          console.warn(`Could not read file for CSP examples check: ${filePath}`);
        }
      }

      expect(cspExamples).toBe(true);
    });
  });

  describe('Safe HTML Rendering Documentation', () => {
    it('should document safe HTML rendering practices', async () => {
      let safeRenderingDocs = false;
      let safeTechniques = 0;

      const safeRenderingTechniques = [
        'textcontent',
        'innertext',
        'setattribute',
        'createelement',
        'createTextNode',
        'dompurify',
        'sanitize html',
        'safe html',
        'html sanitizer'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          safeRenderingTechniques.forEach(technique => {
            if (content.includes(technique)) {
              safeTechniques++;
            }
          });

          if (content.includes('safe html rendering') ||
              content.includes('safe dom manipulation') ||
              content.includes('avoid innerhtml') ||
              content.includes('safe dom')) {
            safeRenderingDocs = true;
          }
        } catch (error) {
          console.warn(`Could not read file for safe rendering docs check: ${filePath}`);
        }
      }

      expect(safeRenderingDocs).toBe(true);
      expect(safeTechniques).toBeGreaterThan(2);
    });

    it('should warn against dangerous DOM methods', async () => {
      let dangerousMethodWarnings = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          // Should warn about these dangerous methods
          const dangerousMethods = ['innerhtml', 'outerhtml', 'document.write', 'eval'];
          let hasDangerousMethods = dangerousMethods.some(method => content.includes(method));

          // Should also have warnings
          const hasWarnings = content.includes('avoid') ||
                             content.includes('dangerous') ||
                             content.includes('warning') ||
                             content.includes('do not use') ||
                             content.includes('unsafe');

          if (hasDangerousMethods && hasWarnings) {
            dangerousMethodWarnings = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for dangerous method warnings check: ${filePath}`);
        }
      }

      expect(dangerousMethodWarnings).toBe(true);
    });
  });

  describe('Template Engine Security', () => {
    it('should document template engine security', async () => {
      let templateSecurityDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('template security') ||
              content.includes('template injection') ||
              content.includes('template escaping') ||
              content.includes('autoescaping') ||
              content.includes('template engine security')) {
            templateSecurityDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for template security docs check: ${filePath});
        }
      }

      expect(templateSecurityDocs).toBe(true);
    });

    it('should document autoescaping features', async () => {
      let autoescapingDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('autoescaping') ||
              content.includes('auto-escaping') ||
              content.includes('automatic escaping') ||
              content.includes('template autoescape')) {
            autoescapingDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for autoescaping docs check: ${filePath}`);
        }
      }

      expect(autoescapingDocs).toBe(true);
    });
  });

  describe('Security Headers Documentation', () => {
    it('should document XSS-related security headers', async () => {
      let securityHeadersDocs = false;
      let headerCount = 0;

      const xssHeaders = [
        'x-xss-protection',
        'x-content-type-options',
        'x-frame-options',
        'content-security-policy',
        'referrer-policy',
        'feature-policy'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          xssHeaders.forEach(header => {
            if (content.includes(header)) {
              headerCount++;
            }
          });

          if (content.includes('security headers') ||
              content.includes('http headers') ||
              content.includes('security header')) {
            securityHeadersDocs = true;
          }
        } catch (error) {
          console.warn(`Could not read file for security headers docs check: ${filePath}`);
        }
      }

      expect(securityHeadersDocs).toBe(true);
      expect(headerCount).toBeGreaterThan(3); // Should document multiple headers
    });

    it('should provide header configuration examples', async () => {
      let headerExamples = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          // Look for security header examples
          const codeBlocks = DocumentationTestUtils.extractCodeBlocks(content);

          for (const block of codeBlocks) {
            const blockContent = block.code.toLowerCase();

            if ((blockContent.includes('x-xss-protection') ||
                 blockContent.includes('x-frame-options') ||
                 blockContent.includes('content-security-policy') ||
                 blockContent.includes('x-content-type-options')) &&
                (block.language === 'http' ||
                 block.language === 'nginx' ||
                 block.language === 'apache' ||
                 block.language === 'javascript' ||
                 block.language === 'json')) {
              headerExamples = true;
              break;
            }
          }

          if (headerExamples) break;
        } catch (error) {
          console.warn(`Could not read file for header examples check: ${filePath}`);
        }
      }

      expect(headerExamples).toBe(true);
    });
  });

  describe('Validation and Testing Documentation', () => {
    it('should document XSS testing methods', async () => {
      let xssTestingDocs = false;

      const testingMethods = [
        'xss testing',
        'security testing',
        'penetration testing',
        'vulnerability scanning',
        'xss scanner',
        'automated testing',
        'security audit'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          testingMethods.forEach(method => {
            if (content.includes(method)) {
              xssTestingDocs = true;
            }
          });
        } catch (error) {
          console.warn(`Could not read file for XSS testing docs check: ${filePath}`);
        }
      }

      expect(xssTestingDocs).toBe(true);
    });

    it('should document input validation best practices', async () => {
      let validationDocs = false;
      let validationTechniques = 0;

      const validationTechniques = [
        'allowlist validation',
        'whitelist validation',
        'denylist validation',
        'blacklist validation',
        'input length validation',
        'input format validation',
        'regular expression validation',
        'type checking',
        'range validation'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          validationTechniques.forEach(technique => {
            if (content.includes(technique)) {
              validationTechniques++;
            }
          });

          if (content.includes('input validation') ||
              content.includes('validation best practices') ||
              content.includes('secure validation')) {
            validationDocs = true;
          }
        } catch (error) {
          console.warn(`Could not read file for validation docs check: ${filePath}`);
        }
      }

      expect(validationDocs).toBe(true);
      expect(validationTechniques).toBeGreaterThan(3);
    });
  });

  describe('Framework-Specific Security', () => {
    it('should document framework-specific XSS protection', async () => {
      let frameworkSecurityDocs = false;

      const frameworks = [
        'react',
        'angular',
        'vue',
        'express',
        'django',
        'rails',
        'laravel',
        'spring'
      ];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          frameworks.forEach(framework => {
            if ((content.includes(framework) &&
                 (content.includes('xss') ||
                  content.includes('security') ||
                  content.includes('protection') ||
                  content.includes('escape')))) {
              frameworkSecurityDocs = true;
            }
          });
        } catch (error) {
          console.warn(`Could not read file for framework security docs check: ${filePath}`);
        }
      }

      expect(frameworkSecurityDocs).toBe(true);
    });
  });
});
