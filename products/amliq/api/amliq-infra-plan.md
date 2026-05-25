# amliq.finance — Infrastructure & Cost Plan

> **Status:** Pre-revenue. Every decision here is optimised for zero waste until the first paying customer.
> The Future Plan section is locked and ready to activate as ARR grows.

---

## Current stage: pre-revenue lean stack

### Goal

Keep the full screening pipeline functional and shippable for under **$12/month**.
No compromises on correctness — the phonetic hashing and fuzzy scoring strategy stays intact.
What changes is *where* the heavy work runs.

### The trade-off at this stage

Elasticsearch is the right long-term answer but costs ~$30–200/month even at minimum.
Before paying customers, PostgreSQL with `pg_trgm` + `tsvector` + in-process Go scoring
covers the same ground for a sanctions dataset of this size (~500K records after alias explosion).
The switch to Elasticsearch is a single Go client swap — the normalisation, phonetic, and scoring
packages do not change at all.

---

### Stack — pre-revenue

| Layer | Service | Plan | Monthly cost |
|---|---|---|---|
| Edge + cache | Cloudflare Workers + KV + R2 + Queues | **Free** (100K req/day) | $0 |
| Go screening service | Render Web Service | **Starter** (512 MB RAM, 0.5 CPU) | $7 |
| Go ingest worker | Render Cron Job | **Free** (Render free cron) | $0 |
| Search + source of truth | Neon PostgreSQL | **Free** (0.5 GB, 1 branch) | $0 |
| List file storage | Cloudflare R2 | **Free** (10 GB included) | $0 |
| **Total** | | | **$7/month** |

> The Render Starter instance stays always-on (no sleep). That is the only paid line item.

---

### What runs where at this stage

```
Client request
    ↓
Cloudflare Worker (Free tier — 100K req/day)
  → normalize name
  → KV exact match check     (free, included)
  → KV negative cache check  (free, included)
    ↓ miss
Go on Render Starter ($7/month)
  → phonetic codes (matchr — in-process, free)
  → Jaro-Winkler scoring (go-edlib — in-process, free)
  → PostgreSQL full-text + trigram query (Neon free)
    ↓
Score + result returned
```

**PostgreSQL replaces Elasticsearch at this stage.**
The GIN + pg_trgm indexes handle fuzzy name matching well enough for
pre-revenue validation. Latency is ~20–80ms vs ~5–30ms for ES — acceptable
when you are demoing to prospects, not processing live transactions.

### Neon PostgreSQL — free tier limits

- 0.5 GB storage — comfortably holds the full OFAC + UN + EU + HMT dataset with aliases
- 1 compute branch — enough for one environment
- Auto-suspend after 5 min inactivity — fine for pre-revenue, wake time ~500ms

When Neon free hits a limit: upgrade to Neon Launch ($19/month) before touching Render tiers.

### Cloudflare free tier limits

- 100,000 Worker requests per day (~3M/month)
- 10M KV reads/month, 1M KV writes/month
- 10 GB R2 storage

At pre-revenue volumes this is essentially unlimited. The free tier only becomes a
constraint above ~3M screens/month, at which point you have paying customers anyway.

---

### What you are NOT running yet

| Skipped for now | Reason | Activated when |
|---|---|---|
| Elasticsearch | ~$30–200/month for idle cluster | First paying customer |
| Render Standard instance | $25/month — overkill for demo load | >50K screens/month |
| Render Pro instance | $80/month | >300K screens/month |
| Multiple Render services | Not needed below 100K screens/month | Growth stage |
| Cloudflare Paid plan ($5) | Free tier sufficient pre-revenue | First paying customer |

---

## Future plan — revenue stages

### When to move

| Trigger | Action |
|---|---|
| First paying customer | Upgrade CF to Paid ($5). Activate Elasticsearch (Standard, 1 node). |
| $1K MRR | Upgrade Render to Standard ($25). Move PG to Render Standard ($20). |
| $5K MRR | Upgrade ES to 2-node HA. Upgrade Render to Pro. |
| $20K MRR | Multi-region CF routing. Dedicated ingest worker. PG read replicas. |

---

### Stage 1 — first paying customer (~3K screens/month)

