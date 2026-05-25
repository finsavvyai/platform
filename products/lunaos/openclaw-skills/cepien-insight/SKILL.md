---
name: cepien-insight
description: Pull top-impact product recommendations from Cepien AI and execute them as LunaOS workflows — bridges Cepien's discovery layer to LunaOS's agent execution layer.
homepage: https://agents.lunaos.ai
---

# Cepien Insight

Connects [Cepien AI](https://cepien.ai) (product discovery + agentic recommendations) to LunaOS workflows. Cepien unifies feedback/analytics/research, scores impact, and outputs recommendations. This skill pulls those recommendations, filters by impact score, and triggers LunaOS workflows for execution — making LunaOS the execution backbone for Cepien's agentic workforce.

## How it works

```
[Cepien Discovery]  →  [cepien-insight skill]  →  [LunaOS Workflow]
  feedback + data         fetch + filter             execute + observe
  impact scores           by threshold               webhook / Jira / code
```

## When to use

- Cepien generates a recommendation ("refactor onboarding flow, impact=85") → trigger a LunaOS workflow to draft the PR, run tests, post to Slack
- Auto-triage Cepien findings daily: top-N high-impact only, ignore noise
- Close the loop: Cepien outputs → LunaOS runs → audit log back to Cepien

## Install

```bash
curl -X POST https://api.lunaos.ai/skills/install \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "cepien-insight",
    "config": {
      "project_id": "cepien_prj_abc",
      "min_impact_score": 75,
      "destination": "workflow",
      "target_workflow_id": "wf_pr_draft",
      "auto_trigger": false
    }
  }'
```

## Environment

- `CEPIEN_API_KEY` — from platform.cepien.ai → Settings → API
- `CEPIEN_API_URL` — defaults to `https://platform.cepien.ai/api/v1`
- `LUNAOS_API_KEY` — from agents.lunaos.ai dashboard

> **Note:** Cepien's public API surface is not yet documented at time of writing. This skill targets a plausible REST schema (`GET /insights`, `GET /recommendations/:id`) and should be updated when Cepien publishes their spec. Until then, run in dry-run mode (`auto_trigger=false`) and validate payloads.

## Config reference

| Key | Type | Default | Purpose |
|---|---|---|---|
| `project_id` | string | — | Cepien project to pull from |
| `min_impact_score` | number | 70 | Threshold 0-100 |
| `impact_dimension` | enum | combined | business \| product \| usability \| combined |
| `limit` | number | 5 | Max recommendations per run |
| `destination` | enum | workflow | workflow \| webhook \| jira \| notion \| slack |
| `target_workflow_id` | string | — | LunaOS workflow to trigger |
| `auto_trigger` | boolean | false | Fire workflow without manual approval |

## Output shape

```json
{
  "recommendations": [
    {
      "id": "rec_01h...",
      "title": "Reduce signup friction: remove email verification step",
      "impact": { "business": 82, "product": 79, "usability": 91, "combined": 84 },
      "evidence": ["support_ticket_count=142", "drop_off_rate=37%"],
      "proposed_actions": ["draft PRD", "A/B test verification removal"]
    }
  ],
  "dispatched_runs": ["run_abc123"],
  "summary": { "fetched": 12, "filtered": 3, "dispatched": 1, "skipped": 2 }
}
```

## Example workflow: Daily Cepien triage

```
[Schedule: 0 9 * * 1-5]
     ↓
[cepien-insight: pull top-5 impact>=75]
     ↓
[If-Else: impact >= 90?]
     ├── yes → [workflow: auto-draft PR + notify team]
     └── no  → [Slack: post to #product-triage for review]
```

## Related

- `luna-code-review` — review PRs generated from Cepien recommendations
- `luna-requirements-analyzer` — expand a Cepien recommendation into full PRD
- `scheduled-pipeline-scan` — same scheduling pattern, different data source

## Roadmap

- [ ] Replace inferred REST schema with official Cepien API when published
- [ ] Add Cepien webhook receiver (push model) for real-time triage
- [ ] Two-way sync: post LunaOS run outcomes back to Cepien audit log
- [ ] Co-launch blog: "Cepien + LunaOS: discovery-to-execution in under 5 minutes"

## Support

- Issues: OpenClaw skills repo
- Partnership: open an issue tagged `partner:cepien`
