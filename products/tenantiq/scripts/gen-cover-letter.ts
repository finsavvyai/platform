#!/usr/bin/env tsx
/**
 * Generate the auditor cover letter, auto-filled from package.json + git.
 * Writes docs/COVER_LETTER.md so the evidence bundle picks it up via copyTree.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/COVER_LETTER.md');

function sh(c: string): string {
	try { return execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
	catch { return ''; }
}

const head = sh('git rev-parse HEAD');
const tag = sh('git describe --tags --always') || 'untagged';
const date = new Date().toISOString().slice(0, 10);
const apiPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/api/package.json'), 'utf8'));
const webPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/package.json'), 'utf8'));

const body = `# Cover letter — TenantIQ M365 Certification submission

Reviewer,

This bundle accompanies TenantIQ's submission for **Microsoft 365 Certification (Level 1)**. Every claim here is traceable to a file in the bundle.

**Submission metadata**

- Date: ${date}
- Git commit: \`${head}\`
- Build tag: \`${tag}\`
- API package: \`${apiPkg.name}@${apiPkg.version || 'n/a'}\`
- Web package: \`${webPkg.name}@${webPkg.version || 'n/a'}\`

**How to read this bundle**

1. Start with \`docs/MS_CERTIFICATION.md\` — control matrix with status per control.
2. \`docs/PARTNER_CENTER_SUBMISSION.md\` mirrors the answers we placed into Partner Center, with file-level citations.
3. Architecture: \`docs/ARCHITECTURE_DIAGRAM.md\` (auto-generated from \`wrangler.toml\` + code) plus the data-flow diagram in \`docs/DATA_FLOW.md\` and STRIDE in \`docs/THREAT_MODEL.md\`.
4. Security operations: \`docs/SDLC.md\`, \`docs/INCIDENT_RESPONSE.md\`, \`docs/DR_RUNBOOK.md\`, \`docs/BUSINESS_CONTINUITY.md\`.
5. Data handling: \`docs/DATA_CLASSIFICATION.md\`, \`docs/DATA_RETENTION.md\`, \`docs/DATA_DELETION.md\`.
6. CI evidence: \`.github/workflows/security.yml\` + last 90 days in \`ci-security-history.json\`. Live verification: \`playwright-smoke-latest.json\`.
7. Sub-processors + DPA: \`docs/SUB_PROCESSORS.md\` + \`docs/DPA.md\`.
8. Vulnerability disclosure: \`docs/VULNERABILITY_DISCLOSURE.md\` + public \`/.well-known/security.txt\`.

**Known gaps disclosed**

- External penetration test: scheduled. Report will be supplied as an addendum within 30 days of vendor delivery.
- SOC 2 Type II: not yet held; Type I drafted. Not required for L1; included for visibility.
- Status page on a separate provider: backlog item; comms fallback documented in \`docs/INCIDENT_RESPONSE.md\`.

**Verification**

- Every file is sha256-summed in \`sha256sums.txt\`.
- A daily GitHub Action (\`.github/workflows/cert-status.yml\`) re-runs the live smoke suite against \`https://app.tenantiq.app\` and \`https://api.tenantiq.app\` and fails on regression.

**Contact**

- Security responder: \`security@tenantiq.app\`
- Privacy / DPA: \`privacy@tenantiq.app\`
- Submission owner: see Partner Center primary contact.

We're available for follow-up questions at \`security@tenantiq.app\`.

— TenantIQ team
`;

fs.writeFileSync(OUT, body);
console.log(`OK  ${OUT}`);
