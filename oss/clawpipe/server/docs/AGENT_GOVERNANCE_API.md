# Agent Governance API

FinSavvyAI now includes a governance endpoint that combines:

- Policy-to-code evaluation
- Live safety scoring
- Final execution status (`approved`, `approval_required`, `denied`)

## Endpoint

- `POST /v1/agent/decision`
- Unversioned alias: `POST /agent/decision`

## Request

```json
{
  "action": "deploy",
  "resource": "env/prod",
  "policy_text": "require_approval deploy env/prod",
  "default_effect": "deny",
  "context": {
    "data_sensitivity": "confidential",
    "blast_radius": "large",
    "autonomy_level": "autonomous",
    "actor_trust": 0.8,
    "model_confidence": 0.9
  }
}
```

You can also provide structured policy rules:

```json
{
  "action": "delete",
  "resource": "repo/main",
  "policy_rules": [
    {"id": "r1", "effect": "deny", "action": "delete", "resource": "repo/main"},
    {"id": "r2", "effect": "allow", "action": "read", "resource": "repo/*"}
  ],
  "default_effect": "deny"
}
```

## Response

```json
{
  "request_id": "req_123",
  "action": "deploy",
  "resource": "env/prod",
  "execution_status": "approval_required",
  "executable_now": false,
  "approval_required": true,
  "policy": {
    "decision": {
      "allowed": true,
      "requires_approval": true,
      "effect": "require_approval",
      "matched_rule_id": "rule-1",
      "reason": "Matched line 1"
    },
    "default_effect": "deny",
    "rules_count": 1,
    "compile_errors": []
  },
  "safety": {
    "safety_score": 42,
    "risk_score": 58,
    "risk_level": "high_risk",
    "requires_human_approval": true
  }
}
```

## Decision Semantics

- `approved`: policy allows action and safety does not require approval
- `approval_required`: policy or safety requires human approval
- `denied`: policy denies action

## OpenHands Auto-Gating

When `backend="openhands"` is used on `/v1/chat/completions`, FinSavvyAI automatically
evaluates governance before executing the request:

- Policy deny -> HTTP `403`
- Approval required -> HTTP `202`
- Approved -> request executes and governance metadata is attached to the response

## Basic Smoke Test

```bash
curl -X POST http://localhost:8080/v1/agent/decision \
  -H "Content-Type: application/json" \
  -d '{
    "action": "read",
    "resource": "docs/readme.md",
    "policy_text": "allow read docs/*",
    "context": {
      "data_sensitivity": "public",
      "blast_radius": "tiny",
      "autonomy_level": "manual",
      "actor_trust": 0.95
    }
  }'
```
