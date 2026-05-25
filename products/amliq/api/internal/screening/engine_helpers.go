package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// EngineOption configures optional engine layers.
type EngineOption func(*Engine)

// WithEmbeddingMatcher enables the embedding (layer 5) matcher.
func WithEmbeddingMatcher(m *PgvectorMatcher) EngineOption {
	return func(e *Engine) { e.embeddingMatcher = m }
}

// WithGraphMatcher enables the graph (layer 6) matcher.
func WithGraphMatcher(m *GraphMatcher) EngineOption {
	return func(e *Engine) { e.graphMatcher = m }
}

// WithLLMCascade enables AI disambiguation for uncertain matches.
func WithLLMCascade(c *LLMCascade) EngineOption {
	return func(e *Engine) { e.llmCascade = c }
}

func isLayerEnabled(cfg *domain.MatchConfig, layer string) bool {
	if cfg == nil {
		return true
	}
	return cfg.IsLayerEnabled(layer)
}

func (e *Engine) buildResults(
	candidates []domain.Entity, allEvidence []domain.MatchEvidence,
) []domain.MatchResult {
	return e.buildResultsWithQuery(domain.Entity{}, candidates, allEvidence)
}

func (e *Engine) buildResultsWithQuery(
	query domain.Entity, candidates []domain.Entity,
	allEvidence []domain.MatchEvidence,
) []domain.MatchResult {
	results := make([]domain.MatchResult, 0, len(candidates))
	for _, cand := range candidates {
		evidenceForCandidate := e.filterEvidenceForEntity(allEvidence, cand.Names)
		if len(evidenceForCandidate) == 0 {
			continue
		}
		score, _ := e.scorer.Score(evidenceForCandidate)
		if e.secondaryMatcher != nil && len(query.Names) > 0 {
			score = e.secondaryMatcher.AdjustScore(query, cand, score)
		}
		conf, _ := domain.NewConfidence(score)
		explain := e.explainer.Explain(evidenceForCandidate)
		result := domain.NewMatchResult(
			cand.ID, conf, domain.DispositionReview,
			evidenceForCandidate, explain, cand.ListID,
		)
		results = append(results, result)
	}
	return results
}

func (e *Engine) getNamesFromEntities(entities []domain.Entity) []domain.Name {
	count := 0
	for _, ent := range entities {
		count += len(ent.Names)
	}
	names := make([]domain.Name, 0, count)
	for _, ent := range entities {
		names = append(names, ent.Names...)
	}
	return names
}

func collectEntityIDs(entities []domain.Entity) map[string]bool {
	ids := make(map[string]bool, len(entities))
	for _, ent := range entities {
		ids[ent.ID.String()] = true
	}
	return ids
}

func (e *Engine) filterEvidenceForEntity(
	evidence []domain.MatchEvidence, names []domain.Name,
) []domain.MatchEvidence {
	// Build name set for O(1) lookup instead of O(names) per evidence item
	nameSet := make(map[string]struct{}, len(names))
	for _, name := range names {
		nameSet[name.Full] = struct{}{}
	}
	filtered := make([]domain.MatchEvidence, 0, len(evidence)/2)
	for _, ev := range evidence {
		if _, ok := nameSet[ev.MatchedValue]; ok {
			filtered = append(filtered, ev)
		}
	}
	return filtered
}

func (e *Engine) applyLayerThresholds(evidence []domain.MatchEvidence) []domain.MatchEvidence {
	if e.screeningCfg == nil {
		return evidence
	}
	kept := make([]domain.MatchEvidence, 0, len(evidence))
	for _, ev := range evidence {
		thresh, ok := e.screeningCfg.LayerThresholds[ev.Layer.String()]
		if !ok || ev.Score >= thresh {
			kept = append(kept, ev)
		}
	}
	return kept
}

func (e *Engine) applyConfigWeights() {
	if e.screeningCfg == nil {
		return
	}
	for layer, w := range e.screeningCfg.LayerWeights {
		e.scorer.SetWeight(layer, w/100.0)
	}
}
