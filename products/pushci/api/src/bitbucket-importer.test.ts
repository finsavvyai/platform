import { describe, it, expect } from "vitest";
import {
  parseBitbucketPipelines,
  toPushciYaml,
  bitbucketYmlToPushciYaml,
} from "./bitbucket-importer";

describe("parseBitbucketPipelines — minimal default pipeline", () => {
  const src = `
image: node:20
pipelines:
  default:
    - step:
        name: Build
        script:
          - npm ci
          - npm test
`;
  const p = parseBitbucketPipelines(src);

  it("pulls the global image", () => {
    expect(p.image).toBe("node:20");
  });

  it("extracts the step name", () => {
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].name).toBe("Build");
  });

  it("preserves script line order", () => {
    expect(p.stages[0].steps).toEqual(["npm ci", "npm test"]);
  });

  it("emits clean PushCI YAML", () => {
    const yaml = toPushciYaml(p);
    expect(yaml).toContain("image: node:20");
    expect(yaml).toContain("- name: Build");
    expect(yaml).toContain('"npm ci"');
    expect(yaml).toContain('"npm test"');
  });
});

describe("parseBitbucketPipelines — multi-step default", () => {
  const src = `
pipelines:
  default:
    - step:
        name: Install
        script:
          - npm ci
    - step:
        name: Test
        script:
          - npm test
    - step:
        name: Deploy
        script:
          - ./scripts/deploy.sh
`;
  const p = parseBitbucketPipelines(src);

  it("keeps step order", () => {
    expect(p.stages.map((s) => s.name)).toEqual(["Install", "Test", "Deploy"]);
  });

  it("maps each step's script", () => {
    expect(p.stages[0].steps).toEqual(["npm ci"]);
    expect(p.stages[1].steps).toEqual(["npm test"]);
    expect(p.stages[2].steps).toEqual(["./scripts/deploy.sh"]);
  });
});

describe("parseBitbucketPipelines — parallel flattening warning", () => {
  const src = `
pipelines:
  default:
    - parallel:
        - step:
            script:
              - npm run lint
    - step:
        script:
          - npm test
`;
  const p = parseBitbucketPipelines(src);

  it("emits a parallel warning", () => {
    expect(p.warnings.some((w) => w.includes("parallel"))).toBe(true);
  });
});

describe("parseBitbucketPipelines — error cases", () => {
  it("warns when no pipelines: key exists", () => {
    const p = parseBitbucketPipelines("image: node:20\n");
    expect(p.warnings.some((w) => w.includes("no 'pipelines:'"))).toBe(true);
    expect(p.stages).toEqual([]);
  });

  it("warns when no default pipeline is defined", () => {
    const p = parseBitbucketPipelines(`
pipelines:
  branches:
    main:
      - step:
          script:
            - npm test
`);
    expect(p.warnings.some((w) => w.includes("default"))).toBe(true);
  });
});

describe("bitbucketYmlToPushciYaml — end to end", () => {
  it("produces a valid-looking YAML shell", () => {
    const { pipeline, yaml } = bitbucketYmlToPushciYaml(`
image: python:3.11
pipelines:
  default:
    - step:
        name: Test
        script:
          - pytest -x
`);
    expect(pipeline.stages).toHaveLength(1);
    expect(yaml).toMatch(/^# Imported from bitbucket-pipelines.yml by PushCI/);
    expect(yaml).toContain("version: '1'");
    expect(yaml).toContain("image: python:3.11");
    expect(yaml).toContain('"pytest -x"');
  });

  it("still emits a valid YAML even when stages are missing", () => {
    const { yaml } = bitbucketYmlToPushciYaml("image: node:20\n");
    expect(yaml).toContain("# WARNING:");
    expect(yaml).toContain("stages:");
  });
});
