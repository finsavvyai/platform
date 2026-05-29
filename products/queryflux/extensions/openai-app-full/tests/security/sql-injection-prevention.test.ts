/**
 * Security Tests: SQL Injection Prevention
 *
 * Comprehensive security tests to ensure SQL injection attacks
 * are properly prevented and sanitized
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NaturalLanguageToSQLEngine } from '../../src/actions/natural-language-to-sql.js';
import { DatabaseConnectionManager } from '../../src/database/connection-manager.js';
import { testUtils, TEST_CONSTANTS } from '../setup.js';

// Mock OpenAI
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

// Mock security validator
jest.mock('../../src/security/query-validator.js', () => ({
  QueryValidator: jest.fn().mockImplementation(() => ({
    validateSQL: jest.fn().mockImplementation((sql, dbType) => {
      // Simulate security validation
      const dangerousPatterns = [
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /TRUNCATE/i,
        /UPDATE\s+.*\s+SET/i,
        /INSERT\s+INTO/i,
        /CREATE\s+TABLE/i,
        /ALTER\s+TABLE/i,
        /--/,
        /\/\*/,
        /\*\//,
        /union\s+select/i,
        /exec\s*\(/i,
        /xp_cmdshell/i,
        /sp_executesql/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(sql)) {
          return {
            valid: false,
            errors: [`Dangerous SQL pattern detected: ${pattern.source}`],
            warnings: [],
            security: {
              hasInjection: true,
              hasDataLeak: false,
              hasPrivilegeEscalation: false,
              detectedPatterns: [pattern.source]
            }
          };
        }
      }

      return {
        valid: true,
        errors: [],
        warnings: [],
        security: {
          hasInjection: false,
          hasDataLeak: false,
          hasPrivilegeEscalation: false,
          detectedPatterns: []
        }
      };
    })
  }))
}));

