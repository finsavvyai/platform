import { describe, it, expect } from "vitest";
import {
  parseAzurePipeline,
  toPushciYaml,
  azurePipelineToPushciYaml,
} from "./azure-devops-importer";

describe("parseAzurePipeline — steps-only", () => {
  const src = `
steps:
  - script: npm install
    displayName: Install
  - script: npm test
  - bash: ./deploy.sh
`;
  const doc = parseAzurePipeline(src);

  it("wraps steps into one stage/one job", () => {
    expect(doc.stages).toHaveLength(1);
    expect(doc.stages[0].jobs).toHaveLength(1);
    expect(doc.stages[0].jobs[0].steps.map((s) => s.script)).toEqual([
      "npm install",
      "npm test",
      "./deploy.sh",
    ]);
  });

  it("captures displayName", () => {
    expect(doc.stages[0].jobs[0].steps[0].displayName).toBe("Install");
  });
});

describe("parseAzurePipeline — stages & jobs", () => {
  const src = `
variables:
  NODE_VERSION: '20'
  RELEASE: prod

stages:
  - stage: Build
    jobs:
      - job: buildJob
        steps:
          - script: npm ci
          - script: npm run build
  - stage: Test
    jobs:
      - job: unit
        steps:
          - script: npm test
`;
  const doc = parseAzurePipeline(src);

  it("extracts variables", () => {
    expect(doc.variables.NODE_VERSION).toBe("20");
    expect(doc.variables.RELEASE).toBe("prod");
  });

  it("preserves stage order and names", () => {
    expect(doc.stages.map((s) => s.name)).toEqual(["Build", "Test"]);
  });

  it("extracts steps within nested jobs", () => {
    expect(doc.stages[0].jobs[0].steps.map((s) => s.script)).toEqual([
      "npm ci",
      "npm run build",
    ]);
    expect(doc.stages[1].jobs[0].steps[0].script).toBe("npm test");
  });
});

describe("parseAzurePipeline — unsupported tasks", () => {
  const src = `
steps:
  - task: PublishBuildArtifacts@1
    displayName: Publish
  - script: echo done
`;
  const doc = parseAzurePipeline(src);

  it("warns on task-only steps", () => {
    expect(doc.warnings.some((w) => w.includes("PublishBuildArtifacts@1"))).toBe(true);
  });

  it("still captures the executable script step", () => {
    const steps = doc.stages[0].jobs[0].steps;
    expect(steps.some((s) => s.script === "echo done")).toBe(true);
  });
});

describe("parseAzurePipeline — warnings for advanced constructs", () => {
  it("warns on templates", () => {
    const doc = parseAzurePipeline(`steps:\n  - template: foo.yml`);
    expect(doc.warnings.some((w) => /template/i.test(w))).toBe(true);
  });

  it("warns on strategy", () => {
    const doc = parseAzurePipeline(`
jobs:
  - job: x
    strategy:
      matrix:
        a: { X: 1 }
    steps:
      - script: echo
`);
    expect(doc.warnings.some((w) => /matrix/i.test(w) || /strategy/i.test(w))).toBe(true);
  });
});

describe("toPushciYaml emission", () => {
  it("emits pushci.yml with env and stages", () => {
    const { yaml } = azurePipelineToPushciYaml(`
variables:
  FOO: bar
stages:
  - stage: Build
    jobs:
      - job: j
        steps:
          - script: echo hi
`);
    expect(yaml).toContain("version: '1'");
    expect(yaml).toContain("env:");
    expect(yaml).toContain("FOO: bar");
    expect(yaml).toContain("- name: Build");
    expect(yaml).toContain("echo hi");
  });

  it("emits warning comments in output", () => {
    const { yaml } = azurePipelineToPushciYaml(`steps:\n  - task: Foo@1`);
    expect(yaml).toContain("# WARNING");
    expect(yaml).toContain("# TODO: task Foo@1");
  });

  it("uses supplied pipeline name", () => {
    const doc = parseAzurePipeline(`steps:\n  - script: echo`);
    const yaml = toPushciYaml(doc, "norlys-backend");
    expect(yaml).toContain("name: norlys-backend");
  });
});
