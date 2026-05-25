import { describe, it, expect } from "vitest";
import {
  parseCircleCIConfig,
  toPushciYaml,
  circleCIConfigToPushciYaml,
  detectStack,
  extractJobsSection,
  splitJobs,
  extractJobCommands,
} from "./circleci-importer";

describe("extractJobsSection", () => {
  it("returns children of the top-level jobs key", () => {
    const src = `version: 2.1
jobs:
  build:
    docker: []
  test:
    steps: []
workflows: {}`;
    const lines = extractJobsSection(src);
    expect(lines[0]).toMatch(/^  build:/);
    expect(lines.some((l) => /^  test:/.test(l))).toBe(true);
    expect(lines.some((l) => /workflows/.test(l))).toBe(false);
  });

  it("returns empty when jobs is missing", () => {
    expect(extractJobsSection("version: 2.1")).toEqual([]);
  });
});

describe("splitJobs", () => {
  it("splits each child into its own block", () => {
    const jobs = splitJobs([
      "  build:",
      "    steps: []",
      "  test:",
      "    steps: []",
    ]);
    expect(jobs.map((j) => j.name)).toEqual(["build", "test"]);
  });
});

describe("extractJobCommands", () => {
  it("handles one-liner run steps", () => {
    const cmds = extractJobCommands([
      "    steps:",
      "      - checkout",
      "      - run: npm install",
      "      - run: npm test",
    ]);
    expect(cmds).toEqual(["npm install", "npm test"]);
  });

  it("handles block-form run with name + command", () => {
    const cmds = extractJobCommands([
      "    steps:",
      "      - run:",
      "          name: Run tests",
      "          command: pytest -q",
    ]);
    expect(cmds).toEqual(["pytest -q"]);
  });

  it("strips surrounding quotes from commands", () => {
    const cmds = extractJobCommands([
      "    steps:",
      `      - run: "echo hello"`,
      `      - run: 'ls -la'`,
    ]);
    expect(cmds).toEqual(["echo hello", "ls -la"]);
  });
});

describe("detectStack", () => {
  it("node for npm/pnpm/yarn commands", () => {
    expect(detectStack(["npm install"])).toBe("node");
    expect(detectStack(["pnpm test"])).toBe("node");
  });
  it("python for pytest/pip", () => {
    expect(detectStack(["pytest -q"])).toBe("python");
    expect(detectStack(["pip install -r requirements.txt"])).toBe("python");
  });
  it("java-maven for mvn, java-gradle for gradle", () => {
    expect(detectStack(["mvn -B package"])).toBe("java-maven");
    expect(detectStack(["./gradlew build"])).toBe("java-gradle");
  });
  it("go for go test/build", () => {
    expect(detectStack(["go test ./..."])).toBe("go");
  });
  it("unknown otherwise", () => {
    expect(detectStack(["echo hi"])).toBe("unknown");
  });
});

describe("parseCircleCIConfig — node job", () => {
  const src = `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:20.11
    steps:
      - checkout
      - run: npm install
      - run: npm test
workflows:
  main:
    jobs:
      - build
`;
  const p = parseCircleCIConfig(src);

  it("detects node stack", () => {
    expect(p.stack).toBe("node");
  });

  it("captures the build job with both commands", () => {
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].name).toBe("build");
    expect(p.stages[0].steps).toEqual(["npm install", "npm test"]);
  });

  it("toPushciYaml renders stack + commands", () => {
    const yaml = toPushciYaml(p);
    expect(yaml).toContain("stack: node");
    expect(yaml).toContain("- name: build");
    expect(yaml).toContain("npm install");
    expect(yaml).toContain("npm test");
  });
});

describe("parseCircleCIConfig — multi-job python pipeline", () => {
  const src = `version: 2.1
jobs:
  lint:
    steps:
      - run:
          name: Lint
          command: ruff check .
  test:
    steps:
      - run: pytest -q
`;
  const p = parseCircleCIConfig(src);

  it("emits one stage per job in declared order", () => {
    expect(p.stages.map((s) => s.name)).toEqual(["lint", "test"]);
  });

  it("extracts commands from both one-line and block forms", () => {
    expect(p.stages[0].steps).toEqual(["ruff check ."]);
    expect(p.stages[1].steps).toEqual(["pytest -q"]);
  });

  it("detects python stack", () => {
    expect(p.stack).toBe("python");
  });
});

describe("circleCIConfigToPushciYaml — end-to-end", () => {
  it("renders a valid-looking YAML preview", () => {
    const { pipeline, yaml } = circleCIConfigToPushciYaml(
      `jobs:
  build:
    steps:
      - run: mvn -B package
`
    );
    expect(pipeline.stack).toBe("java-maven");
    expect(yaml).toMatch(/^# Imported from .circleci\/config.yml/);
    expect(yaml).toContain("version: '1'");
    expect(yaml).toContain("mvn -B package");
  });

  it("warns when jobs: block is absent", () => {
    const { yaml } = circleCIConfigToPushciYaml("version: 2.1\nworkflows: {}");
    expect(yaml).toContain("# WARNING:");
  });
});
