# Sprint 38: Adverse Media Pipeline

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G4
**Depends On**: S-35 (embedding layer for entity-article matching)
**Status**: Not Started

---

## Objective

Build an AI-powered adverse media monitoring system. Ingest news from multiple sources, classify risk with LLM, link articles to entity profiles. This is where AMLIQ's AI can genuinely surpass World-Check.

## Background

Current state:
- `GET /api/v1/media/entity/{id}` handler exists in `handler_media.go`
- `adverse_media` database table exists
- Frontend page exists at `/compliance/media`
- **But no media ingestion pipeline, no AI classification, no news feeds.**

## Tasks

### T1: News feed ingestion — GDELT Project
- [ ] GDELT Global Knowledge Graph: free, real-time, global news, updated every 15 minutes
  - URL: `http://data.gdeltproject.org/gdeltv2/lastupdate.txt`
  - Format: CSV/TSV with article URL, title, source, tone, themes, entities mentioned
- [ ] Parse GDELT export files, extract articles mentioning persons/organizations
- [ ] Filter by GDELT themes relevant to AML: CRIME, CORRUPTION, FRAUD, TERROR, SANCTIONS
- [ ] **File**: `internal/ingestion/media_gdelt.go` (new, <100 lines)
- [ ] **Test**: `internal/ingestion/media_gdelt_test.go`

### T2: News feed ingestion — NewsAPI / Google News RSS
- [ ] NewsAPI.org: structured JSON API (free tier: 100 req/day)
  - Search by keyword: entity names from watchlists
  - Filter by category: business, politics, crime
- [ ] Google News RSS: free, no API key needed
  - URL: `https://news.google.com/rss/search?q={entity_name}`
- [ ] **File**: `internal/ingestion/media_newsapi.go` (new, <80 lines)
- [ ] **File**: `internal/ingestion/media_google_news.go` (new, <80 lines)

### T3: AI risk classification
- [ ] Use LLM (configurable: GPT-4o-mini, Claude Haiku, or local model) to classify articles
- [ ] Risk categories enum:
  ```go
  type MediaRiskCategory string
  const (
      MediaRiskFraud           MediaRiskCategory = "FRAUD"
      MediaRiskCorruption      MediaRiskCategory = "CORRUPTION"
      MediaRiskMoneyLaundering MediaRiskCategory = "MONEY_LAUNDERING"
      MediaRiskTerrorFinancing MediaRiskCategory = "TERRORISM_FINANCING"
      MediaRiskSanctionsEvasion MediaRiskCategory = "SANCTIONS_EVASION"
      MediaRiskDrugTrafficking MediaRiskCategory = "DRUG_TRAFFICKING"
      MediaRiskCybercrime      MediaRiskCategory = "CYBERCRIME"
      MediaRiskTaxEvasion      MediaRiskCategory = "TAX_EVASION"
      MediaRiskHumanTrafficking MediaRiskCategory = "HUMAN_TRAFFICKING"
      MediaRiskEnvironmental   MediaRiskCategory = "ENVIRONMENTAL_CRIME"
      MediaRiskOther           MediaRiskCategory = "OTHER"
  )
  ```
- [ ] Prompt template: "Given this article, classify into risk categories. Return: categories, severity (1-10), entities mentioned, whether allegations are confirmed/alleged."
- [ ] Batch classification to minimize API calls (group 10 articles per request)
- [ ] **File**: `internal/screening/media_classifier.go` (new, <100 lines)
- [ ] **Test**: `internal/screening/media_classifier_test.go`

### T4: Entity-article matching
- [ ] Use AMLIQ's own screening engine to match entity names mentioned in articles against the entity database
- [ ] Use embedding similarity (from S-35) for fuzzy entity-article matching
- [ ] Store matches in `adverse_media` table with: entity_id, article_url, title, source, published_date, risk_categories, severity, summary
- [ ] **File**: `internal/screening/media_linker.go` (new, <80 lines)

### T5: Adverse media scoring
- [ ] Score based on:
  - Source credibility (tier 1: Reuters/AP/Bloomberg = high; tier 3: blogs = low)
  - Article recency (exponential decay, half-life 6 months)
  - Severity of allegation (from AI classification)
  - Number of independent sources covering same story
  - Confirmed vs alleged (confirmed = 2x weight)
- [ ] Aggregate score per entity across all media hits
- [ ] **File**: `internal/screening/media_scorer.go` (new, <80 lines)

### T6: Media ingestion scheduler
- [ ] Cron job: every 15 minutes, fetch GDELT updates
- [ ] Cron job: every hour, search NewsAPI for entities with active monitoring
- [ ] Process pipeline: Fetch → Extract entities → Classify with AI → Match to DB → Score → Store → Alert
- [ ] **File**: `cmd/worker/media_pipeline.go` (new, <100 lines)

### T7: Wire API and frontend
- [ ] `GET /api/v1/media/entity/{id}` — return real adverse media hits with categories, scores, sources
- [ ] Add webhook trigger: when new adverse media found for monitored entity, fire alert
- [ ] Frontend: verify `/compliance/media` page displays real data with timeline view
- [ ] **Files**: `api/handler_media.go` (modify), `web/src/pages/compliance/AdverseMedia.tsx` (verify)

## Acceptance Criteria

- [ ] System ingests news from 2+ sources (GDELT + NewsAPI/Google News)
- [ ] AI classifies articles into 10+ risk categories with severity scores
- [ ] Articles are matched to entities in the database using the screening engine
- [ ] `GET /api/v1/media/entity/{id}` returns real, structured adverse media results
- [ ] <1 hour latency from article publication to detection
- [ ] Source credibility scoring differentiates Tier 1 vs Tier 3 sources
- [ ] All existing tests pass

## Files Created/Modified

| File | Action |
|------|--------|
| `internal/ingestion/media_gdelt.go` | CREATE |
| `internal/ingestion/media_gdelt_test.go` | CREATE |
| `internal/ingestion/media_newsapi.go` | CREATE |
| `internal/ingestion/media_google_news.go` | CREATE |
| `internal/screening/media_classifier.go` | CREATE |
| `internal/screening/media_classifier_test.go` | CREATE |
| `internal/screening/media_linker.go` | CREATE |
| `internal/screening/media_scorer.go` | CREATE |
| `cmd/worker/media_pipeline.go` | CREATE |
| `api/handler_media.go` | MODIFY |
