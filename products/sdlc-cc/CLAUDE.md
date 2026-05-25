# SDLC.cc — Product CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules). All portfolio rules apply; this file adds product-specific constraints. **No portfolio rule may be weakened here.**

## Product mission

**Governance and compliance layer for regulated organizations.**

SDLC.cc is the audit and policy substrate for AI-generated software in regulated environments. It records who (which agent, under which policy) generated which artifact, signs the resulting evidence, and produces export-grade audit trails for EU AI Act, US executive orders, and Israeli AI directives.

Where PushCI catches risky PRs, where Qestro tests runtime behavior, where OpenSyber blocks agent misuse at runtime — SDLC.cc is the system of record that proves compliance after the fact and enforces policy before the fact.

## Target user

- CTO / CISO / Chief Compliance Officer at a regulated enterprise (financial services, healthcare, public sector, defense supply chain).
- DevSecOps lead who has to answer auditor questions about AI-generated code.
- Procurement / vendor risk team evaluating internal AI tooling.

## Product-specific architecture constraints

- **Audit storage is append-only.** No update or delete primitives. Schema-level enforcement (Postgres: no UPDATE/DELETE grants on audit tables). New entries only.
- **Evidence signing.** Every policy decision, audit row, and exported artifact is cryptographically signed. Key rotation supported; signature verification must be deterministic and offline.
- **Deterministic exports.** Same input → same exported bundle, byte-identical. Required for chain-of-custody.
- **No silent retries on policy decisions.** A failed policy evaluation MUST surface to the caller; never default to allow.
- **Multi-tenant isolation enforced at the database layer**, not the application layer. Row-level security or per-tenant schemas.
- **Office add-in surface is read-mostly.** No write paths from Excel/Word/PowerPoint/Outlook/Teams add-ins to the audit ledger without an explicit user action + second-factor.

## Product-specific test matrix

Beyond the portfolio defaults (>=90% lines, >=85% branches):

| Surface | Coverage requirement |
|---|---|
| Policy decision recording | **100% line + 100% branch** |
| Audit log immutability (no UPDATE/DELETE paths) | **100%** plus negative tests proving the API rejects mutation attempts |
| Evidence export integrity (hash, signature, determinism) | **100%** plus golden-file regression tests with multi-run determinism check |
| Cryptographic signing & verification | **100%** plus property-based tests for signature/verify round-trip |
| Cross-tenant data leakage paths | **100%** with negative test per route proving isolation |

Bug fix protocol: failing test first, then fix. No exceptions on audit/policy/crypto paths.

## Product-specific security controls

- **Cryptographic evidence signing.** Use Ed25519 or equivalent. Private keys live in HSM or KMS in production, never in env vars in prod. Dev keys clearly marked and never accepted in non-dev environments (refuse to start).
- **Append-only audit storage.** Postgres role permissions restrict to `INSERT` and `SELECT` on audit tables. CI test asserts the role lacks `UPDATE`/`DELETE`.
- **Key rotation as a first-class operation.** Documented runbook; supported via `keytool` CLI. Verification must accept both current and previous N keys.
- **Audit chain anchoring.** Optionally Merkle-hash audit batches and publish the root externally (e.g., to a transparency log or on-chain). Architecture must not preclude this.
- **Office add-in OAuth scopes are minimal.** Read-only by default. Write scopes only requested for specific user-initiated flows, with explicit consent UI.
- **Browser extension content scripts are sandboxed.** No DOM access to authenticated sessions of unrelated origins.
- **DLP module is opt-out for new tenants, not opt-in.** Default deny on egress of classified data.

## Product-specific release checklist

In addition to portfolio Definition of Done:

- [ ] All policy decisions in this release have golden-file tests with multi-run determinism check passing.
- [ ] Audit table schema migration (if any) verified as additive only.
- [ ] Signature verification tested against artifacts from the previous N releases (no breaking key changes).
- [ ] DLP classifier baseline benchmark re-run; no regression in classification recall.
- [ ] Office add-in manifests re-validated against Microsoft Partner Center store policies (Excel, Word, PowerPoint, Outlook, Teams).
- [ ] Browser extension manifests (Chrome MV3, Firefox) re-validated.
- [ ] Customer-facing audit export run end-to-end against a sample tenant; output bundle hash recorded.

## Notes on current state (post-round-4 migration)

This product is a **physical co-location of three legacy repos** (`sdlc-cc`, `sdlc-core`, `sdlc-platform`). See `CONSOLIDATION_TODO.md` for the unification backlog. Until that work is done, expect duplicate APIs, overlapping packages, and broken `@finsavvyai/*` imports in `platform/`. None of those are release-blocking by themselves, but no production deploy of the consolidated product should happen until at least items 1–4 in CONSOLIDATION_TODO are complete.
