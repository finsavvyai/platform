# SCREENING_ENGINE.md — 6-Layer Matching Pipeline

## Overview

The screening engine implements a **cascade matching** architecture. Each of 6 layers produces evidence (a score), and a weighted scorer combines them into a final Confidence score.

```
Query Entity (e.g., "JOHN SMITH, DOB 1980-01-15")
    ↓
L1 Exact (0.1ms)        → Evidence: exact match = 100
    ↓
L2 Fuzzy (1ms)          → Evidence: 92% Jaro-Winkler
    ↓
L3 Phonetic (2ms)       → Evidence: soundex match
    ↓
L4 Token (3ms)          → Evidence: 85% Jaccard on tokens
    ↓
L5 Embedding (10ms)     → Evidence: 0.87 cosine similarity
    ↓
L6 Graph (20ms)         → Evidence: related to sanctioned person
    ↓
Scorer (weighted sum)   → Confidence: 78
    ↓
Explainer (text)        → "Matched on family name + Phonetic + Token"
    ↓
Disposition            → NeedsReview (confidence > threshold)
```

## Layer 1: Exact Matching

**File**: `internal/screening/exact.go`, `normalizer.go`
**Speed**: ~0.1ms
**Purpose**: Catch exact matches (with normalization)

### Algorithm
1. Normalize both query and candidate names:
   - Unicode NFC normalization (decompose accents)
   - Case folding (uppercase & lowercase equivalent)
   - Whitespace collapse (multiple spaces → one)
   - Special character removal (diacritics)
2. Compare normalized strings
3. If identical → 100% match

### Example
```
Query:       "José María García"
Normalized:  "jose maria garcia"

Candidate:   "JOSE MARIA GARCIA"
Normalized:  "jose maria garcia"

Result: 100% match (Exact)
```

### Code Pattern
```go
func (em *ExactMatcher) Match(query Name, candidates []Name) []MatchEvidence {
    normalized := em.normalizer.Normalize(query.Full)
    for _, cand := range candidates {
        if normalized == em.normalizer.Normalize(cand.Full) {
            evidence = append(evidence, MatchEvidence{
                Layer: domain.LayerExact,
                Score: 1.0,
            })
        }
    }
    return evidence
}
```

## Layer 2: Fuzzy Matching

**File**: `internal/screening/fuzzy.go`, `jaro_winkler.go`
**Speed**: ~1ms
**Purpose**: Catch typos, misspellings

### Algorithm: Jaro-Winkler Distance
```
Jaro(s1, s2) =
    (m/|s1| + m/|s2| + (m-t)/m) / 3
    where m = matching chars, t = transpositions

Example:
s1 = "JOHN"
s2 = "JON"  (missing H)
Jaro ≈ 0.89

Add Winkler boost if prefix matches (common names):
"JOHN" vs "JOHN" prefix = +0.1 bonus
Final: ~0.99
```

### When It Helps
- "JOHN SMITH" vs "JON SMITH" (typo: missing vowel)
- "MIKHAIL" vs "MICHAEL" (transliteration)
- "MOHAMMED" vs "MOHAMMAD" (spelling variant)

### Code Pattern
```go
func (jw *JaroWinkler) Distance(s1, s2 string) float64 {
    if s1 == s2 { return 1.0 }
    jaroScore := jw.jaro(s1, s2)
    if jaroScore > 0.7 {
        prefixLen := jw.commonPrefix(s1, s2)
        return jaroScore + (float64(prefixLen) * 0.1 * (1 - jaroScore))
    }
    return jaroScore
}
```

## Layer 3: Phonetic Matching

**File**: `internal/screening/phonetic.go`, `soundex.go`
**Speed**: ~2ms
**Purpose**: Catch pronunciation-based matches

### Algorithm: Soundex
```
Convert name to 4-char code based on phonetics:
1. Keep first letter
2. Convert consonants to digits:
   B, F, P, V → 1
   C, G, J, K, Q, S, X, Z → 2
   D, T → 3
   L → 4
   M, N → 5
   R → 6
3. Drop vowels, H, W, Y
4. Pad/truncate to 4 chars

Example:
"SMITH" → S530
"SMYTH" → S530  (same code!)
```