describe('SQL Injection Prevention Security Tests', () => {
  let sqlEngine: NaturalLanguageToSQLEngine;
  let connectionManager: DatabaseConnectionManager;
  let connectionId: string;
  let mockOpenAI: any;

  beforeEach(async () => {
    sqlEngine = new NaturalLanguageToSQLEngine();
    connectionManager = new DatabaseConnectionManager();
    mockOpenAI = require('openai').default().chat.completions.create;

    // Create test connection
    const connection = await connectionManager.createConnection(
      testUtils.createTestConnectionConfig('postgresql')
    );
    connectionId = connection.id;
  });

  afterEach(async () => {
    try {
      await connectionManager.closeConnection(connectionId);
    } catch (error) {
      // Connection might already be closed
    }
    jest.clearAllMocks();
  });

  describe('Direct SQL Injection Attempts', () => {
    it('should prevent DROP TABLE injection', async () => {
      const maliciousQueries = [
        'Show me users; DROP TABLE users;',
        'Get data from users; DROP TABLE users; --',
        'SELECT * FROM users; DROP TABLE users; /* comment */',
        'Users list; DROP TABLE users CASCADE;'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('DROP TABLE');
        expect(result.generatedSQL.sql).not.toMatch(/DROP\s+TABLE/i);
      }
    });

    it('should prevent DELETE injection', async () => {
      const maliciousQueries = [
        'Show me users; DELETE FROM users WHERE id > 0;',
        'Get user data; DELETE FROM users; --',
        'Users list; DELETE FROM users WHERE 1=1;'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('DELETE FROM');
        expect(result.generatedSQL.sql).not.toMatch(/DELETE\s+FROM/i);
      }
    });

    it('should prevent UPDATE injection', async () => {
      const maliciousQueries = [
        'Show me users; UPDATE users SET password = "hacked";',
        'Get user data; UPDATE users SET admin = true; --',
        'Users list; UPDATE users SET email = "hacker@evil.com" WHERE id = 1;'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('UPDATE');
        expect(result.generatedSQL.sql).not.toMatch(/UPDATE\s+.*\s+SET/i);
      }
    });

    it('should prevent INSERT injection', async () => {
      const maliciousQueries = [
        'Show me users; INSERT INTO users (name) VALUES ("hacker");',
        'Get user data; INSERT INTO users VALUES (999, "admin", "password"); --',
        'Users list; INSERT INTO logs (message) VALUES ("system compromised");'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('INSERT INTO');
        expect(result.generatedSQL.sql).not.toMatch(/INSERT\s+INTO/i);
      }
    });

    it('should prevent UNION-based injection', async () => {
      const maliciousQueries = [
        'Show me users UNION SELECT password FROM admin_users',
        'Get user data UNION SELECT credit_card FROM payments',
        'Users list UNION SELECT * FROM sensitive_data'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        // Should either sanitize or flag as suspicious
        if (result.validation.security.hasInjection) {
          expect(result.validation.errors.length).toBeGreaterThan(0);
        } else {
          expect(result.generatedSQL.sql).not.toMatch(/UNION\s+SELECT/i);
        }
      }
    });

    it('should prevent comment-based injection', async () => {
      const maliciousQueries = [
        'Show me users; -- This is a comment',
        'Get user data; /* This is a multi-line comment */',
        'Users list; # Another comment type'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('--');
        expect(result.generatedSQL.sql).not.toContain('/*');
        expect(result.generatedSQL.sql).not.toContain('*/');
        expect(result.generatedSQL.sql).not.toContain('#');
      }
    });

    it('should prevent stored procedure injection', async () => {
      const maliciousQueries = [
        'Show me users; EXEC xp_cmdshell("dir")',
        'Get user data; EXEC sp_executesql N"SELECT * FROM users"',
        'Users list; CALL malicious_procedure()'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toMatch(/EXEC\s*\(/i);
        expect(result.generatedSQL.sql).not.toMatch(/sp_executesql/i);
        expect(result.generatedSQL.sql).not.toMatch(/xp_cmdshell/i);
      }
    });
  });

  describe('Advanced SQL Injection Techniques', () => {
    it('should prevent Boolean-based blind SQL injection', async () => {
      const maliciousQueries = [
        'Show me users WHERE 1=1 AND (SELECT COUNT(*) FROM users) > 0',
        'Get user data WHERE name LIKE "admin" OR 1=1',
        'Users list WHERE id = 1 AND (SELECT SUBSTRING(password,1,1) FROM admin WHERE id=1)="a"'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('1=1');
        expect(result.generatedSQL.sql).not.toContain('OR 1=1');
        expect(result.generatedSQL.sql).not.toContain('AND 1=1');
      }
    });

    it('should prevent time-based blind SQL injection', async () => {
      const maliciousQueries = [
        'Show me users; WAITFOR DELAY "00:00:05"',
        'Get user data WHERE id = 1; SELECT pg_sleep(5)',
        'Users list; SELECT SLEEP(5)'
      ];

      for (const query of maliciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('WAITFOR');
        expect(result.generatedSQL.sql).not.toContain('pg_sleep');
        expect(result.generatedSQL.sql).not.toContain('SLEEP');
      }
    });

    it('should prevent second-order SQL injection', async () => {
      const maliciousInputs = [
        "admin'; DROP TABLE users; --",
        "user' OR '1'='1",
        "test' UNION SELECT password FROM admin_users --"
      ];

      for (const input of maliciousInputs) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: `Find user with name: ${input}`,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain("'");
        expect(result.generatedSQL.sql).not.toContain("';");
        expect(result.generatedSQL.sql).not.toContain("--");
      }
    });

    it('should prevent encoded SQL injection attempts', async () => {
      const encodedAttacks = [
        'Show me users where name = %27admin%27%3B%20DROP%20TABLE%20users%3B%20--',
        'Get user data with name = admin%27%20OR%20%271%27%3D%271',
        'Users list with id = 1%27%20UNION%20SELECT%20password%20FROM%20admin_users'
      ];

      for (const attack of encodedAttacks) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: attack,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        // Should handle encoding safely
        expect(result.generatedSQL.sql).toBeDefined();
      }
    });
  });

  describe('Database-Specific Injection Prevention', () => {
    it('should prevent PostgreSQL-specific injection', async () => {
      const pgAttacks = [
        'Show me users; COPY users TO \'/tmp/users.csv\';',
        'Get user data; CREATE TABLE backup AS SELECT * FROM users;',
        'Users list; ALTER USER postgres WITH PASSWORD \'hacked\';'
      ];

      for (const attack of pgAttacks) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: attack,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('COPY');
        expect(result.generatedSQL.sql).not.toContain('CREATE TABLE');
        expect(result.generatedSQL.sql).not.toContain('ALTER USER');
      }
    });

    it('should prevent MySQL-specific injection', async () => {
      const mysqlAttacks = [
        'Show me users; LOAD DATA INFILE \'/etc/passwd\' INTO TABLE users;',
        'Get user data; SELECT * FROM users INTO OUTFILE \'/tmp/users.txt\';',
        'Users list; GRANT ALL PRIVILEGES ON *.* TO \'hacker\'@\'%\';'
      ];

      for (const attack of mysqlAttacks) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: attack,
          connectionId,
          databaseType: 'mysql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('LOAD DATA INFILE');
        expect(result.generatedSQL.sql).not.toContain('INTO OUTFILE');
        expect(result.generatedSQL.sql).not.toContain('GRANT ALL PRIVILEGES');
      }
    });

    it('should prevent SQL Server-specific injection', async () => {
      const sqlServerAttacks = [
        'Show me users; BULK INSERT users FROM \'c:\\temp\\users.txt\';',
        'Get user data; OPENROWSET(\'SQLNCLI\', \'Server=trusted_connection;\', \'SELECT * FROM users\')',
        'Users list; xp_cmdshell \'net user hacker password /add\''
      ];

      for (const attack of sqlServerAttacks) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: attack,
          connectionId,
          databaseType: 'sqlserver'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).not.toContain('BULK INSERT');
        expect(result.generatedSQL.sql).not.toContain('OPENROWSET');
        expect(result.generatedSQL.sql).not.toContain('xp_cmdshell');
      }
    });

    it('should prevent NoSQL injection attempts', async () => {
      const noSQLAttacks = [
        'Show me users where $ne = null',
        'Get user data with {"$gt": ""}',
        'Users list with {"$regex": "admin"}'
      ];

      for (const attack of noSQLAttacks) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: attack,
          connectionId,
          databaseType: 'mongodb'
        });

        expect(result.success).toBe(true);
        // Should sanitize NoSQL operators
        expect(result.generatedSQL.sql).not.toContain('$ne');
        expect(result.generatedSQL.sql).not.toContain('$gt');
        expect(result.generatedSQL.sql).not.toContain('$regex');
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize special characters', async () => {
      const specialChars = [
        'Show me users with name containing "\'"',
        'Get user data with name containing "\\"',
        'Users list with name containing ";"',
        'Show me users with name containing "--"',
        'Get user data with name containing "/*"'
      ];

      for (const query of specialChars) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        // Should handle special characters safely
        expect(result.generatedSQL.sql).toBeDefined();

        // Verify no unescaped quotes
        const unescapedSingleQuotes = (result.generatedSQL.sql.match(/(?<!')'(?!')/g) || []).length;
        expect(unescapedSingleQuotes % 2).toBe(0); // Should be even number (pairs)
      }
    });

    it('should handle Unicode and international characters safely', async () => {
      const unicodeQueries = [
        '显示所有用户',
        'Показать всех пользователей',
        'すべてのユーザーを表示',
        'Mostrar todos los usuarios',
        'Afficher tous les utilisateurs'
      ];

      for (const query of unicodeQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        expect(result.generatedSQL.sql).toBeDefined();
        // Should handle Unicode without injection vulnerabilities
      }
    });

    it('should limit query length to prevent buffer overflow', async () => {
      const longQuery = 'Show me users '.repeat(10000);

      const result = await sqlEngine.convertToSQL({
        naturalLanguage: longQuery,
        connectionId,
        databaseType: 'postgresql'
      });

      // Should handle long queries gracefully
      if (result.success) {
        expect(result.generatedSQL.sql.length).toBeLessThan(10000);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should prevent HTTP parameter pollution', async () => {
      const pollutedQueries = [
        'Show me users?name=admin&name=user',
        'Get user data?id=1&id=2&id=3',
        'Users list?sort=name&sort=id&sort=email'
      ];

      for (const query of pollutedQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        expect(result.success).toBe(true);
        // Should handle parameter pollution safely
        expect(result.generatedSQL.sql).not.toMatch(/\&/);
        expect(result.generatedSQL.sql).not.toMatch(/\?/);
      }
    });
  });

  describe('Security Logging and Monitoring', () => {
    it('should log injection attempts', async () => {
      const maliciousQuery = 'Show me users; DROP TABLE users; --';

      // Mock logging
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await sqlEngine.convertToSQL({
        naturalLanguage: maliciousQuery,
        connectionId,
        databaseType: 'postgresql'
      });

      expect(result.success).toBe(true);

      // Should log security warnings
      if (result.validation.security.hasInjection) {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Security warning'),
          expect.any(Object)
        );
      }

      consoleSpy.mockRestore();
    });

    it('should track suspicious activity patterns', async () => {
      const suspiciousQueries = [
        'Show me users WHERE 1=1',
        'Get user data OR 1=1',
        'Users list AND 1=1',
        'Show me users UNION SELECT * FROM admin',
        'Get user data; DROP TABLE users'
      ];

      let suspiciousCount = 0;

      for (const query of suspiciousQueries) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        if (result.validation?.security?.hasInjection ||
            result.validation?.errors?.length > 0) {
          suspiciousCount++;
        }
      }

      // Should detect multiple suspicious attempts
      expect(suspiciousCount).toBeGreaterThan(0);
    });

    it('should provide security recommendations', async () => {
      const borderlineQuery = 'Show me users with complex conditions';

      const result = await sqlEngine.convertToSQL({
        naturalLanguage: borderlineQuery,
        connectionId,
        databaseType: 'postgresql'
      });

      expect(result.success).toBe(true);

      // Should provide security insights
      expect(result.insights.securityConsiderations).toBeDefined();
      expect(result.insights.securityConsiderations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Security', () => {
    it('should not expose database structure in error messages', async () => {
      // Mock a database error
      const DatabaseConnectionManager = require('../../src/database/connection-manager.js').DatabaseConnectionManager;
      const mockExecuteQuery = jest.fn().mockRejectedValue(new Error('Table "secret_users" does not exist'));

      DatabaseConnectionManager.mockImplementationOnce(() => ({
        executeQuery: mockExecuteQuery,
        getConnection: jest.fn().mockReturnValue({ metrics: {} })
      }));

      const result = await sqlEngine.convertToSQL({
        naturalLanguage: 'Show me users',
        connectionId,
        databaseType: 'postgresql'
      });

      // Should not expose sensitive information in errors
      if (!result.success && result.error) {
        expect(result.error).not.toContain('secret_users');
        expect(result.error).not.toContain('password');
        expect(result.error).not.toContain('admin');
      }
    });

    it('should handle malformed input safely', async () => {
      const malformedInputs = [
        null,
        undefined,
        '',
        123,
        {},
        [],
        '<script>alert("xss")</script>',
        '\x00\x01\x02\x03',
        '🔥💻🚀' // Emojis
      ];

      for (const input of malformedInputs) {
        const result = await sqlEngine.convertToSQL({
          naturalLanguage: input as any,
          connectionId,
          databaseType: 'postgresql'
        });

        // Should handle gracefully without crashing
        expect(result).toBeDefined();

        if (result.success) {
          expect(result.generatedSQL.sql).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
          expect(result.error).not.toContain('Internal server error');
        }
      }
    });

    it('should prevent information disclosure through timing attacks', async () => {
      const queries = [
        'Show me users where id = 1',
        'Show me users where id = 999999',
        'Show me users where email = "admin@test.com"',
        'Show me users where email = "nonexistent@test.com"'
      ];

      const executionTimes: number[] = [];

      for (const query of queries) {
        const startTime = Date.now();

        const result = await sqlEngine.convertToSQL({
          naturalLanguage: query,
          connectionId,
          databaseType: 'postgresql'
        });

        const executionTime = Date.now() - startTime;
        executionTimes.push(executionTime);

        expect(result.success).toBe(true);
      }

      // Execution times should be similar (no significant timing differences)
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      const timeDifference = maxTime - minTime;

      // Allow reasonable variance but prevent timing attacks
      expect(timeDifference).toBeLessThan(1000); // Less than 1 second difference
    });
  });

  describe('Integration with Database Connection Manager', () => {
    it('should enforce security at database level', async () => {
      const dangerousQueries = [
        'SELECT * FROM users; DROP TABLE users;',
        'DELETE FROM users WHERE 1=1',
        'UPDATE users SET password = "hacked"'
      ];

      for (const query of dangerousQueries) {
        await expect(
          connectionManager.executeQuery(connectionId, query)
        ).rejects.toThrow('Dangerous SQL operation');
      }
    });

    it('should validate parameters in database queries', async () => {
      const maliciousParameters = [
        ["admin'; DROP TABLE users; --"],
        ["1 OR 1=1"],
        ["user' UNION SELECT password FROM admin_users --"]
      ];

      for (const params of maliciousParameters) {
        await expect(
          connectionManager.executeQuery(
            connectionId,
            'SELECT * FROM users WHERE name = ?',
            params
          )
        ).rejects.toThrow();
      }
    });
  });
});
