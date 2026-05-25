/**
 * Luna Agents Test Framework
 * Comprehensive testing framework for all Luna agent commands and tools
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class LunaTestFramework {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
    this.testSuites = new Map();
    this.rootDir = path.resolve(__dirname, '../..');
  }

  /**
   * Test Suite Class
   */
  createTestSuite(name) {
    const suite = {
      name,
      tests: [],
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: [],
      beforeEachTest: [],
      afterEachTest: []
    };

    this.testSuites.set(name, suite);
    return suite;
  }

  /**
   * Test Case Class
   */
  addTest(suiteName, testName, testFn, options = {}) {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    suite.tests.push({
      name: testName,
      fn: testFn,
      timeout: options.timeout || 10000,
      skip: options.skip || false,
      only: options.only || false,
      retries: options.retries || 0,
      category: options.category || 'general'
    });
  }

  /**
   * Run all tests
   */
  async runTests(suiteFilter = null, testFilter = null) {
    console.log('🧪 Starting Luna Agents Test Framework');
    console.log('='.repeat(60));

    const startTime = Date.now();

    for (const [suiteName, suite] of this.testSuites) {
      if (suiteFilter && !suiteName.includes(suiteFilter)) continue;

      console.log(`\n📦 Running test suite: ${suiteName}`);

      // Run beforeAll hooks
      for (const hook of suite.beforeAll) {
        await this.runHook(suiteName, hook);
      }

      // Run tests
      for (const test of suite.tests) {
        if (testFilter && !test.name.includes(testFilter)) continue;

        if (test.skip) {
          this.skippedTests++;
          console.log(`  ⏭️  ${test.name} (skipped)`);
          continue;
        }

        await this.runSingleTest(suiteName, test);
      }

      // Run afterAll hooks
      for (const hook of suite.afterAll) {
        await this.runHook(suiteName, hook);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.printSummary(duration);
    return this.generateReport();
  }

  /**
   * Run a single test
   */
  async runSingleTest(suiteName, test) {
    this.totalTests++;
    const testStartTime = Date.now();

    try {
      // Run beforeEach hooks
      for (const hook of this.testSuites.get(suiteName).beforeEachTest) {
        await this.runHook(suiteName, hook);
      }

      // Run the test
      await this.withTimeout(test.fn(), test.timeout);

      const testDuration = Date.now() - testStartTime;
      this.passedTests++;

      console.log(`  ✅ ${test.name} (${testDuration}ms)`);

      this.testResults.push({
        suite: suiteName,
        test: test.name,
        status: 'passed',
        duration: testDuration,
        error: null
      });

    } catch (error) {
      const testDuration = Date.now() - testStartTime;
      this.failedTests++;

      console.log(`  ❌ ${test.name} (${testDuration}ms)`);
      console.log(`     Error: ${error.message}`);

      this.testResults.push({
        suite: suiteName,
        test: test.name,
        status: 'failed',
        duration: testDuration,
        error: error.message,
        stack: error.stack
      });
    }

    // Run afterEach hooks
    try {
      for (const hook of this.testSuites.get(suiteName).afterEachTest) {
        await this.runHook(suiteName, hook);
      }
    } catch (error) {
      console.log(`     Warning: afterEach hook failed: ${error.message}`);
    }
  }

  /**
   * Run a hook function
   */
  async runHook(suiteName, hook) {
    try {
      await hook();
    } catch (error) {
      console.log(`  ⚠️  Hook failed in ${suiteName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout);
      })
    ]);
  }

  /**
   * Assertion helpers
   */
  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `Expected not ${expected}, got ${actual}`);
    }
  }

  assertThrows(fn, message) {
    try {
      fn();
      throw new Error(message || 'Expected function to throw');
    } catch (error) {
      // Expected behavior
    }
  }

  assertContains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected "${haystack}" to contain "${needle}"`);
    }
  }

  /**
   * File system helpers
   */
  async fileExists(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath) {
    return await fs.promises.readFile(filePath, 'utf8');
  }

  async writeFile(filePath, content) {
    await fs.promises.writeFile(filePath, content);
  }

  /**
   * Command execution helpers
   */
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, options.args || [], {
        shell: true,
        cwd: options.cwd || this.rootDir,
        timeout: options.timeout || 30000
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout,
          stderr
        });
      });

      child.on('error', reject);
    });
  }

  /**
   * Print test summary
   */
  printSummary(duration) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 Luna Agents Test Results');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`⏭️  Skipped: ${this.skippedTests}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    if (this.failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      for (const result of this.testResults.filter(r => r.status === 'failed')) {
        console.log(`  - ${result.suite}: ${result.test}`);
        console.log(`    ${result.error}`);
      }
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    const report = {
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        skipped: this.skippedTests,
        successRate: this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0
      },
      results: this.testResults,
      suites: Array.from(this.testSuites.keys())
    };

    return report;
  }

  /**
   * Save test report to file
   */
  async saveReport(filePath) {
    const report = this.generateReport();
    await this.writeFile(filePath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report saved to: ${filePath}`);
  }

  /**
   * Load test configuration
   */
  async loadConfig(configPath = 'test.config.js') {
    const fullPath = path.resolve(this.rootDir, configPath);
    if (await this.fileExists(fullPath)) {
      const config = require(fullPath);
      return config;
    }
    return {};
  }
}

module.exports = { LunaTestFramework };
