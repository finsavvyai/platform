# OpenSyber — Product CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules). All portfolio rules apply; this file adds product-specific constraints. **No portfolio rule may be weakened here.**

The legacy upstream CLAUDE.md is preserved as `CLAUDE.legacy.md` for product context (architecture notes, history). It is NOT the canonical product CLAUDE.md.

## Product mission

**Runtime AI security — WAF equivalent for MCP/AI agents in production.**

As MCP usage scales and autonomous AI agents enter production workloads, the existing security perimeter (WAFs, RASP, SAST) was built for HTTP traffic and human-authored code. OpenSyber sits in the request path between the agent runtime and the world — inspecting tool calls, sandboxing execution, detecting prompt-injection attempts, and enforcing per-agent allowlists.

Where SDLC.cc is the system of record after the fact, OpenSyber is the enforcement plane in real time. They share a types contract (`packages/shared/src/types/sdlc.ts`) and are designed to be deployed together.

## Target user

- Platform security engineer at a company deploying autonomous agents (MCP servers, AI copilots, RPA-style automations).
- Security architect designing an AI agent security posture from zero.
- Incident responder reconstructing what a runaway agent did.

## Product-specific architecture constraints

- **Zero-trust agent execution.** Every tool call from an agent is treated as untrusted until proven via signed tool registry + per-call policy check. Default deny.
- **Signed tool calls.** Tools registered with OpenSyber have signed manifests. Tool calls carry a signature over (tool ID, args, calling agent ID, nonce). Unsigned or invalid-signature calls are rejected at the perimeter.
- **Sandbox-by-default for tool execution.** Tools execute in restricted environments (network egress filtered, FS access scoped, syscall allowlist) unless explicitly elevated by policy.
- **Prompt-injection defenses.** Input classifiers run on all data flowing INTO an agent's context window (tool results, retrieved docs, user-supplied content). High-confidence injection attempts are quarantined and logged.
- **Sandbox escape detection.** Monitor for known escape patterns (unexpected privilege gain, unexpected network connections, fork bombs). Auto-quarantine on detection; require human approval to resume.
- **Audit emit is mandatory.** Every policy decision, blocked call, and sandbox event emits to the shared audit sink (`FINSAVVY_AUDIT_SINK`). Audit is on the hot path; a failed audit emit MUST block the action (fail-closed).
- **Observable from outside.** Health endpoint per round-3 contract: `{ status, version, uptime_s, checks }`.

## Product-specific test matrix

Beyond portfolio defaults (>=90% lines, >=85% branches):

| Surface | Coverage requirement |
|---|---|
| Threat detection rules (injection classifiers, jailbreak detectors, exfil patterns) | **100% line + 100% branch** plus regression corpus of known-bad inputs (no regressions) |
| Sandbox escape detection (syscall monitor, network monitor, FS monitor) | **100%** plus integration tests triggering each detection path |
| Prompt-injection defenses (lethal-trifecta: indirect injection, exfil, privilege chains) | **100%** plus property-based fuzzing |
| Tool call signature verification | **100%** plus tamper tests proving modification is detected |
| Audit emit failure → action block (fail-closed) | **100%** with forced-audit-failure test path |
| Agent allowlist enforcement | **100%** with negative tests per disallow vector |

Bug fix protocol: failing test first, then fix. **A bypass in a threat-detection rule is a security incident, not a normal bug** — treat under the security release-blocker rule.

## Product-specific security controls

- **Tool registry signed and version-pinned.** No dynamic tool loading from untrusted sources. New tool registration = admin role + audit log entry.
- **Sandbox profiles immutable per release.** Profile mutation requires config-as-code change merge + signed release artifact, never a runtime API.
- **Detection rules ship as code, not config.** No `rules.yaml` hot-reload. Rule changes require a release with full test coverage.
- **Zero PII in detection telemetry by default.** Any field that could carry user content is hashed or redacted before emit. Raw content retained only in quarantine storage with separate access control.
- **Agent identity is cryptographic.** Each agent has a keypair; calls are signed; rotation supported. No bearer-token-based agent identity in production.
- **Lateral movement detection.** Agents calling tools outside their historical pattern raise an anomaly score; high scores trigger soft-quarantine (rate-limit) → hard-quarantine (block) → human review.

## Product-specific release checklist

In addition to portfolio Definition of Done:

- [ ] Threat-detection regression corpus passes 100%. No false-negatives on previously-caught attacks.
- [ ] Sandbox escape test suite passes against current OS/runtime versions.
- [ ] Fail-closed audit path exercised in CI (forced-audit-failure → action blocked).
- [ ] Performance budget: detection latency p99 < 50ms on hot path (release blocked otherwise).
- [ ] Tool registry signing keys verified non-rotated since previous release (or rotation runbook explicitly executed).
- [ ] Quarantine storage capacity headroom >= 30 days at current ingest rate.

## Notes on current state (post-round-4 migration)

Direct copy of `portfolio/opensyber` at SHA `77af1c7c…`. Co-located with SDLC.cc and PipeWarden (OSS) in the same monorepo. Shared types exist (`packages/shared/src/types/{sdlc,pipewarden,agent-run-contract}.ts`) and SHOULD move to root `packages/shared-types/` in a follow-up, alongside AMLIQ's types.

A worktree variant `portfolio/opensyber.agent1` exists but is being routed to `_archive/` by the ARCHIVE-WEBSITE agent.
