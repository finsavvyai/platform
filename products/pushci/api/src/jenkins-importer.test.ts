import { describe, it, expect } from "vitest";
import {
  parseJenkinsfile,
  toPushciYaml,
  jenkinsfileToPushciYaml,
  parseEnvBlock,
  parseShSteps,
  extractBlock,
  detectStack,
} from "./jenkins-importer";

describe("extractBlock", () => {
  it("returns the body of a brace-delimited block", () => {
    expect(extractBlock("foo { bar }", "foo").trim()).toBe("bar");
  });

  it("handles nested braces", () => {
    const src = "pipeline { stages { stage { steps { sh 'x' } } } }";
    const body = extractBlock(src, "pipeline");
    expect(body).toContain("stages");
    expect(body).toContain("sh 'x'");
  });

  it("returns empty string when the block is missing", () => {
    expect(extractBlock("no blocks here", "pipeline")).toBe("");
  });
});

describe("parseEnvBlock", () => {
  it("parses single-quoted env vars", () => {
    expect(parseEnvBlock("FOO = 'bar'\nBAZ = 'qux'")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("parses double-quoted env vars", () => {
    expect(parseEnvBlock(`MAVEN_OPTS = "-Xmx1g"`)).toEqual({ MAVEN_OPTS: "-Xmx1g" });
  });
});

describe("parseShSteps", () => {
  it("extracts single-quoted sh steps", () => {
    expect(parseShSteps("sh 'mvn clean package'")).toEqual(["mvn clean package"]);
  });

  it("extracts multiple sh calls in order", () => {
    const body = `sh 'mvn -B clean'
                  sh "mvn -B test"
                  echo 'ignore me'`;
    expect(parseShSteps(body)).toEqual(["mvn -B clean", "mvn -B test"]);
  });
});

describe("detectStack", () => {
  it("recognises maven", () => {
    expect(detectStack(["mvn clean package"])).toBe("java-maven");
  });

  it("recognises gradle", () => {
    expect(detectStack(["./gradlew build"])).toBe("java-gradle");
  });

  it("falls back to unknown", () => {
    expect(detectStack(["echo hi"])).toBe("unknown");
  });
});

describe("parseJenkinsfile — simple mvn pipeline", () => {
  const src = `
    pipeline {
      agent any
      stages {
        stage('Build') {
          steps {
            sh 'mvn -B clean package'
          }
        }
      }
    }
  `;
  const pipeline = parseJenkinsfile(src);

  it("detects the java-maven stack", () => {
    expect(pipeline.stack).toBe("java-maven");
  });

  it("extracts the Build stage with its sh command", () => {
    expect(pipeline.stages).toHaveLength(1);
    expect(pipeline.stages[0].name).toBe("Build");
    expect(pipeline.stages[0].steps).toEqual(["mvn -B clean package"]);
  });

  it("produces YAML with the maven command and stack", () => {
    const yaml = toPushciYaml(pipeline);
    expect(yaml).toContain("stack: java-maven");
    expect(yaml).toContain("- name: Build");
    expect(yaml).toContain("mvn -B clean package");
  });
});

describe("parseJenkinsfile — multi-stage pipeline", () => {
  const src = `
    pipeline {
      agent any
      stages {
        stage('Checkout') { steps { sh 'git fetch --all' } }
        stage('Build')    { steps { sh 'mvn -B package -DskipTests' } }
        stage('Test')     { steps { sh 'mvn -B test' } }
        stage('Deploy')   { steps { sh './scripts/deploy.sh prod' } }
      }
    }
  `;
  const pipeline = parseJenkinsfile(src);

  it("preserves stage order", () => {
    expect(pipeline.stages.map((s) => s.name)).toEqual([
      "Checkout",
      "Build",
      "Test",
      "Deploy",
    ]);
  });

  it("collects every sh command", () => {
    expect(pipeline.stages[0].steps).toEqual(["git fetch --all"]);
    expect(pipeline.stages[2].steps).toEqual(["mvn -B test"]);
    expect(pipeline.stages[3].steps).toEqual(["./scripts/deploy.sh prod"]);
  });
});

describe("parseJenkinsfile — environment block", () => {
  const src = `
    pipeline {
      agent any
      environment {
        MAVEN_OPTS = '-Xmx2g'
        ENV_NAME = 'prod'
      }
      stages {
        stage('Build') { steps { sh 'mvn -B verify' } }
      }
    }
  `;
  const pipeline = parseJenkinsfile(src);

  it("captures env vars", () => {
    expect(pipeline.env).toEqual({ MAVEN_OPTS: "-Xmx2g", ENV_NAME: "prod" });
  });

  it("emits env vars into YAML", () => {
    const yaml = toPushciYaml(pipeline);
    expect(yaml).toContain("env:");
    expect(yaml).toContain("MAVEN_OPTS:");
    expect(yaml).toContain("ENV_NAME: prod");
  });
});

describe("parseJenkinsfile — post hooks", () => {
  const src = `
    pipeline {
      agent any
      stages {
        stage('Build') { steps { sh 'mvn -B package' } }
      }
      post {
        failure {
          sh './scripts/notify-failure.sh'
        }
        success {
          sh './scripts/notify-success.sh'
        }
      }
    }
  `;
  const pipeline = parseJenkinsfile(src);

  it("extracts on_failure hook steps", () => {
    expect(pipeline.hooks.on_failure).toEqual(["./scripts/notify-failure.sh"]);
  });

  it("extracts on_success hook steps", () => {
    expect(pipeline.hooks.on_success).toEqual(["./scripts/notify-success.sh"]);
  });

  it("renders hooks section in YAML", () => {
    const yaml = toPushciYaml(pipeline);
    expect(yaml).toContain("hooks:");
    expect(yaml).toContain("on_failure:");
    expect(yaml).toContain("./scripts/notify-failure.sh");
    expect(yaml).toContain("on_success:");
  });
});

describe("jenkinsfileToPushciYaml — end-to-end", () => {
  it("produces a valid-looking YAML string", () => {
    const { pipeline, yaml } = jenkinsfileToPushciYaml(
      `pipeline { agent any stages { stage('T') { steps { sh 'mvn test' } } } }`
    );
    expect(pipeline.stages).toHaveLength(1);
    expect(yaml).toMatch(/^# Imported from Jenkinsfile by PushCI/);
    expect(yaml).toContain("version: '1'");
    expect(yaml).toContain("stack: java-maven");
  });

  it("emits a warning comment for scripted pipelines without stages block", () => {
    const { yaml } = jenkinsfileToPushciYaml(`node { sh 'mvn package' }`);
    expect(yaml).toContain("# WARNING:");
  });
});