### When It Helps
- "SMITH" vs "SMYTH" (spelling)
- "CATHERINE" vs "KATHERINE" (pronunciation)
- "STEPHEN" vs "STEVEN"

### Code Pattern
```go
func (s *Soundex) Code(name string) string {
    first := strings.ToUpper(name[:1])
    digits := []string{}
    for _, ch := range strings.ToUpper(name[1:]) {
        digit := s.charToDigit(ch)
        if digit != "" && (len(digits) == 0 || digit != digits[len(digits)-1]) {
            digits = append(digits, digit)
        }
    }
    result := first + strings.Join(digits, "")
    return result[:min(4, len(result))]
}
```

## Layer 4: Token Matching

**File**: `internal/screening/token.go`
**Speed**: ~3ms
**Purpose**: Catch partial name matches

### Algorithm: Jaccard Similarity
```
Split names into tokens (words):
Query:     "JOHN DAVID SMITH" → {JOHN, DAVID, SMITH}
Candidate: "SMITH JOHN" → {SMITH, JOHN}

Jaccard = |Intersection| / |Union|
        = 2 / 3 = 0.667 (66.7% match)

Threshold: >0.5 is usually a match
```

### When It Helps
- Middle names in different order
- Some names missing (abbreviated)
- Multiple versions of same person

### Code Pattern
```go
func (tm *TokenMatcher) Match(query Name, candidates []Name) []MatchEvidence {
    queryTokens := tokenize(query.Full)
    for _, cand := range candidates {
        candTokens := tokenize(cand.Full)
        intersection := len(intersection(queryTokens, candTokens))
        union := len(union(queryTokens, candTokens))
        score := float64(intersection) / float64(union)
        if score > 0.5 {
            evidence = append(evidence, MatchEvidence{
                Layer: domain.LayerToken,
                Score: score,
            })
        }
    }
    return evidence
}
```

## Layer 5: Embedding Matching

**File**: `internal/screening/embedding.go`, `cosine.go`
**Speed**: ~10ms
**Purpose**: Catch semantic similarities (requires vector DB)

### Algorithm: Cosine Similarity
```
Convert names to vectors (embeddings):
Query:     "John Smith" → [0.2, 0.8, -0.1, 0.5, ...]
Candidate: "Jon Smith" → [0.19, 0.81, -0.09, 0.51, ...]

Cosine Similarity = (A · B) / (||A|| * ||B||)
                  = 0.99 (99% similar)

Uses pgvector in PostgreSQL for fast nearest neighbor search.
```

### When It Helps
- Transliterated names from different scripts
- Complex phonetic variations
- Names from different languages

### Note
- Requires embeddings to be pre-computed (in database)
- Uses PostgreSQL pgvector with IVFFLAT index
- Optional (disabled by default, enable in TenantConfig)

### Code Pattern
```go
func (em *EmbeddingMatcher) Match(query Name, candidates []Name) []MatchEvidence {
    queryEmbedding, _ := em.embedder.Embed(query.Full)
    for _, cand := range candidates {
        candEmbedding, _ := em.embedder.Embed(cand.Full)
        cosine := em.cosine.Similarity(queryEmbedding, candEmbedding)
        if cosine > 0.85 {
            evidence = append(evidence, MatchEvidence{
                Layer: domain.LayerEmbedding,
                Score: cosine,
            })
        }
    }
    return evidence
}
```

## Layer 6: Graph Matching

**File**: `internal/screening/graph.go`
**Speed**: ~20ms
**Purpose**: Find sanctioned connections (family, business associates)

### Algorithm: Relationship Traversal
```
Does query entity have relationships to any sanctioned entity?

Query: "John Smith" (not in list, but could be related)
    ↓
Check graph edges:
  - Is brother of "James Smith" (SANCTIONED)
  - Is business partner of "ACME LLC" (SANCTIONED)
    ↓
If yes → Evidence: "Related to sanctioned entity"
```

