// Migrate routes tests — cover the /api/migrate/{buildspec,composite,terraform}
// handlers plus the pure converter helpers.
//
// Run: pnpm --filter api test

import { describe, it, expect } from "vitest";
import { migrateRoutes, extractTerraformPipeline } from "./migrate-routes";
import { convertBuildspec } from "./migrate-buildspec";

const BUILDSPEC_HAPPY = `
version: 0.2
env:
  variables:
    NODE_ENV: production
  secrets-manager:
    DB_PASS: arn:aws:secretsmanager:...
phases:
  install:
    commands:
      - npm install
  build:
    commands:
      - npm test
      - npm run build
artifacts:
  files:
    - 'dist/**/*'
`;

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/migrate/buildspec", () => {
  it("converts a happy-path buildspec into PushCI YAML", async () => {
    const res = await migrateRoutes.fetch(post("/buildspec", { yaml: BUILDSPEC_HAPPY }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      pushciYaml: string;
      warnings: string[];
      envVarsNeeded: { name: string; isSecret: boolean }[];
    };
    expect(json.pushciYaml).toContain("- name: install");
    expect(json.pushciYaml).toContain("- name: build");
    expect(json.pushciYaml).toContain("npm test");
  });

  it("detects secrets-manager entries as isSecret=true", async () => {
    const res = await migrateRoutes.fetch(post("/buildspec", { yaml: BUILDSPEC_HAPPY }));
    const json = (await res.json()) as {
      envVarsNeeded: { name: string; isSecret: boolean }[];
    };
    const dbPass = json.envVarsNeeded.find((v) => v.name === "DB_PASS");
    expect(dbPass?.isSecret).toBe(true);
    const nodeEnv = json.envVarsNeeded.find((v) => v.name === "NODE_ENV");
    expect(nodeEnv?.isSecret).toBe(false);
  });

  it("emits a warning for an artifacts block", async () => {
    const res = await migrateRoutes.fetch(post("/buildspec", { yaml: BUILDSPEC_HAPPY }));
    const json = (await res.json()) as { warnings: string[] };
    expect(json.warnings.some((w) => /artifacts/.test(w))).toBe(true);
  });

  it("rejects empty body with 400 and yaml-required message", async () => {
    const res = await migrateRoutes.fetch(post("/buildspec", {}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/yaml required/);
  });

  it("rejects malformed JSON payloads with 400", async () => {
    const req = new Request("http://localhost/buildspec", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await migrateRoutes.fetch(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_json");
  });

  it("still returns a result (with warnings) for nonsense YAML", async () => {
    const res = await migrateRoutes.fetch(post("/buildspec", { yaml: "hello: world\n" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { warnings: string[]; pushciYaml: string };
    expect(json.warnings.some((w) => /phases/.test(w))).toBe(true);
    expect(json.pushciYaml).toContain("version: '1'");
  });
});

describe("POST /api/migrate/composite", () => {
  it("returns a composite-branded YAML header", async () => {
    const res = await migrateRoutes.fetch(post("/composite", { yaml: BUILDSPEC_HAPPY }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { pushciYaml: string };
    expect(json.pushciYaml).toContain("composite action");
  });
});

describe("POST /api/migrate/terraform", () => {
  it("extracts var.X references as env vars", async () => {
    const hcl = `
resource "aws_codepipeline" "pipe" {
  name = var.pipeline_name
  role_arn = var.role
}
`;
    const res = await migrateRoutes.fetch(post("/terraform", { hcl }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      envVarsNeeded: { name: string }[];
      warnings: string[];
    };
    const names = json.envVarsNeeded.map((v) => v.name).sort();
    expect(names).toEqual(["pipeline_name", "role"]);
  });

  it("warns when no codepipeline resources are found", async () => {
    const res = await migrateRoutes.fetch(post("/terraform", { hcl: "provider \"aws\" {}" }));
    const json = (await res.json()) as { warnings: string[] };
    expect(json.warnings.some((w) => /codepipeline/.test(w))).toBe(true);
  });

  it("rejects missing hcl with 400", async () => {
    const res = await migrateRoutes.fetch(post("/terraform", {}));
    expect(res.status).toBe(400);
  });
});

describe("convertBuildspec / extractTerraformPipeline (pure)", () => {
  it("is importable without hitting Hono", () => {
    const r = convertBuildspec("phases:\n  build:\n    commands:\n      - make\n");
    expect(r.pushciYaml).toContain("- make");
    const tf = extractTerraformPipeline("resource \"aws_codebuild_project\" \"p\" {}\n");
    expect(tf.warnings.length).toBe(0);
  });
});

// v1.6.6 audit M-006: buildspec command with a literal backslash-n
// must NOT be emitted as double-quoted "foo\nbar" — YAML would
// interpret that as a real newline. Must use single-quoted form.
describe("convertBuildspec — M-006 backslash escaping regression", () => {
  it("emits literal `\\n` in a command as single-quoted scalar", () => {
    // Input: a buildspec command containing the literal 4 chars foo\nbar.
    // Note: YAML source uses backslash-backslash-n to represent literal \n
    // inside a double-quoted source scalar.
    const src = [
      "phases:",
      "  build:",
      "    commands:",
      '      - "echo foo\\nbar"',
      "",
    ].join("\n");
    const r = convertBuildspec(src);
    // Must NOT emit as double-quoted (which would reinterpret \n).
    expect(r.pushciYaml).not.toContain('- "echo foo\\nbar"');
    // Must emit as single-quoted so the literal backslash is preserved.
    expect(r.pushciYaml).toContain("- 'echo foo\\nbar'");
  });

  it("preserves a command with literal backslashes in a path", () => {
    const src = [
      "phases:",
      "  post_build:",
      "    commands:",
      "      - rm -rf ~/.m2/repository/com/\\foo",
      "",
    ].join("\n");
    const r = convertBuildspec(src);
    expect(r.pushciYaml).toContain(
      "- 'rm -rf ~/.m2/repository/com/\\foo'",
    );
  });
});
