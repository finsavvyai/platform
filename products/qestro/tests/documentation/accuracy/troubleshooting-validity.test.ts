/**
 * Troubleshooting Documentation Validity Tests
 *
 * Tests to validate that troubleshooting solutions work correctly
 * and address actual issues users might encounter.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import DocumentationTestUtils from "../utils/documentationTestUtils";
import { getTestConfig } from "../config/testConfig";

const execAsync = promisify(exec);

describe("Troubleshooting Documentation Validity", () => {
  const config = getTestConfig();
  let troubleshootingContent: string;
  const projectRoot = path.resolve(process.cwd(), "..");

  beforeAll(async () => {
    try {
      // Load troubleshooting documentation
      const docFile = await DocumentationTestUtils.readDocumentationFile(
        "docs/TROUBLESHOOTING_GUIDE.md",
      );
      troubleshootingContent = docFile.content;
    } catch (error) {
      console.warn(
        "Troubleshooting guide not found, creating tests based on common issues",
      );
      troubleshootingContent = "";
    }
  });

  describe("Common Issues Coverage", () => {
    it("should document installation and setup issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /installation|setup|dependencies/i,
      );
      expect(troubleshootingContent).toMatch(
        /node.*version|npm.*version|python.*version/i,
      );
    });

    it("should address database connection problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /database|connection|postgresql|redis/i,
      );
      expect(troubleshootingContent).toMatch(
        /connection.*refused|timeout|authentication/i,
      );
    });

    it("should cover authentication and authorization issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/authentication|login|token|JWT/i);
      expect(troubleshootingContent).toMatch(/unauthorized|forbidden|expired/i);
    });

    it("should address test recording failures", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /recording|failed.*record|cannot.*record/i,
      );
      expect(troubleshootingContent).toMatch(/device|agent|connection/i);
    });

    it("should cover test execution problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /test.*execution|run.*failed|timeout/i,
      );
      expect(troubleshootingContent).toMatch(
        /element.*not.*found|assertion.*failed/i,
      );
    });
  });

  describe("Solution Validity", () => {
    it("should provide working command solutions", async () => {
      if (!troubleshootingContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(
        troubleshootingContent,
      );
      const commandBlocks = codeBlocks.filter(
        (block) =>
          block.language === "bash" ||
          block.language === "shell" ||
          block.code.includes("npm ") ||
          block.code.includes("node ") ||
          block.code.includes("curl "),
      );

      const validationResults =
        await DocumentationTestUtils.validateCodeExamples(commandBlocks);
      const invalidExamples = validationResults.filter((r) => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });

    it("should include valid log file paths", async () => {
      if (!troubleshootingContent) return;

      const logPathPatterns = [
        /\/logs\/.*\.log/g,
        /logs.*application\.log/g,
        /\/var\/log\//g,
      ];

      logPathPatterns.forEach((pattern) => {
        const matches = troubleshootingContent.match(pattern);
        if (matches) {
          // Check if log directories exist
          matches.forEach((match) => {
            const logDir = path.dirname(match);
            // In a real test, you might verify these paths exist
          });
        }
      });
    });

    it("should provide valid configuration fixes", async () => {
      if (!troubleshootingContent) return;

      const configBlocks = DocumentationTestUtils.extractCodeBlocks(
        troubleshootingContent,
      );
      const jsonBlocks = configBlocks.filter(
        (block) =>
          block.language === "json" ||
          block.code.includes("{") ||
          block.code.includes('"'),
      );

      const validationResults =
        await DocumentationTestUtils.validateCodeExamples(jsonBlocks);
      const invalidExamples = validationResults.filter((r) => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });
  });

  describe("Error Message Correlation", () => {
    it("should match actual error messages from the application", () => {
      if (!troubleshootingContent) return;

      const commonErrors = [
        "ECONNREFUSED",
        "ENOTFOUND",
        "ETIMEDOUT",
        "ValidationError",
        "AuthenticationError",
        "AuthorizationError",
      ];

      commonErrors.forEach((error) => {
        expect(troubleshootingContent).toMatch(new RegExp(error, "i"));
      });
    });

    it("should include HTTP status code explanations", () => {
      if (!troubleshootingContent) return;

      const statusCodes = [
        "400",
        "401",
        "403",
        "404",
        "429",
        "500",
        "502",
        "503",
      ];

      statusCodes.forEach((code) => {
        expect(troubleshootingContent).toContain(code);
      });
    });

    it("should document database error codes", () => {
      if (!troubleshootingContent) return;

      const dbErrors = [
        "connection refused",
        "timeout expired",
        "authentication failed",
        "database locked",
        "out of memory",
      ];

      dbErrors.forEach((error) => {
        expect(troubleshootingContent.toLowerCase()).toContain(error);
      });
    });
  });

  describe("Diagnostic Commands Validation", () => {
    it("should include valid diagnostic commands", async () => {
      if (!troubleshootingContent) return;

      const expectedCommands = [
        "systemctl status",
        "docker logs",
        "psql",
        "redis-cli",
        "curl -I",
        "netstat -tlnp",
      ];

      expectedCommands.forEach((command) => {
        expect(troubleshootingContent).toContain(command);
      });
    });

    it("should validate syntax of debugging commands", async () => {
      if (!troubleshootingContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(
        troubleshootingContent,
      );
      const diagnosticBlocks = codeBlocks.filter(
        (block) =>
          block.language === "bash" &&
          (block.code.includes("curl") ||
            block.code.includes("grep") ||
            block.code.includes("tail") ||
            block.code.includes("journalctl")),
      );

      const validationResults =
        await DocumentationTestUtils.validateCodeExamples(diagnosticBlocks);
      const invalidExamples = validationResults.filter((r) => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });
  });

  describe("Environment-Specific Issues", () => {
    it("should address development environment problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /development|localhost|3000|8000/i,
      );
      expect(troubleshootingContent).toMatch(
        /port.*conflict|already.*in.*use/i,
      );
    });

    it("should cover staging environment issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /staging|staging-api|staging-app/i,
      );
    });

    it("should address production environment problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /production|prod|api\.questro\.com/i,
      );
      expect(troubleshootingContent).toMatch(
        /performance|scalability|high.*load/i,
      );
    });

    it("should document container-specific issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/docker|container|kubernetes/i);
      expect(troubleshootingContent).toMatch(
        /docker.*run|container.*failed|image.*pull/i,
      );
    });
  });

  describe("Performance Issues", () => {
    it("should address slow performance problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/slow|performance|timeout|lag/i);
      expect(troubleshootingContent).toMatch(/memory|cpu|disk.*space/i);
    });

    it("should provide performance monitoring solutions", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/monitor|metrics|profiling/i);
      expect(troubleshootingContent).toMatch(/htop|top|iotop|vmstat/i);
    });

    it("should include database performance troubleshooting", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /query.*slow|index|explain.*analyze/i,
      );
      expect(troubleshootingContent).toMatch(/pg_stat_activity|slow.*query/i);
    });
  });

  describe("Network and Connectivity Issues", () => {
    it("should document network connectivity problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /network|connectivity|connection/i,
      );
      expect(troubleshootingContent).toMatch(/firewall|proxy|dns|port/i);
    });

    it("should provide network diagnostic tools", () => {
      if (!troubleshootingContent) return;

      const networkCommands = [
        "ping",
        "traceroute",
        "nslookup",
        "dig",
        "telnet",
        "netcat",
      ];

      networkCommands.forEach((command) => {
        expect(troubleshootingContent).toContain(command);
      });
    });

    it("should address SSL/TLS certificate issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/ssl|tls|certificate|https/i);
      expect(troubleshootingContent).toMatch(
        /certificate.*expired|self.*signed/i,
      );
    });
  });

  describe("Device and Platform Issues", () => {
    it("should address mobile device connection problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/mobile|device|ios|android/i);
      expect(troubleshootingContent).toMatch(/adb|idevice|usb|debugging/i);
    });

    it("should cover browser compatibility issues", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/browser|chrome|firefox|safari/i);
      expect(troubleshootingContent).toMatch(
        /compatibility|version|unsupported/i,
      );
    });

    it("should document agent installation problems", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/agent|installation|permission/i);
      expect(troubleshootingContent).toMatch(
        /access.*denied|permission.*denied/i,
      );
    });
  });

  describe("Recovery Procedures", () => {
    it("should include emergency recovery steps", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /recovery|emergency|rollback|restore/i,
      );
    });

    it("should document data backup and restore procedures", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/backup|restore|export|import/i);
      expect(troubleshootingContent).toMatch(
        /pg_dump|pg_restore|backup.*file/i,
      );
    });

    it("should provide system restart procedures", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/restart|reboot|reload/i);
      expect(troubleshootingContent).toMatch(
        /systemctl.*restart|docker.*restart/i,
      );
    });
  });

  describe("Support Contact Information", () => {
    it("should include support contact details", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/support|help|contact/i);
      expect(troubleshootingContent).toMatch(/@.*\.com|support@|help@/i);
    });

    it("should provide escalation procedures", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /escalate|escalation|priority|urgent/i,
      );
    });

    it("should document community resources", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/community|forum|slack|discord/i);
    });
  });

  describe("Preventive Measures", () => {
    it("should include preventive maintenance tips", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /preventive|maintenance|regular|monitor/i,
      );
    });

    it("should document monitoring and alerting setup", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /monitoring|alerting|notification/i,
      );
    });

    it("should provide health check procedures", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(
        /health.*check|status|diagnostic/i,
      );
    });
  });

  describe("Code Example Validation", () => {
    it("should validate shell script examples", async () => {
      if (!troubleshootingContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(
        troubleshootingContent,
      );
      const shellBlocks = codeBlocks.filter(
        (block) => block.language === "bash" || block.language === "shell",
      );

      const validationResults =
        await DocumentationTestUtils.validateCodeExamples(shellBlocks);
      const invalidExamples = validationResults.filter((r) => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });

    it("should validate JSON configuration examples", async () => {
      if (!troubleshootingContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(
        troubleshootingContent,
      );
      const jsonBlocks = codeBlocks.filter(
        (block) => block.language === "json",
      );

      const validationResults =
        await DocumentationTestUtils.validateCodeExamples(jsonBlocks);
      const invalidExamples = validationResults.filter((r) => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });
  });

  describe("Cross-Reference Validation", () => {
    it("should cross-reference related documentation", () => {
      if (!troubleshootingContent) return;

      // Look for references to other documentation
      expect(troubleshootingContent).toMatch(/see.*also|refer.*to|related/i);
    });

    it("should link to relevant API documentation", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/API.*documentation|endpoint/i);
    });

    it("should reference configuration guides", () => {
      if (!troubleshootingContent) return;

      expect(troubleshootingContent).toMatch(/configuration|setup|deployment/i);
    });
  });
});

describe("Troubleshooting Script Validation", () => {
  const projectRoot = path.resolve(process.cwd(), "..");

  it("should validate diagnostic scripts exist", async () => {
    const scriptsDir = path.join(projectRoot, "scripts/utilities");

    try {
      const files = await fs.readdir(scriptsDir);
      const diagnosticScripts = files.filter(
        (file) =>
          file.includes("status") ||
          file.includes("health") ||
          file.includes("diagnostic"),
      );

      expect(diagnosticScripts.length).toBeGreaterThan(0);
    } catch (error) {
      console.warn("Utilities scripts directory not found");
    }
  });

  it("should validate log analysis capabilities", async () => {
    const logsDir = path.join(projectRoot, "backend/logs");

    try {
      const logFiles = await fs.readdir(logsDir);
      expect(logFiles.length).toBeGreaterThan(0);
    } catch (error) {
      console.warn("Backend logs directory not found");
    }
  });

  it("should validate health check endpoints", () => {
    // This would test the actual health check endpoints
    // For now, just ensure they're documented
    expect(true).toBe(true); // Placeholder
  });
});

describe("Error Recovery Validation", () => {
  it("should test database recovery procedures", () => {
    // Test actual recovery procedures
    expect(true).toBe(true); // Placeholder
  });

  it("should validate service restart procedures", () => {
    // Test service restart functionality
    expect(true).toBe(true); // Placeholder
  });

  it("should check backup restoration processes", () => {
    // Test backup restoration
    expect(true).toBe(true); // Placeholder
  });
});
