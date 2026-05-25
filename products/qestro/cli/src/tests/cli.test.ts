/**
 * Comprehensive CLI Tests
 * Tests all CLI functionality with AWS-style authentication
 */

import { execSync, spawn } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLI_PATH = join(__dirname, '../dist/index.js');
const TEST_CONFIG_DIR = join(homedir(), '.qestro-test');

describe('Questro CLI - Comprehensive Tests', () => {
  beforeAll(() => {
    // Ensure CLI is built
    if (!existsSync(CLI_PATH)) {
      console.log('Building CLI for tests...');
      execSync('npm run build', { cwd: join(__dirname, '..'), stdio: 'inherit' });
    }
  });

  afterAll(() => {
    // Cleanup test configuration
    try {
      if (existsSync(TEST_CONFIG_DIR)) {
        execSync(`rm -rf ${TEST_CONFIG_DIR}`);
      }
    } catch (error) {
      console.log('Cleanup warning:', error);
    }
  });

  describe('Basic CLI Functionality', () => {
    test('should show help by default', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      expect(output).toContain('Questro Professional CLI');
      expect(output).toContain('Authentication and user management commands');
      expect(output).toContain('Project management commands');
    });

    test('should show version', () => {
      const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf8' });
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should show ASCII art banner', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      expect(output).toContain('Questro CLI');
    });
  });

  describe('Authentication System', () => {
    test('should require authentication for protected commands', () => {
      try {
        execSync(`node ${CLI_PATH} projects list`, { encoding: 'utf8' });
        fail('Should have thrown an error for missing authentication');
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('Unable to locate credentials');
        expect(error.stdout || error.stderr || error.message).toContain('qestro auth login');
      }
    });

    test('should show AWS-style authentication message', () => {
      try {
        execSync(`node ${CLI_PATH} projects list`, { encoding: 'utf8' });
        fail('Should have thrown an error for missing authentication');
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message;
        expect(output).toContain('Authentication Options:');
        expect(output).toContain('Configuration Options:');
        expect(output).toContain('qestro auth login');
        expect(output).toContain('qestro config show');
      }
    });

    test('should allow access to public commands without authentication', () => {
      const output = execSync(`node ${CLI_PATH} auth --help`, { encoding: 'utf8' });
      expect(output).toContain('Authentication and user management commands');
    });

    test('should allow access to config commands without authentication', () => {
      const output = execSync(`node ${CLI_PATH} config --help`, { encoding: 'utf8' });
      expect(output).toContain('Configuration management commands');
    });
  });

  describe('Configuration Management', () => {
    test('should show configuration', () => {
      const output = execSync(`node ${CLI_PATH} config show`, { encoding: 'utf8' });
      expect(output).toContain('Configuration');
    });

    test('should list profiles', () => {
      const output = execSync(`node ${CLI_PATH} config list-profiles`, { encoding: 'utf8' });
      expect(output).toContain('default');
    });

    test('should validate configuration', () => {
      const output = execSync(`node ${CLI_PATH} config validate`, { encoding: 'utf8' });
      expect(output).toContain('valid');
    });

    test('should set and get configuration values', () => {
      execSync(`node ${CLI_PATH} config set defaults.region us-west-2`, { encoding: 'utf8' });
      const output = execSync(`node ${CLI_PATH} config get defaults.region`, { encoding: 'utf8' });
      expect(output.trim()).toBe('"us-west-2"');
    });
  });

  describe('Interactive Mode Tests', () => {
    test('should handle interactive project creation mock', () => {
      // This test would need mocking for inquirer prompts
      // For now, we'll test that the command exists and shows help
      const output = execSync(`node ${CLI_PATH} projects create --help`, { encoding: 'utf8' });
      expect(output).toContain('Create a new project');
      expect(output).toContain('--interactive');
    });

    test('should handle interactive authentication mock', () => {
      const output = execSync(`node ${CLI_PATH} auth login --help`, { encoding: 'utf8' });
      expect(output).toContain('Authenticate with Questro platform');
      expect(output).toContain('--interactive');
    });
  });

  describe('Output Formats', () => {
    test('should support JSON output format', () => {
      const output = execSync(`node ${CLI_PATH} config show --format json`, { encoding: 'utf8' });
      expect(output).toContain('{');
      expect(output).toContain('}');
    });

    test('should support YAML output format', () => {
      const output = execSync(`node ${CLI_PATH} config show --format yaml`, { encoding: 'utf8' });
      expect(output).toMatch(/api:|baseUrl:|timeout:/);
    });

    test('should support table output format', () => {
      const output = execSync(`node ${CLI_PATH} config show --format table`, { encoding: 'utf8' });
      expect(output).toContain('Configuration');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid commands gracefully', () => {
      try {
        execSync(`node ${CLI_PATH} invalid-command`, { encoding: 'utf8' });
        fail('Should have thrown an error for invalid command');
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('error');
      }
    });

    test('should handle missing required arguments', () => {
      try {
        execSync(`node ${CLI_PATH} projects get`, { encoding: 'utf8' });
        fail('Should have thrown an error for missing argument');
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('error');
      }
    });

    test('should show helpful error messages for configuration issues', () => {
      // Test with invalid configuration
      try {
        execSync(`node ${CLI_PATH} config set invalid.key value`, { encoding: 'utf8' });
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('error');
      }
    });
  });

  describe('Global Options', () => {
    test('should support verbose flag', () => {
      const output = execSync(`node ${CLI_PATH} --verbose config show`, { encoding: 'utf8' });
      expect(output).toContain('Configuration');
    });

    test('should support quiet flag', () => {
      const output = execSync(`node ${CLI_PATH} --quiet config show`, { encoding: 'utf8' });
      expect(output.length).toBeGreaterThan(0);
    });

    test('should support no-color flag', () => {
      const output = execSync(`node ${CLI_PATH} --no-color config show`, { encoding: 'utf8' });
      expect(output).toContain('Configuration');
    });

    test('should support profile flag', () => {
      const output = execSync(`node ${CLI_PATH} --profile default config show`, { encoding: 'utf8' });
      expect(output).toContain('Configuration');
    });
  });

  describe('Command Structure Validation', () => {
    test('should have all expected command groups', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });

      // Check for all major command groups
      expect(output).toContain('auth');
      expect(output).toContain('projects');
      expect(output).toContain('recordings');
      expect(output).toContain('tests');
      expect(output).toContain('analytics');
      expect(output).toContain('config');
      expect(output).toContain('deployment');
      expect(output).toContain('integrations');
      expect(output).toContain('users');
    });

    test('should have proper aliases for commands', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });

      // Check for command aliases
      expect(output).toContain('auth [a]');
      expect(output).toContain('projects [proj]');
      expect(output).toContain('recordings [record]');
      expect(output).toContain('tests [test]');
    });
  });

  describe('Help System', () => {
    test('should show comprehensive help for main command', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      expect(output).toContain('Options:');
      expect(output).toContain('--verbose');
      expect(output).toContain('--quiet');
      expect(output).toContain('--format');
      expect(output).toContain('--profile');
    });

    test('should show help for auth command', () => {
      const output = execSync(`node ${CLI_PATH} auth --help`, { encoding: 'utf8' });
      expect(output).toContain('login');
      expect(output).toContain('logout');
      expect(output).toContain('status');
      expect(output).toContain('whoami');
    });

    test('should show help for projects command', () => {
      const output = execSync(`node ${CLI_PATH} projects --help`, { encoding: 'utf8' });
      expect(output).toContain('list');
      expect(output).toContain('create');
      expect(output).toContain('get');
      expect(output).toContain('update');
      expect(output).toContain('delete');
    });
  });

  describe('Recording Commands (Mock)', () => {
    test('should have recording command structure', () => {
      const output = execSync(`node ${CLI_PATH} recordings --help`, { encoding: 'utf8' });
      expect(output).toContain('start');
      expect(output).toContain('stop');
      expect(output).toContain('list');
      expect(output).toContain('get');
      expect(output).toContain('delete');
      expect(output).toContain('download');
    });

    test('should require authentication for recording commands', () => {
      try {
        execSync(`node ${CLI_PATH} recordings list`, { encoding: 'utf8' });
        fail('Should have thrown an error for missing authentication');
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('Unable to locate credentials');
      }
    });
  });

  describe('Token Requirements (AWS Style)', () => {
    test('should show proper token required message', () => {
      try {
        execSync(`node ${CLI_PATH} projects list`, { encoding: 'utf8' });
        fail('Should have thrown an error for missing authentication');
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message;

        // Check for AWS-style authentication message
        expect(output).toContain('Unable to locate credentials');
        expect(output).toContain('You can configure credentials by running "qestro auth login"');
        expect(output).toContain('Authentication Options:');
        expect(output).toContain('Configuration Options:');
      }
    });

    test('should support environment variable tokens', () => {
      // Test with environment variable (mock)
      const envBackup = process.env.QESTRO_ACCESS_TOKEN;
      process.env.QESTRO_ACCESS_TOKEN = 'mock-token';

      try {
        execSync(`node ${CLI_PATH} config show`, { encoding: 'utf8' });
        // Should work without authentication error for config commands
      } catch (error: any) {
        // Config commands should work even with invalid tokens
        expect(error.stdout || error.stderr || error.message).not.toContain('Unable to locate credentials');
      } finally {
        if (envBackup) {
          process.env.QESTRO_ACCESS_TOKEN = envBackup;
        } else {
          delete process.env.QESTRO_ACCESS_TOKEN;
        }
      }
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete workflow simulation', () => {
      // Simulate a complete workflow: config -> auth status -> check projects
      execSync(`node ${CLI_PATH} config set defaults.region us-east-1`, { encoding: 'utf8' });

      try {
        execSync(`node ${CLI_PATH} auth status`, { encoding: 'utf8' });
        // Should show not authenticated status
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('Not authenticated');
      }

      try {
        execSync(`node ${CLI_PATH} projects list`, { encoding: 'utf8' });
        fail('Should require authentication');
      } catch (error: any) {
        expect(error.stdout || error.stderr || error.message).toContain('Unable to locate credentials');
      }
    });
  });

  describe('Performance Tests', () => {
    test('should respond quickly to help commands', () => {
      const start = Date.now();
      execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should respond in under 1 second
    });

    test('should handle multiple rapid commands', () => {
      const start = Date.now();

      for (let i = 0; i < 5; i++) {
        execSync(`node ${CLI_PATH} config show`, { encoding: 'utf8' });
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000); // 5 commands in under 3 seconds
    });
  });

  describe('Error Recovery', () => {
    test('should handle partial configuration gracefully', () => {
      // Set some invalid config
      try {
        execSync(`node ${CLI_PATH} config set api.baseUrl invalid-url`, { encoding: 'utf8' });
        execSync(`node ${CLI_PATH} config validate`, { encoding: 'utf8' });
      } catch (error: any) {
        // Should handle gracefully without crashing
        expect(error.stdout || error.stderr || error.message).toContain('error');
      }
    });

    test('should recover from authentication errors', () => {
      try {
        execSync(`node ${CLI_PATH} projects list`, { encoding: 'utf8' });
      } catch (error: any) {
        // Should provide helpful recovery suggestions
        const output = error.stdout || error.stderr || error.message;
        expect(output).toContain('qestro auth login');
      }
    });
  });
});

// Integration test with actual authentication (requires test environment)
describe('Questro CLI - Integration Tests (Requires Backend)', () => {
  // These tests would require a running backend and test credentials
  // They should be run separately in a CI/CD environment

  test.skip('should handle actual authentication flow', () => {
    // This would test real authentication with a test backend
  });

  test.skip('should handle real project operations', () => {
    // This would test actual project CRUD operations
  });

  test.skip('should handle real recording operations', () => {
    // This would test actual recording with test devices/apps
  });
});

// Performance benchmarks
describe('Questro CLI - Performance Benchmarks', () => {
  test('should benchmark CLI startup time', () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      execSync(`node ${CLI_PATH} --version`, { encoding: 'utf8' });
      times.push(Date.now() - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / iterations;

    expect(averageTime).toBeLessThan(500); // Average startup time under 500ms
  });

  test('should benchmark help command performance', () => {
    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      times.push(Date.now() - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / iterations;

    expect(averageTime).toBeLessThan(1000); // Average help time under 1 second
  });
});

export {};