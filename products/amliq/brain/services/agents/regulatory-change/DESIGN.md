# Regulatory Change Agent — Design

Status: **design + skeleton implementation**. M3 W9 of `decisive_plan_90day.md`.

## 1. Purpose

Detect material changes to compliance documents (FinCEN notices, FFIEC
guidance, etc.) by comparing two snapshots of the same `ComplianceDoc`
(prior version vs current version) and, when material, produce a
`JiraDraft` for a human compliance officer to review.

This package establishes the second Python agent in the Brain runtime
and mirrors the SAR-draft pattern (mesh §7).

## 2. Architecture

```
                          ┌────────────────────────────┐
   current_doc  ────────► │   RegulatoryChangeAgent    │
   prior_doc    ────────► │     (change_agent.py)      │
                          │                            │
                          │   ┌────────────────────┐   │
                          │   │  diff_policy       │   │   (pure; no I/O)
                          │   └────────┬───────────┘   │
                          │            ▼               │
                          │   ┌────────────────────┐   │
                          │   │  classify_change   │   │   (pure; rule-based)
                          │   └────────┬───────────┘   │
                          │            ▼               │
                          │   ┌────────────────────┐   │   ┌────────────────┐
                          │   │  draft_jira        │◄──┼──►│   JiraClient   │ (injected;
                          │   └────────┬───────────┘   │   │   draft-only,  │  fake-only
                          │            ▼               │   │   no HTTP)     │  in v0)
                          │   ┌────────────────────┐   │   ┌────────────────┐
                          │   │  emit audit (best  │◄──┼──►│  AuditEmitter  │ (injected)
                          │   │  effort)           │   │   └────────────────┘
                          │   └────────┬───────────┘   │
                          │            ▼               │
                          │       RegulatoryUpdate     │
                          └────────────────────────────┘
```

Pure functions where possible (`differ`, `classifier`, `jira_drafter`).
The orchestrator (`change_agent`) is the only module that touches the
injected ports — and even those ports are draft-only / event-emit-only.

## 3. Safety invariants (release-blocking)

| # | Invariant | Where enforced | Test |
|---|---|---|---|
| 1 | `JiraDraft.human_review_required` is ALWAYS `True` | `jira_drafter.draft_jira()` | `test_jira_drafter::test_invariant_human_review_always_required` |
| 2 | `jira_drafter` MUST NOT perform outbound HTTP | module has no `requests`/`httpx`/`urllib` imports | `test_jira_drafter::test_invariant_no_http_imports` |
| 3 | `JiraClient.draft()` is the only Jira touchpoint; agent NEVER calls `create_ticket` or similar | `change_agent._draft_jira()` only consults the protocol | `test_change_agent::test_invariant_never_creates_real_ticket` |
| 4 | Audit `reason` ∈ `ChangeReason` stable codes | `_audit.build_record()` | `test_change_agent::test_invariant_audit_reason_is_stable_code` |
| 5 | `differ` handles missing prior → empty delta + `missing_prior` reason | `change_agent._compute()` early return | `test_change_agent::test_missing_prior_returns_empty_delta` |
| 6 | Classifier defaults to `"material"` on ambiguous diffs (conservative) | `classifier.classify()` fallback branch | `test_classifier::test_ambiguous_defaults_to_material` |
| 7 | Audit emit failure does NOT crash the agent | `change_agent._emit()` try/except → swallow + fallback id | `test_change_agent::test_audit_emit_failure_does_not_crash` |
| 8 | Audit `meta` carries `doc_id` + `materiality` + `sections_count` only — no PII / no raw body | `_audit.build_record()` allow-list | `test_change_agent::test_audit_meta_pii_free` |

Invariant 7 deliberately diverges from SAR-Agent (which hard-fails on
audit). Rationale: the Jira draft is itself human-gated; losing one
audit row is preferable to losing the change-detection signal entirely.
The contract is **best-effort post-classification** — classification
always completes, audit emit is attempted exactly once.

