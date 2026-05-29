# AMLIQ Public-Demo Smoke Plan

Manual + CI smoke coverage for `POST /api/v1/screen/public-demo`, driven
by the 28 queries in `queries/test-queries.json`. Mirrors the layer-
coverage table in [`README.md`](./README.md).

## Pre-conditions

- AMLIQ API running locally on `http://localhost:8080` (`go run
  ./cmd/api/main.go` from `products/amliq/api/`).
- Fixtures resolvable from the API's working directory. The handler
  auto-loads `samples/screen/lists/*.json` and `samples/screen/queries/
  test-queries.json` on the first request via
  `publicdemo.LoadDefault()` (see `internal/screening/publicdemo/
  fixtures.go`). No manual seeding step.
- `jq` available locally for readable JSON output (optional but assumed
  below).
- For the skill-based section: the `/screen` skill is registered (see
  `api/.claude/skills/screen/skill.md`) and points at the same
  `localhost:8080` URL.

## Response shape (all scenarios)

The handler returns:

```json
{
  "query": "<input name>",
  "matches": [
    {
      "entity_id": "...",
      "entity_name": "...",
      "lists": ["ofac", "eu_fsf", ...],
      "confidence": 0.0..1.0,
      "layers": [{ "layer": "Exact|Fuzzy|Phonetic|Token|Embedding",
                   "score": 0.0..1.0, "algorithm": "..." }],
      "pepStatus": { "status": "none|pep", "position": "...", "tier": "..." }
    }
  ],
  "riskLevel": "clear|low|medium|high",
  "latencyMs": <int>,
  "screenedAt": "<RFC3339>"
}
```

Every scenario asserts a subset of `matches[]`, `riskLevel`, and (for
PEP queries) `matches[].pepStatus`. Field-level rules come from
`internal/screening/publicdemo/expectations_test.go`.

## Layer coverage matrix

| Layer | Queries that require it |
|---|---|
| Exact | Q1, Q3, Q4, Q5, Q7 |
| Fuzzy | Q1, Q2, Q3, Q4, Q5, Q7 |
| Phonetic | Q1, Q2, Q4, Q5, Q7, Q21, Q22, Q23 |
| Token | Q1, Q3, Q4, Q7 |
| Embedding | Q21, Q22, Q23, Q25, Q26, Q27, Q28 (in-memory trigram-cosine matcher wired via `screening.WithEmbeddingMatcher`; Q24 is the threshold negative — no embedding bind survives) |
| PEP enrichment | Q10, Q11, Q12, Q13 |

Negative-control queries (Q14, Q15, Q19, Q24) verify that the engine
does NOT escalate to `high` for unrelated names, near-miss phonetic
spellings, or at an exclusionary threshold.

## Manual run

Run each scenario with `curl`. All scenarios share the same shape:

```bash
curl -X POST localhost:8080/api/v1/screen/public-demo \
  -H 'Content-Type: application/json' -d '<payload>'
```

Substitute the per-scenario payload below.

