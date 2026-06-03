#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredContentChecks = [
  {
    path: "docs/runbooks/DR_CLOUDFLARE_REGION_OUTAGE.md",
    required: [
      "RTO",
      "RPO",
      "Activation",
      "Degraded Modes",
      "Data Recovery",
      "Recovery Steps",
      "Exercise Evidence",
      "docs/runbooks/_rollback.md",
      "docs/compliance/INCIDENT_RESPONSE.md",
    ],
  },
  {
    path: "docs/runbooks/_rollback.md",
    required: ["Cloudflare Workers", "D1", "KV", "R2", "Dependency outages"],
  },
  {
    path: "docs/compliance/INCIDENT_RESPONSE.md",
    required: ["Tabletop exercise cadence", "Cloudflare regional"],
  },
];

const errors = [];

function validateSoc2A13Row() {
  const path = "docs/compliance/SOC2_READINESS.md";
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    errors.push(`${path} is missing`);
    return;
  }

  const row = readFileSync(absolutePath, "utf8")
    .split("\n")
    .find((line) => line.startsWith("| A1.3 |"));
  if (row === undefined) {
    errors.push(`${path} must include an A1.3 row`);
    return;
  }

  const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
  const evidence = cells[3] ?? "";
  const status = cells[4] ?? "";
  if (status !== "implemented") {
    errors.push(`${path} A1.3 status must be implemented`);
  }
  for (const token of [
    "docs/runbooks/DR_CLOUDFLARE_REGION_OUTAGE.md",
    "tools/validate-dr-readiness.mjs",
  ]) {
    if (!evidence.includes(token)) {
      errors.push(`${path} A1.3 evidence must include "${token}"`);
    }
  }
}

for (const check of requiredContentChecks) {
  const absolutePath = resolve(root, check.path);
  if (!existsSync(absolutePath)) {
    errors.push(`${check.path} is missing`);
    continue;
  }

  const content = readFileSync(absolutePath, "utf8");
  for (const token of check.required) {
    if (!content.includes(token)) {
      errors.push(`${check.path} must include "${token}"`);
    }
  }
}

validateSoc2A13Row();

if (errors.length > 0) {
  console.error("dr-readiness: failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("dr-readiness: ok");
