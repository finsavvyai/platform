#!/usr/bin/env node

/**
 * Test Runner Script for Autonomous Agent Ecosystem
 *
 * This script provides a comprehensive test runner for the autonomous agent
 * ecosystem with support for different test types and reporting.
 */

import { run } from 'vitest/node';

interface TestRunnerOptions {
  pattern?: string;
  coverage?: boolean;
  watch?: boolean;
  reporter?: string;
  outputFile?: string;
  bail?: number;
  threads?: boolean;
}

const DEFAULT_OPTIONS: TestRunnerOptions = {
  coverage: true,
  reporter: 'verbose',
  threads: true,
  bail: 5
};

class AgentTestRunner {
  private options: TestRunnerOptions;

  constructor(options: Partial<TestRunnerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async runAllTests(): Promise<void> {
    console.log('🤖 Starting Autonomous Agent Ecosystem Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      // Include all test files
      include: [
        'agents/__tests__/**/*.test.ts'
      ],
      // Exclude integration tests by default (run them separately)
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts'
      ]
    };

    try {
      const result = await run(vitestConfig);

      if (result === 0) {
        console.log('\n✅ All tests passed successfully!');
      } else {
        console.log('\n❌ Some tests failed.');
        process.exit(result);
      }
    } catch (error) {
      console.error('\n💥 Test runner failed:', error);
      process.exit(1);
    }
  }

  async runUnitTests(): Promise<void> {
    console.log('🔬 Running Unit Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests__/agent-framework.test.ts',
        'agents/__tests__/specialized-agents.test.ts',
        'agents/__tests__/learning-monitoring.test.ts'
      ],
      exclude: [
        'agents/__tests__/integration.test.ts'
      ]
    };

