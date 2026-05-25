# `services/agents/` — Python agent layer (placeholder, M2 W6)

This directory will host the AMLIQ Brain agent runtime in Python. **No
code lands here yet.** The first agent (SAR Draft) is scheduled for
**Month 2 Week 6** of the decisive 90-day plan.

## Planned agents

| Agent | Decisive-plan milestone | Trigger | Output |
|---|---|---|---|
| **SAR Draft Agent** | M2 W6-8 | alert from `api/v1/aml/decision` `decision="review"\|"block"` | filled FinCEN SAR template + evidence pack + human-review UI link |
| **Regulatory Change Agent** | M3 W9 | FinCEN / FFIEC corpus refresh | policy-delta diff + draft Jira ticket |
| **Alert Triage Agent** | M3 W10 | new alert in the case queue | pre-classification + reasoning chain + recommended action |

All three agents consume:

- **Retrieval** via the TS shim in `services/retrieval/` (RetrievalAdapter contract → `oss/finsavvy-rag/`).
- **Inference** via the `InferenceProvider` contract owned by the CLUSTER-BRIDGE subtree (`brain/inference/src/types.ts`, re-exported from `brain/inference/src/index.ts`). Cluster runs separately, no in-process import.
- **Audit emit** via the brain API: every agent action posts a structured record back through `services/api/` so the tamper-evident chain stays unbroken.

## Why Python

The agent layer needs the Python ecosystem for:

- prompt orchestration (LangGraph / DSPy / pydantic-ai — decision pending in M2 W5 ADR)
- pandas/numpy for transaction-feature preprocessing inside the SAR Draft pipeline
- direct OFAC SDN list parsing (existing Python tooling under `02_AI_AGENTS/`)

## Folder layout (when populated)

```
services/agents/
├── pyproject.toml
├── README.md                  ← this file
├── inference_client.py        ← thin HTTP client implementing InferenceProvider
├── sar_draft/
│   ├── agent.py
│   ├── templates/
│   └── tests/
├── regulatory_change/
└── alert_triage/
```

Files will obey the portfolio 200-line cap (Python module-level) and the
100% coverage rule on the audit-emit critical path.

## Status today (W2)

Placeholder only. The TS layer (`services/api/`, `services/retrieval/`,
`services/sanctions/`) is being scaffolded in parallel and defines the
contracts these agents will integrate against.
