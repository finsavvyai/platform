---
name: ll-insights
description: Ingest multi-source feedback via luna-rag → cluster + impact-score → emit prioritized backlog. Open-source developer-first alternative to closed product-insight tools.
homepage: https://agents.lunaos.ai
---

# LL Insights

Turns scattered data (analytics, support, feedback, research) into a ranked, impact-scored product backlog — fully open, developer-first, and integrated with LunaOS's luna-rag + graph-rag + agent chains.

## Why it exists

Closed tools (Cepien, Productboard, Dovetail) charge $649+/month for a proprietary discovery loop. `ll-insights` runs the same loop on top of open components you already have:

- **luna-rag** — vector ingest across sources
- **graph-rag** — community detection for pattern clustering
- **engine impact-scoring** — biz/product/usability/environmental weighting
- **luna chains** — multi-agent synthesis + summarization

## Pipeline

```
[sources: analytics, support, feedback]
        ↓
  [rag-ingestor]  → luna-rag vector index
        ↓
  [pattern-detector]  → graph-rag community clusters + auto-tags
        ↓
  [impact-scorer]  → biz/product/usability scores via chain output
        ↓
  [backlog-emitter]  → JSON / webhook / workflow dispatch
```

## Install

```bash
curl -X POST https://api.lunaos.ai/skills/install \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "ll-insights",
    "config": {
      "sources": ["analytics", "support", "feedback"],
      "window_days": 30,
      "min_impact_score": 70,
      "limit": 20,
      "emit_to": "workflow",
      "target_workflow_id": "wf_product_triage"
    }
  }'
```

## Environment

- `LUNAOS_API_KEY` — dashboard API key
- `LUNAOS_API_URL` — default `https://api.lunaos.ai`
- `RAG_INDEX_NAME` — default `insights`

## Config reference

| Key | Type | Default | Notes |
|---|---|---|---|
| `sources` | array | `["analytics","support","feedback"]` | Source connector names |
| `window_days` | number | 30 | Lookback window |
| `min_impact_score` | number | 70 | Filter threshold 0-100 |
| `impact_dimension` | enum | combined | business \| product \| usability \| environmental \| combined |
| `limit` | number | 20 | Backlog size cap |
| `impact_weights` | object | {0.35,0.30,0.25,0.10} | Sum ≈ 1 |
| `emit_to` | enum | json | json \| webhook \| workflow \| stdout |
| `target_workflow_id` | string | — | Required when emit_to=workflow |

## Output shape

```json
{
  "backlog": [
    {
      "id": "rec_01h...",
      "title": "Signup verification friction — remove SMS step",
      "tags": ["signup", "mobile", "onboarding"],
      "impact": { "business": 78, "product": 82, "usability": 91, "combined": 83 },
      "effortHours": 24,
      "roi": 3.46,
      "evidence": ["support_tickets: 142", "drop_off: 37%", "churn_cohort: new-mobile"]
    }
  ],
  "summary": {
    "ingested": 8421,
    "clustered": 147,
    "scored": 147,
    "emitted": 20
  }
}
```

## Example: Weekly cadence workflow

```
[Schedule: 0 9 * * 1]
   ↓
[ll-insights: window=7d, limit=10, dim=combined]
   ↓
[Dispatch top-3 to LunaOS workflow: wf_pr_draft]
   ↓
[Slack: digest remaining 7 to #product]
```

## Competitive comparison

| Capability | Cepien | ll-insights |
|---|---|---|
| Ingestion sources | 300+ (claim) | Pluggable via luna-rag connectors |
| Impact scoring | proprietary | **Open** (engine `impact-scoring.ts`) |
| Clustering | opaque | **graph-rag** community detection |
| Execution | closed API | **LunaOS workflows** (visual + CLI + mobile) |
| Price entry | $649/mo | **$29 Pro** (or self-host free) |
| Source availability | closed | **MIT** |

## Related

- `cepien-insight` — bridge to Cepien's platform as upstream
- `luna-rag-search` — direct search over ingested data
- `luna-code-review` — review code generated from recommendations

## Roadmap

- [ ] Ship connectors: Mixpanel, Amplitude, PostHog, Intercom, Zendesk, GitHub Issues
- [ ] Visual Studio node: "LL Insights: Top Backlog"
- [ ] Per-persona impact breakdown (match Cepien multidim tagging)
- [ ] CSV export for PM review