    await this.runTestSet(vitestConfig, 'Unit Tests');
  }

  async runIntegrationTests(): Promise<void> {
    console.log('🔗 Running Integration Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests__/integration.test.ts'
      ],
      exclude: [
        'agents/__tests__/agent-framework.test.ts',
        'agents/__tests__/specialized-agents.test.ts',
        'agents/__tests__/learning-monitoring.test.ts'
      ]
    };

    await this.runTestSet(vitestConfig, 'Integration Tests');
  }

  async runPerformanceTests(): Promise<void> {
    console.log('⚡ Running Performance Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests/**/*.test.ts'
      ],
      testNamePattern: 'performance|scalability|concurrent|load',
      // Performance tests need more time
      testTimeout: 60000,
      hookTimeout: 30000
    };

    await this.runTestSet(vitestConfig, 'Performance Tests');
  }

  async runAgentFrameworkTests(): Promise<void> {
    console.log('🏗️ Running Agent Framework Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests__/agent-framework.test.ts'
      ]
    };

    await this.runTestSet(vitestConfig, 'Agent Framework Tests');
  }

  async runSpecializedAgentTests(): Promise<void> {
    console.log('💼 Running Specialized Agent Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests__/specialized-agents.test.ts'
      ]
    };

    await this.runTestSet(vitestConfig, 'Specialized Agent Tests');
  }

  async runLearningMonitoringTests(): Promise<void> {
    console.log('📊 Running Learning & Monitoring Tests...\n');

    const vitestConfig = {
      ...this.buildVitestConfig(),
      include: [
        'agents/__tests__/learning-monitoring.test.ts'
      ]
    };

    await this.runTestSet(vitestConfig, 'Learning & Monitoring Tests');
  }

  private async runTestSet(config: any, testName: string): Promise<void> {
    try {
      const result = await run(config);

      if (result === 0) {
        console.log(`\n✅ ${testName} passed successfully!`);
      } else {
        console.log(`\n❌ ${testName} failed.`);
        process.exit(result);
      }
    } catch (error) {
      console.error(`\n💥 ${testName} failed:`, error);
      process.exit(1);
    }
  }

  private buildVitestConfig(): any {
    const config: any = {
      root: process.cwd(),
      configFile: false,
      mode: 'test',
      server: {
        deps: {
          inline: true
        }
      }
    };

    // Add coverage if enabled
    if (this.options.coverage) {
      config.coverage = {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          '**/__tests__/**',
          '**/*.d.ts',
          '**/*.config.*',
          'dist/',
          'coverage/'
        ],
        thresholds: {
          global: {
            branches: 75,
            functions: 75,
            lines: 75,
            statements: 75
          }
        }
      };
    }

    // Add reporters
    if (this.options.reporter) {
      config.reporter = this.options.reporter.split(',');
    }

    // Add output file
    if (this.options.outputFile) {
      config.outputFile = {
        [this.options.reporter || 'json']: this.options.outputFile
      };
    }

    // Add bail option
    if (this.options.bail) {
      config.bail = this.options.bail;
    }

    // Add threads configuration
    if (this.options.threads !== undefined) {
      config.pool = this.options.threads ? 'threads' : 'forks';
      config.poolOptions = {
        threads: {
          singleThread: !this.options.threads,
          maxThreads: 4,
          minThreads: 1
        }
      };
    }

    // Add watch mode
    if (this.options.watch) {
      config.watch = true;
    }

    // Add pattern matching
    if (this.options.pattern) {
      config.include = [this.options.pattern];
    }

    return config;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  const options: Partial<TestRunnerOptions> = {
    coverage: args.includes('--coverage') || args.includes('-c'),
    watch: args.includes('--watch') || args.includes('-w'),
    threads: !args.includes('--no-threads'),
    bail: args.includes('--bail') ? parseInt(args[args.indexOf('--bail') + 1]) || 5 : undefined
  };

  const reporterIndex = args.findIndex(arg => arg.startsWith('--reporter='));
  if (reporterIndex !== -1) {
    options.reporter = args[reporterIndex].split('=')[1];
  }

  const outputFileIndex = args.findIndex(arg => arg.startsWith('--output-file='));
  if (outputFileIndex !== -1) {
    options.outputFile = args[outputFileIndex].split('=')[1];
  }

  const testRunner = new AgentTestRunner(options);

  switch (command) {
    case 'all':
      await testRunner.runAllTests();
      break;
    case 'unit':
      await testRunner.runUnitTests();
      break;
    case 'integration':
      await testRunner.runIntegrationTests();
      break;
    case 'performance':
      await testRunner.runPerformanceTests();
      break;
    case 'framework':
      await testRunner.runAgentFrameworkTests();
      break;
    case 'specialized':
      await testRunner.runSpecializedAgentTests();
      break;
    case 'learning':
      await testRunner.runLearningMonitoringTests();
      break;
    case 'help':
      console.log(`
🤖 Autonomous Agent Ecosystem Test Runner

Usage: npm run test:agents [command] [options]

Commands:
  all           Run all tests (default)
  unit          Run unit tests only
  integration   Run integration tests only
  performance   Run performance tests only
  framework     Run agent framework tests only
  specialized   Run specialized agent tests only
  learning      Run learning & monitoring tests only
  help          Show this help message

Options:
  --coverage, -c           Generate coverage report
  --watch, -w              Run tests in watch mode
  --no-threads             Run tests in single thread
  --reporter=<type>        Specify test reporter (verbose, json, etc.)
  --output-file=<path>     Output test results to file
  --bail=<number>          Stop testing after N failures
  --pattern=<glob>         Run tests matching pattern

Examples:
  npm run test:agents                           # Run all tests with coverage
  npm run test:agents unit --watch              # Run unit tests in watch mode
  npm run test:agents integration --no-coverage # Run integration tests without coverage
  npm run test:agents performance --bail=1     # Run performance tests, stop on first failure
      `);
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "npm run test:agents help" for available commands.');
      process.exit(1);
  }
}

// Export for programmatic use
export { AgentTestRunner };

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}