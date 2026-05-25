# SAR Draft Agent — Design

Status: **design + skeleton implementation**. M2 W6 of decisive_plan_90day.md.

## 1. Purpose

Transform `AlertInput` (from AMLIQ Investigate `/v1/aml/decision`) into a
`SarDraft` — a populated US FinCEN SAR template with citations, confidence,
and an audit-traceable provenance record.

The agent is a **skeleton**: the template bodies are placeholder content;
real FinCEN narrative content lands in M3 alongside the regulatory-change
agent. What this design locks in is the **substitution mechanism, the
safety invariants, and the contracts** the rest of the platform integrates
against.

## 2. Architecture

```
                          ┌──────────────────────┐
   AlertInput  ─────────► │     DraftAgent       │
                          │  (draft_agent.py)    │
                          │                      │
                          │   ┌──────────────┐   │
                          │   │ pick_template│   │
                          │   └──────┬───────┘   │
                          │          ▼           │
                          │   ┌──────────────┐   │   ┌─────────────────┐
                          │   │  retrieve    │◄──┼──►│ RetrievalAdapter│ (injected)
                          │   └──────┬───────┘   │   └─────────────────┘
                          │          ▼           │
                          │   ┌──────────────┐   │
                          │   │ context_fill │   │   (jinja2 autoescape=True)
                          │   └──────┬───────┘   │
                          │          ▼           │
                          │   ┌──────────────┐   │
                          │   │  build draft │   │
                          │   └──────┬───────┘   │
                          │          ▼           │
                          │   ┌──────────────┐   │   ┌─────────────────┐
                          │   │ emit audit   │◄──┼──►│  AuditEmitter   │ (injected)
                          │   └──────┬───────┘   │   └─────────────────┘
                          │          ▼           │
                          │       SarDraft       │
                          └──────────────────────┘
```

Pure functions where possible (`context_fill`, `template_registry`). The
orchestrator (`draft_agent`) owns side-effects (retrieval, audit emit) and
takes both as injected protocols — no concrete dependency on transport.

## 3. Safety invariants (release-blocking)

| # | Invariant | Where enforced | Test |
|---|---|---|---|
| 1 | `human_review_required` is always `True` in v0 | `DraftAgent.draft()` | `test_draft_agent::test_human_review_always_required` |
| 2 | Exactly one audit record emitted per `draft()` call (success or failure) | `DraftAgent.draft()` try/finally + early-return paths | `test_draft_agent::test_audit_emit_called_exactly_once` |
| 3 | Audit `reason` is a stable code, never raw alert content | `_safe_reason()` allow-list | `test_draft_agent::test_audit_reason_pii_free` |
| 4 | Audit `meta` carries `template_id` + `confidence` only — no PII | `_audit_meta()` builder | `test_draft_agent::test_audit_meta_pii_free` |
| 5 | Jinja2 `autoescape=True` on every render | `context_fill.render()` env factory | `test_context_fill::test_html_input_is_escaped` |
| 6 | Template variable missing → raise; no silent default | `StrictUndefined` in jinja env | `test_context_fill::test_missing_var_raises` |
| 7 | `|safe` in templates is forbidden in v0 | template lint in `template_registry.load_all()` | `test_template_registry::test_no_safe_filter_in_templates` |
| 8 | PII fields in audit records are redacted at the boundary | `_redact()` pattern match | `test_draft_agent::test_pii_pattern_redacted` |

## 4. Stable audit reason codes

```
ok                  draft generated successfully
missing_template    no template matched the alert type
retrieval_failed    RetrievalAdapter raised
render_failed       jinja2 raised on substitution
unknown_error       caught Exception, last-resort code
```

The orchestrator MUST emit exactly one of these. Free-form strings are a
release-blocking violation.

## 5. Template format

Each template is a `.j2` file plus an entry in `_index.yaml`:

```yaml
templates:
  - id: structuring
    file: structuring.j2
    title: FinCEN SAR — Structuring (31 CFR 1020.320)
    required_vars: [alert_id, subject_identifier, transaction_summary, jurisdiction]
    matches_alert_types: [structuring]
```

`required_vars` is enforced by `context_fill`: a missing var raises rather
than silently rendering an empty string. This is critical — a SAR with a
blank "Subject" field is regulatorily defective.

## 6. Confidence (placeholder formula, v0)

```
confidence = 1.0 if (all required vars filled AND len(citations) >= 3)
             else 0.6 if (all required vars filled)
             else 0.3
```

Real confidence modelling lands in M3 once the regulatory-change agent
provides ground-truth feedback. The placeholder is documented so analysts
do not over-trust it.

## 7. Out of scope (this skeleton)

- Real FinCEN narrative content (M3).
- Submission to FinCEN BSA E-Filing (never auto-filed; UI sign-off required).
- Persistence of `SarDraft` records (storage lives in `brain/services/api/`).
- Tamper-evident chain integration (`AuditEmitter` is the seam; chain
  implementation is in the TS audit layer).
- Multi-jurisdiction templates (US FinCEN only in v0; EU MLD6 in M3).

## 8. References

- Mesh §4 `SarDraft` (Brain Month 2 conventions)
- `products/amliq/api/decision.md` §7 (audit-log shape)
- `products/amliq/CLAUDE.md` "Audit log requirements"
- `oss/finsavvy-rag/src/types/compliance-doc.ts` (citation source docs)
