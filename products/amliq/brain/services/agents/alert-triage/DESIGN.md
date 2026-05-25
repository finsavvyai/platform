# Alert Triage Agent — Design

Status: **design + skeleton implementation**. M3 W10 of decisive_plan_90day.md.

## 1. Purpose

Transform an `Alert` (from AMLIQ Investigate `/v1/aml/decision`, the
analyst console, or the monitor stream) into a `TriageResult` — a
priority (`p1..p4`), a category (`sanctions | structuring | kyc | fraud
| other`), an ordered reasoning chain, and a recommended-actions
checklist.

The agent is **read-only**: it classifies and recommends. Closing,
escalating, freezing, and SAR-filing remain analyst-driven actions
issued from AMLIQ Investigate.

## 2. Architecture

```
                          ┌──────────────────────┐
   Alert     ─────────►   │     TriageAgent       │
                          │  (triage_agent.py)    │
                          │                       │
                          │   ┌──────────────┐    │
                          │   │ rules.eval   │    │   pure
                          │   └──────┬───────┘    │
                          │          ▼            │
                          │   ┌──────────────┐    │   pure (sorts by weight)
                          │   │ reasoner.build│   │
                          │   └──────┬───────┘    │
                          │          ▼            │
                          │   ┌──────────────┐    │   pure (priority+category map)
                          │   │ classifier   │    │
                          │   └──────┬───────┘    │
                          │          ▼            │
                          │   ┌──────────────┐    │   ┌─────────────────┐
                          │   │ emit audit   │◄───┼──►│  AuditEmitter   │ (injected)
                          │   └──────┬───────┘    │   └─────────────────┘
                          │          ▼            │
                          │      TriageResult     │
                          └───────────────────────┘
```

`rules`, `reasoner`, `classifier` are pure modules — they take dataclass
inputs and return dataclass outputs. `triage_agent` owns the single
side-effect (audit emit) and takes the emitter as an injected protocol.

## 3. Safety invariants (release-blocking)

| # | Invariant | Where enforced | Test |
|---|---|---|---|
| 1 | `human_review_required` is always `True` in v0 | `TriageAgent.triage()` | `test_triage_agent::test_human_review_always_required` |
| 2 | Exactly one audit record emitted per `triage()` call | `TriageAgent.triage()` | `test_triage_agent::test_audit_emit_called_exactly_once` |
| 3 | Audit `reason` is a stable code from `AuditReason` | `_audit.build_record` | `test_triage_agent::test_audit_reason_is_stable_code` |
| 4 | Audit `meta` holds rule-id list + counts only — no PII | `_audit.build_record` | `test_triage_agent::test_audit_meta_pii_free` |
| 5 | Agent never closes the alert (no mutation API) | absence of code path | `test_triage_agent::test_no_close_api_exists` |
| 6 | Empty `transaction_ids` → defensive `(other, p4)`, no rules eval | `TriageAgent._compute` early return | `test_triage_agent::test_empty_alert_defensive` |
| 7 | Rule predicates never raise on missing optional fields | each rule guards on `None` | `test_rules::test_*_handles_missing_field` |
| 8 | `confidence` is clamped to `[0.0, 1.0]` | `classifier._confidence` | `test_classifier::test_confidence_clamped` |

## 4. Stable audit reason codes

```
triaged          one or more rules matched; priority + category assigned
no_match         no rule matched; routed to (other, p4)
data_missing     defensive short-circuit (empty alert)
error            uncaught path (must never happen; defence in depth)
```

The orchestrator MUST emit exactly one of these. Free-form strings are a
release-blocking violation.

## 5. Rule catalogue (v0)

| Rule ID | Trigger | Weight | Category contribution |
|---|---|---|---|
| `r_sanctions_country` | `country_to ∈ HIGH_RISK_OFAC_COUNTRIES` | 100 | sanctions |
| `r_aml_decision_block` | `decision_score >= 85` (Investigate said block) | 90 | fraud |
| `r_structuring_pattern` | `9_000_00 <= amount_minor < 10_000_00` (USD) | 70 | structuring |
| `r_cross_border_amount` | `country_from != country_to` AND `amount_minor > 25_000_00` | 50 | other |
| `r_high_risk_mcc` | `mcc ∈ HIGH_RISK_MCC` (gambling, crypto, money-transfer) | 40 | other |
| `r_aml_decision_flag` | `40 <= decision_score < 85` | 30 | other |

Placeholder constants live in `rules.py`. Real list ingestion (versioned,
signed) lands in the regulatory-change pipeline.

## 6. Priority mapping

```
priority = p1 if (r_sanctions_country matched OR r_aml_decision_block matched)
priority = p2 if (2+ rules matched and not p1)
priority = p3 if (exactly 1 rule matched and not p1)
priority = p4 otherwise (no rules matched OR data_missing)
```

## 7. Category mapping

```
category = sanctions    if any r_sanctions_* matched
category = structuring  if any r_structuring_* matched
category = fraud        if r_aml_decision_block matched (and no sanctions)
category = kyc          if subject_hash is empty/missing
category = other        otherwise
```

`sanctions` outranks `structuring` outranks `fraud` outranks `kyc` for
mutually-exclusive labelling. Determinism is required for analyst trust.

## 8. Recommended actions

Derived deterministically from the (priority, category) pair. Examples:

```
(p1, sanctions)   → ["freeze_funds", "notify_compliance_officer", "open_sar_draft"]
(p1, fraud)       → ["freeze_card", "notify_fraud_team", "open_sar_draft"]
(p2, structuring) → ["request_sof_docs", "escalate_to_compliance_officer"]
(p3, kyc)         → ["request_kyc_refresh"]
(p4, other)       → ["monitor"]
```

Full mapping table lives in `classifier.py` (`_ACTIONS_BY_PRIORITY_CATEGORY`).

## 9. Confidence (v0 formula)

```
matched_count = number of matched rules
weight_sum    = sum of weights of matched rules
confidence    = min(1.0, (matched_count * 0.15) + (weight_sum / 400.0))
                clamped to [0.0, 1.0]
```

Empty / no-match alerts get `confidence = 0.2` (low-confidence "nothing
found" rather than `0.0`, since "no match" is itself a signal).

## 10. Out of scope (this skeleton)

- Real OFAC list ingestion (M3 regulatory-change feeds the constants).
- ML-augmented prioritisation (M4 candidate).
- Cross-tenant rule packs (M3 W12 candidate).
- Auto-close / auto-escalate actions (never; analyst-only).
- Storage of `TriageResult` (lives in `brain/services/api/`).

## 11. References

- Mesh §7 (Brain Month 3 conventions) — `human_review_required` default
- Mesh §6 (Brain Month 2 conventions) — audit shape
- `products/amliq/api/decision/src/types.ts` — `AmlDecision` source
- `products/amliq/CLAUDE.md` — audit-log requirements, PII-free reasons
