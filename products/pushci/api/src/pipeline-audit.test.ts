import { describe, it, expect } from "vitest";
import { auditPipeline } from "./pipeline-audit";

describe("auditPipeline", () => {
  it("clean config scores 100", () => {
    const yaml = `on: [push]\ntimeout: 300\nchecks:\n  - build\n  - test\n`;
    const result = auditPipeline(yaml);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects hardcoded secrets", () => {
    const yaml = `password: "hunter2"\nchecks:\n  - test\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "secret-plaintext")).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("detects curl pipe to shell", () => {
    const yaml = `steps:\n  - curl -sL https://example.com/install | sh\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "curl-pipe-sh")).toBe(true);
  });

  it("detects privileged execution", () => {
    const yaml = `steps:\n  - sudo npm install\ntimeout: 60\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "privileged-run")).toBe(true);
  });

  it("flags missing timeout", () => {
    const yaml = `on: [push]\nchecks:\n  - test\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "no-timeout")).toBe(true);
  });

  it("detects insecure HTTP URLs", () => {
    const yaml = `deploy:\n  url: http://api.example.com/v1\ntimeout: 60\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "http-not-https")).toBe(true);
  });

  it("allows localhost HTTP", () => {
    const yaml = `url: http://localhost:3000\ntimeout: 60\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "http-not-https")).toBe(false);
  });

  it("detects env dump", () => {
    const yaml = `steps:\n  - printenv\ntimeout: 60\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "env-dump")).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("detects unpinned versions", () => {
    const yaml = `node: latest\ntimeout: 60\n`;
    const result = auditPipeline(yaml);
    expect(result.findings.some((f) => f.rule === "no-pin-version")).toBe(true);
  });

  it("score decreases with severity", () => {
    const critical = `password: "x"\ntimeout: 60\n`;
    const low = `node: latest\ntimeout: 60\n`;
    expect(auditPipeline(critical).score).toBeLessThan(auditPipeline(low).score);
  });

  it("includes line numbers", () => {
    const yaml = `ok: true\npassword: "secret123"\nmore: stuff\n`;
    const result = auditPipeline(yaml);
    const finding = result.findings.find((f) => f.rule === "secret-plaintext");
    expect(finding?.line).toBe(2);
  });
});
