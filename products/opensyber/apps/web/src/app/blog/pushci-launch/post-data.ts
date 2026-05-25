export const catches = [
  'Imports of modules that were hallucinated — the package exists nowhere, but the AI wrote import { parse } from "csv-autoparse" with full confidence.',
  'Function calls to APIs that do not exist — the AI read old docs and generated client.billing.syncInvoices(), but that method was removed two versions ago.',
  'Schema changes that break downstream consumers — a migration adds a NOT NULL column without a default, and three services depend on inserts to that table.',
  'Packages that were typosquatted by the AI — it suggested expres instead of express, and npm has a malicious package registered under that name.',
  'Terraform resources with overly permissive IAM — the AI generated iam:* because the docs example used it, and your baseline policy does not allow that.',
  'Docker images pinned to :latest — the AI copied from a blog post and your base image now runs as root with no resource limits.',
];

export const limitations = [
  'It does not catch logic bugs. If the AI writes a sorting algorithm that sorts in the wrong direction, PushCI will not flag it. That is what tests are for.',
  'It does not replace your test suite. PushCI catches structural failures — broken references, dangerous dependencies, drifted infrastructure. It is not a substitute for unit or integration tests.',
  'It does not do full program analysis. PushCI runs in 340ms because it does targeted semantic checks, not whole-program symbolic execution. It trades completeness for speed and low false positives.',
];