### When It Helps
- Family members of sanctioned persons
- Business partners/associates
- Officers of sanctioned companies
- Related entities in terrorist networks

### Note
- Requires external graph database (Neo4j, or PostgreSQL jsonb)
- Most expensive layer (~20ms)
- Optional (disabled by default, enable in TenantConfig)

### Code Pattern
```go
func (gm *GraphMatcher) Match(query Name, candidates []Name) []MatchEvidence {
    node, _ := gm.graphDB.FindNode(query.Full)
    if node == nil { return evidence }

    // Traverse edges to sanctioned nodes
    for _, edge := range node.Edges {
        if edge.Target.Sanctioned {
            evidence = append(evidence, MatchEvidence{
                Layer: domain.LayerGraph,
                Score: edge.Confidence,
                Details: fmt.Sprintf("Related to %s via %s", edge.Target.Name, edge.Type),
            })
        }
    }
    return evidence
}
```

## Vessel & Maritime Screening

**Files**: `internal/screening/vessel_matcher.go`, `internal/domain/vessel.go`, `api/handler_vessel.go`
**Purpose**: Screen maritime vessels (ships, tankers) against sanctions lists

### Scoring Logic
Vessels match on three primary identifiers:

| Identifier | Score | Matching Logic |
|-----------|-------|----------------|
| IMO (International Maritime Organization) | 0.99 | Exact match only (globally unique) |
| MMSI (Maritime Mobile Service Identity) | 0.95 | Exact match only (unique identifier) |
| Vessel Name (Fuzzy) | 0.70 | Jaro-Winkler ≥0.85 similarity |
| Flag + Name | 0.80 | Flag country exact match + name JW≥0.75 |

### Example Matching
```
Query:      TORM MARINER, IMO=9765432, Flag=DK
Candidate:  TORM MARINER, IMO=9765432, Flag=DK (on OFAC SDN)

Results:
  - IMO exact match: 0.99 confidence
  - Explanation: "Exact IMO match (globally unique identifier)"
```

### When Used
- Port state control checks
- Maritime finance screening (ship loans, mortgages)
- Insurance underwriting for vessels
- Supply chain screening (vessel-owning entities)

### API Endpoint
`POST /api/v1/vessel/screen` — Screen vessel details against maritime sanctions lists

## PEP Sub-Classification & Risk Tiers

**Files**: `internal/domain/pep_class.go`, `internal/screening/pep_matcher.go`
**Purpose**: Classify Politically Exposed Persons into risk tiers

### PEP Classifications

| Classification | Risk Multiplier | Definition |
|---|---|---|
| Domestic PEP | 1.0x | Active government official (current) |
| Foreign PEP | 0.9x | Government official in foreign country |
| International Organization | 0.8x | Officer in multilateral org (UN, IMF, World Bank) |
| State-Owned Enterprise (SOE) | 0.7x | C-suite of government-owned company |
| Relative/Close Associate (RCA) | 0.6x | Family or immediate business associate of PEP |
| No PEP Classification | 0.0x | Not a PEP |

### Risk Multiplier Application
```
Base screening confidence: 80
PEP type: Domestic → multiplier: 1.0x
Risk-adjusted confidence: 80 × 1.0 = 80

Base screening confidence: 80
PEP type: RCA → multiplier: 0.6x
Risk-adjusted confidence: 80 × 0.6 = 48
```

### When It Helps
- Enhanced due diligence (EDD) triggering for PEPs
- Risk-based KYC decisions
- Regulatory reporting (FinCEN, FATF requirements)
- Ongoing monitoring of high-risk individuals

## Country Risk Index Scoring

**Files**: `internal/domain/country_risk.go`, `internal/ingestion/country_risk.go`
**Purpose**: Assess country-level compliance risk across 240+ countries

### Risk Score Composition
Country risk scores (0.0–1.0) combine data from:
- **Corruption Perceptions Index (CPI)** — Transparency International
- **FATF Grey/Blacklist** — FATF-identified high-risk jurisdictions
- **Basel AML/CFT index** — Banking regulatory assessments
- **World Bank Governance Indicators** — Rule of law, political stability
- **OpenSanctions** — Automated list density by country