| Layer | Service | Plan | Monthly cost |
|---|---|---|---|
| Edge | Cloudflare Workers + KV + R2 + Queues | Paid (base) | $5 |
| Go screening | Render | Standard (2 GB, 1 CPU) | $25 |
| Go ingest worker | Render | Starter | $7 |
| Search (Elasticsearch) | Elastic Cloud | Standard, 1 node, 1 GB | ~$30 |
| Source of truth | Render PostgreSQL | Starter (1 GB) | $7 |
| **Total** | | | **~$74/month** |

**What changes from the lean stack:**

- Elasticsearch replaces PostgreSQL as the search layer. Swap the Go `search` package
  client from `pgx` to `go-elasticsearch/v8`. No other code changes.
- Cloudflare Paid unlocks higher KV write throughput for ingest pipeline.
- Render Standard eliminates the 512 MB memory ceiling that throttles phonetic
  batch processing on large lists.

---

### Stage 2 — growth (~300K screens/month, ~$5K MRR)

| Layer | Service | Plan | Monthly cost |
|---|---|---|---|
| Edge | Cloudflare (all within included limits) | Paid | $5 |
| Go screening | Render | Pro (4 GB, 2 CPU) | $80 |
| Go ingest worker | Render | Standard | $25 |
| Elasticsearch | Elastic Cloud | Standard, 2 GB, 1 zone | ~$65 |
| PostgreSQL | Render | Standard (8 GB) | $20 |
| **Total** | | | **~$195/month** |

At this volume, the Cloudflare KV cache absorbs ~70% of requests.
Only ~90K queries/month reach Render + Elasticsearch.
The $195 covers infrastructure for a product generating ~$60K ARR.

---

### Stage 3 — scale (~1M screens/month, ~$20K+ MRR)

| Layer | Service | Plan | Monthly cost |
|---|---|---|---|
| Edge | Cloudflare (1M req — within 10M included) | Paid | $5 |
| KV reads: ~2M (within 10M included) | — | Paid base | $0 |
| Go screening | Render | Pro (4 GB, 2 CPU) | $80 |
| Go ingest worker | Render | Standard | $25 |
| Elasticsearch | Elastic Cloud | Standard, 2-node HA, 4 GB | ~$200 |
| PostgreSQL | Render | Standard | $20 |
| **Total** | | | **~$330/month** |

Infrastructure at this stage is ~1.6% of MRR. Healthy ratio for a B2B SaaS.

---

### Cost optimisation options at scale

**Self-host OpenSearch on Render instead of Elastic Cloud**

Replace the $200/month Elastic Cloud 2-node cluster with OpenSearch running on
a Render Pro instance ($80/month). The `go-elasticsearch/v8` client is compatible
with OpenSearch — the change is a single base URL config swap.

Saves ~$120/month at Stage 3. Trade-off: you own snapshot backups and version upgrades.

```
Stage 3 with self-hosted OpenSearch: ~$210/month instead of $330/month
```

**Cloudflare Workers KV write cost during list updates**

OFAC updates (~500K entity+alias records × 3 phonetic codes) = ~1.5M KV writes per update.
Above the 1M free tier: ~$2.50 per list update event.
OFAC publishes roughly 3–4 updates/month → ~$10/month extra at Stage 2+.
Budget this as a line item from Stage 2 onward.

---

## Summary

| Stage | When | Monthly cost |
|---|---|---|
| **Pre-revenue (now)** | No paying customers | **$7** |
| Stage 1 | First customer | ~$74 |
| Stage 2 | ~$5K MRR | ~$195 |
| Stage 3 | ~$20K MRR | ~$330 |
| Stage 3 (self-hosted ES) | ~$20K MRR | ~$210 |

The architecture is identical across all stages. The code does not change.
Only the hosting tier and the search backend client swap (PG → ES) differ.
Every component is independently upgradeable without downtime.

---

## Migration path: PostgreSQL → Elasticsearch

When the time comes, this is the only code change required:

```go
// internal/search/client.go

// Pre-revenue: PostgreSQL backend
type SearchClient struct {
    db *pgx.Pool  // swap this
}

// Stage 1+: Elasticsearch backend
type SearchClient struct {
    es *elasticsearch.Client  // for this
}

// The Query(), Score(), and Normalize() packages stay unchanged.
// Only the transport layer swaps.
```

Add the ES index mapping (defined in the architecture doc) and run a one-time
bulk ingest from PostgreSQL. The Cloudflare KV cache does not change at all —
it is backend-agnostic.

---

*Last updated: April 2026 — amliq.finance internal infrastructure plan*
