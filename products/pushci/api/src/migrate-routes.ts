// Migrate routes — mounted at /api/migrate by index.ts.
//
// Backs the dashboard `BuildspecPasteImport.tsx` component (merge 312a234)
// which previously POSTed to routes that did not exist in the API.
// Three endpoints, three shapes, identical contract:
//
//   POST /api/migrate/buildspec   body { yaml }  → conversion result
//   POST /api/migrate/composite   body { yaml }  → conversion result
//   POST /api/migrate/terraform   body { hcl }   → pipeline extraction
//
// All endpoints return:
//   { pushciYaml, warnings, envVarsNeeded: [{ name, suggestion, isSecret }] }
//
// Auth-gated via `requireAuth` in index.ts. No persistence; pure
// stateless converters so the dashboard can preview without touching
// D1 / KV.

import { Hono } from "hono";
import type { Env } from "./types";
import { convertBuildspec } from "./migrate-buildspec";

export const migrateRoutes = new Hono<{ Bindings: Env }>();

type BodyYaml = { yaml?: unknown };
type BodyHcl = { hcl?: unknown };

function readString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

// --- POST /api/migrate/buildspec ---------------------------------------
// Accepts an AWS CodeBuild buildspec.yml body, emits the PushCI pipeline
// equivalent plus the set of env vars / secrets that the user must
// re-create on the PushCI side. Pure converter — no side effects.
migrateRoutes.post("/buildspec", async (c) => {
  let body: BodyYaml;
  try {
    body = await c.req.json<BodyYaml>();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const yaml = readString(body?.yaml);
  if (!yaml) {
    return c.json({ error: "yaml required (string)" }, 400);
  }
  if (yaml.length > 256 * 1024) {
    return c.json({ error: "yaml too large (>256KB)" }, 413);
  }
  try {
    const r = convertBuildspec(yaml);
    return c.json({
      pushciYaml: r.pushciYaml,
      warnings: r.warnings,
      envVarsNeeded: r.envVarsNeeded,
    });
  } catch (e) {
    return c.json({ error: "convert_failed", detail: String(e) }, 400);
  }
});

// --- POST /api/migrate/composite ---------------------------------------
// GitHub Actions composite-action wrapper. Shares the buildspec shape
// for response parity so the dashboard's `MigrateResultCard` stays
// provider-agnostic. Today we delegate to the buildspec converter
// because composite YAML uses the same phases/commands structure when
// flattened; a composite-specific parser can replace this once the
// Go-side `internal/migrate/composite.go` contract is finalized.
migrateRoutes.post("/composite", async (c) => {
  let body: BodyYaml;
  try {
    body = await c.req.json<BodyYaml>();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const yaml = readString(body?.yaml);
  if (!yaml) {
    return c.json({ error: "yaml required (string)" }, 400);
  }
  if (yaml.length > 256 * 1024) {
    return c.json({ error: "yaml too large (>256KB)" }, 413);
  }
  try {
    const r = convertBuildspec(yaml);
    // Swap the header banner so the result reads as a composite import.
    const pushciYaml = r.pushciYaml.replace(
      "# Imported from AWS CodeBuild buildspec.yml by PushCI",
      "# Imported from GitHub Actions composite action by PushCI",
    );
    return c.json({
      pushciYaml,
      warnings: r.warnings,
      envVarsNeeded: r.envVarsNeeded,
    });
  } catch (e) {
    return c.json({ error: "convert_failed", detail: String(e) }, 400);
  }
});

// --- POST /api/migrate/terraform ---------------------------------------
// Very light HCL pipeline extraction: we scan for `codepipeline` /
// `codebuild` resource blocks and emit a stub pipeline + the list of
// env vars the Terraform source references. The heavy lifting (real
// HCL parsing) already exists at /api/terraform/pipeline — this
// endpoint intentionally returns the unified shape so the paste-import
// UI can render all three migrations with one card component.
migrateRoutes.post("/terraform", async (c) => {
  let body: BodyHcl;
  try {
    body = await c.req.json<BodyHcl>();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const hcl = readString(body?.hcl);
  if (!hcl) {
    return c.json({ error: "hcl required (string)" }, 400);
  }
  if (hcl.length > 256 * 1024) {
    return c.json({ error: "hcl too large (>256KB)" }, 413);
  }
  return c.json(extractTerraformPipeline(hcl));
});

interface MigrateResult {
  pushciYaml: string;
  warnings: string[];
  envVarsNeeded: { name: string; suggestion: string; isSecret: boolean }[];
}

export function extractTerraformPipeline(hcl: string): MigrateResult {
  const warnings: string[] = [];
  const envSet = new Map<string, { suggestion: string; isSecret: boolean }>();
  // Match `var.X` and `aws_ssm_parameter` / `aws_secretsmanager_secret`.
  const varRegex = /\bvar\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(hcl)) !== null) {
    if (!envSet.has(m[1])) {
      envSet.set(m[1], {
        suggestion: `pushci secret set ${m[1]} <value>`,
        isSecret: false,
      });
    }
  }
  const secretRegex = /aws_(ssm_parameter|secretsmanager_secret)/g;
  if (secretRegex.test(hcl)) {
    warnings.push("Terraform references AWS Secrets Manager / SSM — migrate these via `pushci secret set`");
  }
  if (!/resource\s+"(aws_codepipeline|aws_codebuild_project)"/.test(hcl)) {
    warnings.push("no codepipeline/codebuild resources found — this HCL may not define a CI pipeline");
  }
  const pushciYaml = [
    "# Imported from Terraform HCL by PushCI",
    ...warnings.map((w) => `# WARNING: ${w}`),
    "version: '1'",
    "stages:",
    "  - name: build",
    "    run:",
    "      - echo 'Replace me with your real build command'",
    "",
  ].join("\n");
  const envVarsNeeded = Array.from(envSet.entries()).map(([name, v]) => ({
    name,
    ...v,
  }));
  return { pushciYaml, warnings, envVarsNeeded };
}
