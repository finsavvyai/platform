#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checks = [
  {
    path: "docs/compliance/POSTMORTEM_TEMPLATE.md",
    required: [
      "Timeline",
      "Impact",
      "Contributing Factors",
      "Action Items",
      "Evidence Package",
      "Approval",
    ],
  },
  {
    path: "docs/compliance/regulator-templates/FINCEN.md",
    required: ["AML", "SAR", "Remediation", "Attachments"],
  },
  {
    path: "docs/compliance/regulator-templates/OFAC.md",
    required: ["Sanctions", "Snapshot", "Remediation", "Attachments"],
  },
  {
    path: "docs/compliance/regulator-templates/EU_DPA.md",
    required: ["personal data", "Notification deadline", "Measures Taken"],
  },
  {
    path: "docs/runbooks/AUDIT_CHAIN_HEAD_DIVERGENCE.md",
    required: ["SEV1", "D1", "R2", "audit verifier", "Recovery Gate"],
  },
  {
    path: "docs/compliance/INCIDENT_RESPONSE.md",
    required: [
      "docs/compliance/POSTMORTEM_TEMPLATE.md",
      "docs/compliance/regulator-templates/",
      "docs/runbooks/AUDIT_CHAIN_HEAD_DIVERGENCE.md",
    ],
  },
  {
    path: "docs/compliance/RISK_REGISTER.md",
    required: ["docs/runbooks/AUDIT_CHAIN_HEAD_DIVERGENCE.md"],
  },
];

const errors = [];

for (const check of checks) {
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

if (errors.length > 0) {
  console.error("incident-readiness: failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("incident-readiness: ok");
