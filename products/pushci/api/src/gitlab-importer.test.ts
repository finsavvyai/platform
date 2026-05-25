import { describe, it, expect } from "vitest";
import { parseGitlabCI, toPushciYaml, gitlabCIToPushciYaml, parseYaml } from "./gitlab-importer";

describe("parseYaml — YAML subset", () => {
  it("parses scalars and inline arrays", () => {
    const out = parseYaml("name: test\ntags: [a, b, c]\n");
    expect(out.name).toBe("test");
    expect(out.tags).toEqual(["a", "b", "c"]);
  });

  it("parses block arrays under a key", () => {
    const out = parseYaml("stages:\n  - build\n  - test\n");
    expect(out.stages).toEqual(["build", "test"]);
  });

  it("parses nested maps", () => {
    const out = parseYaml("variables:\n  NODE_ENV: production\n  VERSION: '1.2'\n");
    expect(out.variables).toEqual({ NODE_ENV: "production", VERSION: "1.2" });
  });
});

describe("parseGitlabCI — simple pipeline", () => {
  const src = `
stages:
  - build
  - test

variables:
  NODE_ENV: test

build-job:
  stage: build
  script:
    - npm ci
    - npm run build

test-job:
  stage: test
  script:
    - npm test
`;
  const pipeline = parseGitlabCI(src);

  it("captures stages in order", () => {
    expect(pipeline.stages).toEqual(["build", "test"]);
  });

  it("captures variables", () => {
    expect(pipeline.variables).toEqual({ NODE_ENV: "test" });
  });

  it("extracts jobs with their script lines", () => {
    expect(pipeline.jobs).toHaveLength(2);
    const build = pipeline.jobs.find((j) => j.name === "build-job")!;
    expect(build.stage).toBe("build");
    expect(build.script).toEqual(["npm ci", "npm run build"]);
  });

  it("skips hidden job templates starting with '.'", () => {
    const withHidden = src + "\n.hidden:\n  stage: test\n  script:\n    - noop\n";
    const p = parseGitlabCI(withHidden);
    expect(p.jobs.find((j) => j.name === ".hidden")).toBeUndefined();
  });
});

describe("toPushciYaml", () => {
  it("emits version, stack-less shape, and grouped stage commands", () => {
    const { yaml } = gitlabCIToPushciYaml(
      `stages:\n  - test\ntest-job:\n  stage: test\n  script:\n    - npm test\n`
    );
    expect(yaml).toMatch(/^# Imported from \.gitlab-ci\.yml by PushCI/);
    expect(yaml).toContain("version: '1'");
    expect(yaml).toContain("- name: test");
    expect(yaml).toContain("npm test");
  });

  it("emits env block when variables are present", () => {
    const { yaml } = gitlabCIToPushciYaml(
      `variables:\n  FOO: bar\nstages:\n  - test\nt:\n  stage: test\n  script:\n    - echo hi\n`
    );
    expect(yaml).toContain("env:");
    expect(yaml).toContain("FOO: bar");
  });

  it("warns on top-level include", () => {
    const { pipeline, yaml } = gitlabCIToPushciYaml(
      `include:\n  - local: /foo.yml\nstages:\n  - test\nt:\n  stage: test\n  script:\n    - echo\n`
    );
    expect(pipeline.warnings.some((w) => w.includes("include"))).toBe(true);
    expect(yaml).toContain("# WARNING:");
  });
});

describe("parseGitlabCI — defaults and edge cases", () => {
  it("infers stages from jobs when top-level stages is missing", () => {
    const p = parseGitlabCI(`only-job:\n  stage: custom\n  script:\n    - echo hi\n`);
    expect(p.stages).toContain("custom");
    expect(p.jobs[0].stage).toBe("custom");
  });

  it("defaults stage to 'test' when the job has no stage key", () => {
    const p = parseGitlabCI(`j:\n  script:\n    - echo hi\n`);
    expect(p.jobs[0].stage).toBe("test");
  });

  it("produces an empty pipeline for an empty source", () => {
    const p = parseGitlabCI("");
    expect(p.jobs).toEqual([]);
    expect(p.stages).toEqual([]);
  });
});