### Risk Level Bands
| Score | Level | Implication |
|-------|-------|-------------|
| ≥0.80 | Very High | Severe deficiencies (blacklist, embargoes) |
| 0.60–0.79 | High | Significant AML/CFT gaps |
| 0.40–0.59 | Medium | Moderate risk profile |
| 0.20–0.39 | Low | Compliant, lower-risk jurisdictions |
| <0.20 | Very Low | Strong compliance records |

### Tenant Overrides
Each tenant can override country risk scores for their regulatory context:
```go
// Bank in EU may trust EU neighbors differently
riskIndex.SetOverride(tenantID, "AT", 0.15)  // Austria: override to 15%
riskIndex.SetOverride(tenantID, "RU", 0.95)  // Russia: override to 95%
```

### Use Cases
- Transaction risk scoring (high-risk country premium)
- Correspondent banking decisions
- Regulatory report thresholds
- Customer onboarding friction (additional EDD for high-risk countries)

### Data Coverage
- 240+ countries/territories
- Updated monthly from composite sources
- Tenant-specific overrides per jurisdiction

## Scoring & Confidence

**File**: `internal/screening/scorer.go`

Combines all layer evidence into final Confidence (0-100).

### Algorithm: Weighted Sum
```
TenantConfig.ScreeningWeights = {
    Exact:      30,
    Fuzzy:      25,
    Phonetic:   15,
    Token:      15,
    Embedding:  10,
    Graph:       5,
}

Evidence from all layers:
  L1 Exact:      1.0 (100)
  L2 Fuzzy:      0.92 (92)
  L3 Phonetic:   0.0 (no match)
  L4 Token:      0.85 (85)
  L5 Embedding:  0.0 (no match)
  L6 Graph:      0.0 (no match)

Weighted Score = (1.0*30 + 0.92*25 + 0.0*15 + 0.85*15 + 0.0*10 + 0.0*5) / 100
               = (30 + 23 + 0 + 12.75 + 0 + 0) / 100
               = 65.75 → Confidence: 66
```

### Customization Per Tenant
Each bank can adjust weights in TenantConfig based on risk profile:
- Conservative bank: Lower weights, higher thresholds
- Crypto exchange: Higher weights, aggressive matching

## Explainer

**File**: `internal/screening/explainer.go`

Generates human-readable explanation for each match.

### Example Output
```
"Matched on exact family name (Smith) +
 Fuzzy match on given name (John vs Jon, 92% similarity) +
 Token match on full name (85% token overlap).
 No phonetic or embedding matches."
```

### Why It Matters
- Regulators (GDPR, AI Act) require explainability
- Compliance officers need to justify decisions
- Builds customer trust ("I understand why this was flagged")

## Short-Circuiting

The engine stops processing layers when confidence exceeds tenant's threshold.

```go
for _, candidate := range candidates {
    // Run through layers...
    confidence := scorer.Score(evidence)

    if confidence > tenantConfig.ConfidenceThreshold {
        // HIGH CONFIDENCE MATCH - DON'T NEED MORE LAYERS
        // Skip Embedding & Graph layers (expensive)
        break
    }
}
```

This provides both **speed** (p95 <50ms) and **accuracy** (don't over-match).

## Adding a New Layer

To add a 7th layer (e.g., Semantic):

1. Create `internal/screening/semantic.go`:
   ```go
   type SemanticMatcher struct { /* fields */ }
   func NewSemanticMatcher() *SemanticMatcher { /* ... */ }
   func (sm *SemanticMatcher) Match(...) []MatchEvidence { /* ... */ }
   ```

2. Create `internal/screening/semantic_test.go` with table-driven tests

3. Update `Engine.Screen()`:
   ```go
   allEvidence = append(allEvidence, e.semanticMatcher.Match(...))
   ```

4. Update scoring weights in domain model

---

**Performance target**: p95 <50ms for typical screening (single-name queries over 10k entities).
