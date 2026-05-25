/**
 * Security Test Runner
 *
 * Orchestrates the execution of security tests and generates reports
 */

import {
  SecurityTestConfig,
  SecurityTestResult,
} from "../security-test-framework";

export interface TestSuite {
  name: string;
  tests: string[];
  priority: "critical" | "high" | "medium" | "low";
  enabled: boolean;
}

export interface TestRun {
  id: string;
  suites: TestSuite[];
  config: SecurityTestConfig;
  startTime: Date;
  endTime?: Date;
  status: "running" | "completed" | "failed" | "cancelled";
  result?: SecurityTestResult;
}

export class TestRunner {
  private activeRuns: Map<string, TestRun> = new Map();
  private completedRuns: TestRun[] = [];
  private maxConcurrentRuns = 3;

  /**
   * Run security tests
   */
  async runSecurityTests(
    config: SecurityTestConfig,
    suites?: string[],
  ): Promise<TestRun> {
    const runId = this.generateRunId();

    const testSuites: TestSuite[] = [
      {
        name: "Authentication Security",
        tests: [
          "auth-password-policy",
          "auth-bypass",
          "auth-mfa",
          "auth-session",
        ],
        priority: "critical",
        enabled: true,
      },
      {
        name: "Authorization Security",
        tests: [
          "authz-rbac",
          "authz-horizontal",
          "authz-vertical",
          "authz-idor",
        ],
        priority: "critical",
        enabled: true,
      },
      {
        name: "Input Validation",
        tests: [
          "validation-buffer",
          "validation-special",
          "validation-file",
          "validation-json",
        ],
        priority: "high",
        enabled: config.testScopes.inputValidation,
      },
      {
        name: "XSS Protection",
        tests: ["xss-reflected", "xss-stored", "xss-dom", "xss-csp"],
        priority: "high",
        enabled: config.testScopes.xssProtection,
      },
      {
        name: "SQL Injection",
        tests: ["sqli-classic", "sqli-blind", "sqli-time", "sqli-nosql"],
        priority: "critical",
        enabled: config.testScopes.sqlInjection,
      },
      {
        name: "CSRF Protection",
        tests: [
          "csrf-token",
          "csrf-samesite",
          "csrf-origin",
          "csrf-doublesubmit",
        ],
        priority: "high",
        enabled: config.testScopes.csrfProtection,
      },
      {
        name: "Security Headers",
        tests: ["headers-csp", "headers-hsts", "headers-cors", "headers-misc"],
        priority: "medium",
        enabled: config.testScopes.securityHeaders,
      },
      {
        name: "Data Encryption",
        tests: ["encryption-tls", "encryption-at-rest", "encryption-keys"],
        priority: "high",
        enabled: config.testScopes.dataEncryption,
      },
      {
        name: "Session Management",
        tests: [
          "session-token",
          "session-fixation",
          "session-timeout",
          "session-concurrent",
        ],
        priority: "high",
        enabled: config.testScopes.sessionManagement,
      },
      {
        name: "API Security",
        tests: ["api-auth", "api-rate", "api-exposure", "api-version"],
        priority: "high",
        enabled: config.testScopes.apiSecurity,
      },
    ];

    const run: TestRun = {
      id: runId,
      suites: suites
        ? testSuites.filter((s) => suites.includes(s.name))
        : testSuites,
      config,
      startTime: new Date(),
      status: "running",
    };

    this.activeRuns.set(runId, run);

    // Execute tests asynchronously
    this.executeTests(run).catch((error) => {
      run.status = "failed";
      run.endTime = new Date();
      console.error(`Test run ${runId} failed:`, error);
    });

    return run;
  }

  /**
   * Get test run status
   */
  getTestRun(runId: string): TestRun | undefined {
    return (
      this.activeRuns.get(runId) ||
      this.completedRuns.find((r) => r.id === runId)
    );
  }

  /**
   * Get all test runs
   */
  getAllTestRuns(): TestRun[] {
    return [...Array.from(this.activeRuns.values()), ...this.completedRuns];
  }

  /**
   * Cancel test run
   */
  cancelTestRun(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    if (run && run.status === "running") {
      run.status = "cancelled";
      run.endTime = new Date();
      this.activeRuns.delete(runId);
      this.completedRuns.push(run);
      return true;
    }
    return false;
  }

  /**
   * Execute test suites
   */
  private async executeTests(run: TestRun): Promise<void> {
    try {
      // Sort suites by priority
      const sortedSuites = run.suites.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Execute each enabled suite
      for (const suite of sortedSuites) {
        if (!suite.enabled) continue;

        console.log(`Executing test suite: ${suite.name}`);

        // Execute tests in suite
        for (const test of suite.tests) {
          console.log(`  - Running test: ${test}`);
          await this.executeTest(test, run.config);
        }
      }

      // Mark as completed
      run.status = "completed";
      run.endTime = new Date();

      // Move to completed runs
      this.activeRuns.delete(run.id);
      this.completedRuns.push(run);

      // Limit completed runs history
      if (this.completedRuns.length > 100) {
        this.completedRuns = this.completedRuns.slice(-100);
      }
    } catch (error) {
      run.status = "failed";
      run.endTime = new Date();
      throw error;
    }
  }

  /**
   * Execute individual test
   */
  private async executeTest(
    testName: string,
    config: SecurityTestConfig,
  ): Promise<void> {
    // In real implementation, execute the specific test
    // This is a placeholder that would run the actual test
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