### Q1 — Vladimir Putin (multi-list high-risk baseline)
Payload: `{"name":"Vladimir Putin"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.80 (±0.05), sources
include `ofac`, `eu_fsf`, `uk_ofsi`; layers cover Exact, Fuzzy,
Phonetic, Token.

### Q2 — Vladmir Putin (typo, fuzzy + phonetic)
Payload: `{"name":"Vladmir Putin"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.85, source includes
`ofac`; layers cover Fuzzy and Phonetic.

### Q3 — Sberbank of Russia (list filter, Exact/Fuzzy/Token)
Payload: `{"name":"Sberbank of Russia","lists":["ofac","eu_fsf"]}`
Pass: `riskLevel` in {`medium`,`high`}, top confidence ≥ 0.80,
sources include `ofac` and `eu_fsf`; layers cover Exact, Fuzzy, Token.

### Q4 — Kim Jong-un (OFAC + UN, all four layers)
Payload: `{"name":"Kim Jong-un"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.90, sources include
`ofac` and `un`; layers cover Exact, Fuzzy, Phonetic, Token.

### Q5 — Sergei Lavrov (transliteration variant)
Payload: `{"name":"Sergei Lavrov"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.85, source includes
`ofac`; layers cover Exact, Fuzzy, Phonetic.

### Q6 — Bashar Assad (alias without `al-` prefix)
Payload: `{"name":"Bashar Assad"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.85, source includes
`ofac`. No layer pin.

### Q7 — Bank Sepah (org, all four layers, OFAC-only filter)
Payload: `{"name":"Bank Sepah","lists":["ofac"]}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.90, source includes
`ofac`; layers cover Exact, Fuzzy, Phonetic, Token.

### Q8 — VTB (short alias, two-list filter)
Payload: `{"name":"VTB","lists":["ofac","uk_ofsi"]}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.80, sources include
`ofac` and `uk_ofsi`.

### Q9 — Roman Abramovich (UK-only)
Payload: `{"name":"Roman Abramovich","lists":["uk_ofsi"]}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.85, source includes
`uk_ofsi`.

### Q10 — Recep Tayyip Erdogan (PEP, must NOT escalate)
Payload: `{"name":"Recep Tayyip Erdogan","pep":true}`
Pass: `riskLevel` in {`clear`,`low`}, top confidence ≤ 0.80, at least
one match has `pepStatus.status != "none"` and `pepStatus.position`
contains "President".

### Q11 — Benjamin Netanyahu (PEP, Prime Minister)
Payload: `{"name":"Benjamin Netanyahu","pep":true}`
Pass: `riskLevel` in {`clear`,`low`}, top confidence ≤ 0.80, PEP
match with `pepStatus.position` containing "Prime Minister".

### Q12 — Bibi Netanyahu (PEP alias resolution)
Payload: `{"name":"Bibi Netanyahu","pep":true}`
Pass: `riskLevel` in {`clear`,`low`}, top confidence ≤ 0.80, at least
one PEP-positive match.

### Q13 — Xi Jinping (PEP position string)
Payload: `{"name":"Xi Jinping","pep":true}`
Pass: PEP match present, `pepStatus.position` contains "General
Secretary". No risk bound asserted.

### Q14 — John Smith (common name, false-positive guard)
Payload: `{"name":"John Smith"}`
Pass: `riskLevel` in {`clear`,`low`,`medium`} (never `high`), top
confidence ≤ 0.80.

### Q15 — Acme Corp Ltd (clean org, no hits)
Payload: `{"name":"Acme Corp Ltd"}`
Pass: `riskLevel` in {`clear`,`low`,`medium`}, top confidence ≤ 0.70.

### Q16 — Lukashenka (alternate spelling, EU-only)
Payload: `{"name":"Lukashenka","lists":["eu_fsf"]}`
Pass: `riskLevel` in {`medium`,`high`}, top confidence ≥ 0.65, source
includes `eu_fsf`.

### Q17 — ISIS (UN-only acronym alias)
Payload: `{"name":"ISIS","lists":["un"]}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.85, source includes
`un`.

### Q18 — Nicolas Maduro (OFAC, alias chop)
Payload: `{"name":"Nicolas Maduro"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.80, source includes
`ofac`.

### Q19 — Vladimir Putin @ threshold 0.99 (cutoff behaviour)
Payload: `{"name":"Vladimir Putin","threshold":0.99}`
Pass: `≤1` match returned (most fuzzy/phonetic noise pruned),
`riskLevel` in {`clear`,`high`}.

### Q20 — "Putin" (single-token query)
Payload: `{"name":"Putin"}`
Pass: `≥1` match, top confidence ≥ 0.40 (±0.05), `riskLevel` in
{`low`,`medium`,`high`}, source includes `ofac`.

### Q21 — Kim Jung-un (embedding-tier transliteration drift)
Payload: `{"name":"Kim Jung-un"}`
Pass: `riskLevel` in {`medium`,`high`}, top confidence ≥ 0.85 (±0.05),
source includes `ofac`, layers cover `Embedding` and `Phonetic`. The
in-memory trigram-cosine matcher binds "Kim Jung-un" to the OFAC
alias "Kim Jung Un"; Phonetic also fires.

### Q22 — Bashar al-Asad (embedding-tier Arabic transliteration)
Payload: `{"name":"Bashar al-Asad"}`
Pass: `riskLevel` in {`medium`,`high`}, top confidence ≥ 0.80 (±0.05),
source includes `ofac`, layers cover `Embedding` and `Phonetic`. The
single-s spelling now binds via trigram cosine; Phonetic fires too.

### Q23 — Volodymyr Putin (embedding-tier semantic drift)
Payload: `{"name":"Volodymyr Putin"}`
Pass: `riskLevel` in {`low`,`medium`,`high`}, top confidence ≥ 0.70
(±0.05), source includes `ofac`, layers cover `Embedding` and
`Phonetic`. Ukrainian-style transliteration of Vladimir Putin — the
trigram-cosine matcher binds to the OFAC alias "Vladimir Putin".

### Q24 — Pootin @ threshold 0.75 (embedding-near-miss negative)
Payload: `{"name":"Pootin","threshold":0.75}`
Pass: `riskLevel` in {`clear`,`low`}, `≤1` match, top confidence ≤ 0.75
(±0.05). A phonetic-only spelling of Putin — the trigram-cosine
matcher does not bind it (sub-threshold) and the 0.75 cutoff prunes
the Phonetic noise. No layer pin (the negative may emit zero matches).

### Q25 — Владимир Путин (Cyrillic Vladimir Putin)
Payload: `{"name":"Владимир Путин"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.80 (±0.05), sources
include `ofac`, `eu_fsf`, `uk_ofsi`, layers cover `Embedding`.
`expandQuery` transliterates the Cyrillic input to "vladimir putin"
and the full cascade fires against the Putin entries. Response shape
matches Q1, with `query` echoed back as the original Cyrillic string.

### Q26 — بشار الأسد (Arabic Bashar al-Assad)
Payload: `{"name":"بشار الأسد"}`
Pass: `riskLevel` in {`medium`,`high`}, top confidence ≥ 0.70 (±0.05),
source includes `ofac`, layers cover `Embedding`. `expandQuery` strips
diacritics, applies the "ال" → "al-" rule, and transliterates to an
approximate Latin form. The embedding layer binds against
"Bashar al-Assad".

### Q27 — Сергей Лавров (Cyrillic Sergey Lavrov)
Payload: `{"name":"Сергей Лавров"}`
Pass: `riskLevel == "high"`, top confidence ≥ 0.80 (±0.05), source
includes `ofac`, layers cover `Embedding`. Cyrillic transliteration of
the OFAC sanctioned Lavrov.

### Q28 — Volodymyr Putyn (transliteration variant)
Payload: `{"name":"Volodymyr Putyn"}`
Pass: `riskLevel` in {`low`,`medium`,`high`}, top confidence ≥ 0.60
(±0.05), source includes `ofac`, layers cover `Embedding`. Ukrainian
first name + non-standard Latin "Putyn" spelling — only the trigram-
cosine embedding layer survives the spelling drift.

## Skill-based run

Each curl call above has a one-line `/screen` equivalent (see
`api/.claude/skills/screen/skill.md` and `handler.sh`). The skill calls
`POST /api/v1/screen/public-demo` on `localhost:8080` and renders a
human-readable summary.

```text
/screen "Vladimir Putin"
/screen "Vladmir Putin"
/screen "Sberbank of Russia" --lists ofac,eu_fsf
/screen "Kim Jong-un"
/screen "Sergei Lavrov"
/screen "Bashar Assad"
/screen "Bank Sepah" --lists ofac
/screen "VTB" --lists ofac,uk_ofsi
/screen "Roman Abramovich" --lists uk_ofsi
/screen "Recep Tayyip Erdogan" --pep
/screen "Benjamin Netanyahu" --pep
/screen "Bibi Netanyahu" --pep
/screen "Xi Jinping" --pep
/screen "John Smith"
/screen "Acme Corp Ltd"
/screen "Lukashenka" --lists eu_fsf
/screen "ISIS" --lists un
/screen "Nicolas Maduro"
/screen "Vladimir Putin" --threshold 0.99
/screen "Putin"
/screen "Kim Jung-un"
/screen "Bashar al-Asad"
/screen "Volodymyr Putin"
/screen "Pootin" --threshold 0.75
/screen "Владимир Путин"
/screen "بشار الأسد"
/screen "Сергей Лавров"
/screen "Volodymyr Putyn"
```

Pass criteria match the corresponding numbered curl scenario above —
the skill is a wrapper, not a different code path.

## CI run

The 28 scenarios above are codified in `queries_test.go::
TestPublicDemo_AllFixtureQueries`, which fails if fewer than 28
fixture queries exist and runs each through `httptest`. Pass/fail is
delegated to `expectations_test.go` (`min_matches`,
`min_top_confidence`, `risk_level`, `list_ids`, `layers_present`,
`pep_status_required`, `pep_position_contains`).

```bash
# From products/amliq/api/
go test ./internal/screening/publicdemo/...

# Verbose, including the canonical Vladimir Putin sample response:
go test -v -run TestPublicDemo_VladimirPutinSampleResponse \
  ./internal/screening/publicdemo/
```

CI exit is non-zero on any scenario failure. Coverage and the
canonical sample response output are archived per the AMLIQ release
checklist (see `products/amliq/CLAUDE.md`).
