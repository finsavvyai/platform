# AMLIQ Public-Demo Screening Fixtures

Development-only JSON fixtures that drive the `POST /api/v1/screen/public-demo`
endpoint and its Go integration tests under
`internal/screening/publicdemo/`.

## Purpose

These fixtures give the public-demo handler a small, deterministic corpus
so the engine cascade (Exact, Fuzzy, Phonetic, Token, Embedding) and the
PEP enrichment path can be exercised end-to-end without network access,
without proprietary upstream feeds, and without leaking real customer
data into the test surface.

The fixtures are loaded once at handler startup by
`publicdemo.LoadFixtures` (see `internal/screening/publicdemo/fixtures.go`)
and cached for the process lifetime.

## Public-source attribution

All sanctions entries are derived from publicly published government
designation lists. Names and aliases were copied from the open
sources below and trimmed to a small sample suitable for local testing.

| File | Public source |
|---|---|
| `lists/ofac.json` | US Department of the Treasury — Office of Foreign Assets Control (OFAC) Specially Designated Nationals (SDN) list |
| `lists/eu_fsf.json` | European Union — Consolidated Financial Sanctions List (FSF) |
| `lists/un.json` | United Nations Security Council — Consolidated Sanctions List |
| `lists/uk_ofsi.json` | UK HM Treasury — Office of Financial Sanctions Implementation (OFSI) Consolidated List |
| `lists/pep-sample.json` | Politically Exposed Persons — curated from public government roster pages (heads of state and heads of government) |

No private feed, vendor list, or paid dataset is included.

## Inventory

| File | List ID | Entries | Coverage |
|---|---|---|---|
| `lists/ofac.json` | `ofac` | 8 | RU sanctions (Putin, Lavrov, Sberbank, VTB), DPRK (Kim), IR (Bank Sepah), SY (Assad), VE (Maduro) |
| `lists/eu_fsf.json` | `eu_fsf` | 5 | RU sanctions (Putin, Shoigu, Sberbank), IR (Bank Sepah), BY (Lukashenko) |
| `lists/un.json` | `un` | 4 | DPRK (Kim), Taliban (Akhundzada), Al-Qaida, ISIL/ISIS |
| `lists/uk_ofsi.json` | `uk_ofsi` | 4 | RU sanctions (Putin, Abramovich, Sberbank, VTB) |
| `lists/pep-sample.json` | `pep` | 5 | Heads of state / government: Putin (RU), Erdogan (TR), Netanyahu (IL), Xi (CN), Modi (IN) |
| `queries/test-queries.json` | n/a | 28 queries | Drives `TestPublicDemo_AllFixtureQueries` |

All entries share the same compact shape:

```json
{
  "entity_id": "<list>_<name>_<seq>",
  "type": "Individual" | "Company",
  "primary_name": "...",
  "aliases": ["..."],
  "country": "ISO-3166 alpha-2 or ZZ"
}
```

PEP entries add `position` and `tier` (`head_of_state` /
`head_of_government`).

Each list file also carries top-level `list_id`, `name`, `version`
(`2026-05-01`), and `source` metadata.

## How the Go integration tests load these fixtures

`internal/screening/publicdemo/fixtures.go` declares the canonical set:

```go
sanctionsListFiles = []string{
    "ofac.json", "eu_fsf.json", "un.json", "uk_ofsi.json",
}
pepFile = "pep-sample.json"
```

The test helper (`handler_test.go::fixturesRoot`) resolves this directory
relative to the repo root, then calls `LoadFixtures(root)` to build an
in-memory `FixtureSet`. Missing files are a load error — partial loads are
never returned.

`queries_test.go::TestPublicDemo_AllFixtureQueries` reads
`queries/test-queries.json`, fails if fewer than 28 queries are present,
and runs each one through `POST /api/v1/screen/public-demo` via
`httptest`. Each response is asserted by `expectations_test.go`:

- `min_matches` / `max_matches` — bounds on the match count.
- `min_top_confidence` / `max_top_confidence` — top-match confidence with
  a ±0.05 tolerance.
- `risk_level` / `risk_level_in` — exact or set membership on the bucket.
- `list_ids` — every named list MUST appear among the match sources
  (case-insensitive).
- `layers_present` — every named layer MUST appear in at least one
  match's `layers` array.
- `pep_status_required` + `pep_position_contains` — at least one match's
  `PEPStatus.Status != "none"` and the position string contains the
  expected substring.

What the tests do NOT enforce: ordering of matches, exact confidence
values, exact alias chosen, or any field beyond those listed.

## Layer coverage matrix

The `layers_present` field in each query block declares which engine
layers the integration test will require for that query. Coverage across
the 28 queries:

| Layer | Required by queries | Notes |
|---|---|---|
| Exact | Q1, Q3, Q4, Q5, Q7 | Full-name string equality with a list primary name or alias |
| Fuzzy | Q1, Q2, Q3, Q4, Q5, Q7 | Edit-distance / token-sort scoring; tolerates typos and order |
| Phonetic | Q1, Q2, Q4, Q5, Q7, Q21, Q22, Q23 | Soundex / Metaphone family; tolerates transliteration drift |
| Token | Q1, Q3, Q4, Q7 | Token-set / token-sort; tolerates re-ordering and noise tokens |
| Embedding | Q21, Q22, Q23, Q25, Q26, Q27, Q28 | Character-trigram cosine via `screening.InMemoryEmbeddingMatcher`. Wired into the public-demo engine via `screening.WithEmbeddingMatcher`; populated per-request with `SetCandidates`. Catches transliteration drift (Kim Jung-un, Bashar al-Asad, Volodymyr Putin) and binds Cyrillic / Arabic queries to their Latin equivalents after `expandQuery` normalisation. Production keeps the pgvector path (`PgvectorMatcher`) — the in-memory matcher is the offline/demo equivalent. |
| PEP enrichment | Q10, Q11, Q12, Q13 | `pep_status_required: true` forces a PEP-positive match |

Negative-control queries (Q14 "John Smith", Q15 "Acme Corp Ltd", Q19
high-threshold Vladimir Putin, Q24 "Pootin" with threshold 0.75) assert
that the engine does NOT escalate to `high` risk and stays within bounded
confidence; they cover the false-positive guard rail rather than a
specific layer.

Non-Latin query handling (Q25 Cyrillic Putin, Q26 Arabic Assad, Q27
Cyrillic Lavrov, Q28 transliteration variant) is driven by
`internal/screening/publicdemo/normalise_query.go::expandQuery`, which
runs the request name through the existing `screening.NormalizeCyrillic`
/ `NormalizeArabic` / `TransliterateArabic` helpers and feeds each
variant into the engine cascade; results are deduped by entity with
`mergeMatches` keeping max(confidence) per entity and unioning layers.

## Caveats

- These files are sized for unit / integration speed, not coverage of the
  real designation universe. Real OFAC SDN alone is tens of thousands of
  records.
- Versions are static (`2026-05-01`) and not refreshed.
- Aliases are a minimal hand-picked sample, not the full alias graph
  carried by the upstream lists.
- The `pep-sample.json` tier and position strings are illustrative; they
  do not constitute legal PEP designation.

## Production data path (not this directory)

Production uses signed, version-pinned upstream feeds (OFAC SDN, EU FSF,
UN Consolidated, UK OFSI) loaded via the ingestion pipeline under
`internal/ingestion/`, persisted in PostgreSQL, and snapshot-pinned per
release. The handler at `/api/v1/screen/public-demo` is intentionally
isolated from that path and serves these JSON fixtures only.

Do not ship anything from `samples/screen/` to production tenants.