## 4. Stable audit reason codes (`ChangeReason`)

```
ok              material change detected, jira draft produced
no_change       docs are identical (deduped at sha256 layer normally)
typo_only       classified as typo / whitespace / punctuation only
missing_prior   prior_doc is None — first-seen doc, no delta possible
diff_failed     differ raised (defensive; pure differ should not raise)
unknown_error   caught Exception, last-resort code
```

Free-form strings are a release-blocking violation.

## 5. Classifier rules (v0, rule-based)

Inputs: a `PolicyDelta` produced by `differ`.

| Signal | Materiality |
|---|---|
| `sections_added` or `sections_removed` non-empty | `material` |
| `sections_changed` with normalised text diff (ignoring whitespace, punctuation, case) | `typo` |
| `sections_changed` with body diff ≥ 80 chars OR ≥ 2 token-changes per section | `material` |
| `sections_changed` with body diff < 80 chars AND only 1 token-change | `clarifying` |
| Anything else / ambiguous | `material` (conservative default — see invariant 6) |

The thresholds are documented constants in `classifier.py`; M3 W11
collects real-world FinCEN deltas to tune them.

## 6. JiraDraft shape (`jira_drafter`)

```
JiraDraft {
  title:                 "[AMLIQ Brain] <source> change — <doc_id>"  (≤ 200 chars)
  body:                  markdown — change summary + sections changed/added/removed
  labels:                ["amliq-brain", "regulatory-change",
                          f"jurisdiction:{doc.jurisdiction}",
                          f"source:{doc.source}",
                          f"doc:{doc.doc_id}",
                          f"materiality:{delta.materiality}"]
  severity:              materiality → severity:
                            material   → "high"
                            clarifying → "medium"
                            typo       → "low"
  source_doc_id:         doc.doc_id
  materiality:           delta.materiality
  audit_event_id:        injected post-emit
  human_review_required: True  (always)
}
```

`draft_jira()` is a **pure** function — it does not call the `JiraClient`
at all. The orchestrator passes the draft to `JiraClient.draft()` which,
in v0, is a fake that records the draft without making HTTP calls.

## 7. Differ algorithm (v0)

1. If `prior_doc is None` → return empty delta with materiality `clarifying`
   (orchestrator overrides to `missing_prior` audit reason).
2. Split bodies into `Section`s by blank-line delimited paragraphs.
   Heading inferred from first non-blank line of the section.
3. Compute set difference on (heading, body-hash) to find added / removed.
4. For sections matched by heading whose body-hash differs → `ChangeChunk`.
5. Build `PolicyDelta`, leaving `materiality` to `classifier`.

The algorithm is intentionally simple — FinCEN RSS bodies are short
paragraphs, not multi-page PDFs. PDF-aware diffing lands when the FFIEC
fetcher arrives.

## 8. Out of scope (this skeleton)

- Real Jira REST integration (separate ticket; HTTP-capable adapter
  lives outside this package).
- Multi-jurisdiction templating (US FinCEN only in v0; EU MLD6 in M3 W11).
- Tamper-evident audit chain (the `AuditEmitter` is the seam; the TS
  audit layer owns chaining).
- Persistence of `RegulatoryUpdate` records (storage in `brain/services/api/`).
- Confidence scoring of materiality classification (placeholder logic in
  v0; M3 W11 supervised tuning).

## 9. References

- Mesh §7 (Brain Month 3 conventions): "every Python agent produces an
  output type with `human_review_required: bool` defaulting to True"
- Mesh §6 (Brain Month 2 conventions): audit-record shape
- `products/amliq/brain/corpus/src/types.ts` (ComplianceDoc shape)
- `products/amliq/brain/corpus/src/fetchers/fincen-rss.ts` (upstream)
- `products/amliq/CLAUDE.md` "Audit log requirements" (PII-free reasons)
