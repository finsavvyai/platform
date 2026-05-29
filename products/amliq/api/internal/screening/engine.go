package screening

import (
	"context"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/cache"
	"github.com/aegis-aml/aegis/internal/domain"
)

type Engine struct {
	exactMatcher      *ExactMatcher
	fuzzyMatcher      *FuzzyMatcher
	phoneticMatcher   *PhoneticMatcher
	tokenMatcher      *TokenMatcher
	embeddingMatcher  EmbeddingLayer
	graphMatcher      *GraphMatcher
	secondaryMatcher  *SecondaryMatcher
	scorer            *WeightedScorer
	explainer         *Explainer
	searchIndex       *SearchIndex
	tieredIndex       *TieredIndex
	tieredIndexV2     *TieredIndexV2
	llmCascade        *LLMCascade
	screeningCfg      *domain.ScreeningConfig
	screenCache       cache.ScreeningCache
}

func NewEngine(scorer *WeightedScorer, opts ...EngineOption) *Engine {
	if scorer == nil {
		scorer = NewWeightedScorer(nil)
	}
	e := &Engine{
		exactMatcher:     NewExactMatcher(),
		fuzzyMatcher:     NewFuzzyMatcher(0.60),
		phoneticMatcher:  NewPhoneticMatcher(),
		tokenMatcher:     NewTokenMatcher(),
		secondaryMatcher: NewSecondaryMatcher(),
		scorer:           scorer,
		explainer:        NewExplainer(),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// Screen is a convenience wrapper for ScreenWithContext.
func (e *Engine) Screen(query domain.Entity, cands []domain.Entity) ([]domain.MatchResult, error) {
	return e.ScreenWithContext(context.Background(), domain.TenantID{}, query, cands, nil)
}

// ScreenWithContext runs the full cascade with cache, matchers, and LLM.
func (e *Engine) ScreenWithContext(
	ctx context.Context, tenantID domain.TenantID,
	query domain.Entity, candidates []domain.Entity, matchCfg *domain.MatchConfig,
) ([]domain.MatchResult, error) {
	if len(query.Names) == 0 {
		return nil, fmt.Errorf("query entity has no names")
	}
	qn := query.Names[0]
	if cached, err := e.checkCache(qn.Full); err == nil && cached != nil {
		return cached, nil
	}
	if len(candidates) == 0 {
		candidates = e.resolveCandidates(qn.Full)
	}
	cn := e.getNamesFromEntities(candidates)
	ev := e.runNameMatchers(qn, cn)
	ev = e.runEmbeddingLayer(ctx, tenantID, matchCfg, qn, ev)
	ev = e.runGraphLayer(ctx, matchCfg, query, candidates, ev)
	ev = e.applyLayerThresholds(ev)
	e.applyConfigWeights()
	results := e.buildResultsWithQuery(query, candidates, ev)
	results = e.runLLMCascade(ctx, query, candidates, results)
	e.storeCache(qn.Full, results)
	return results, nil
}

func (e *Engine) runNameMatchers(q domain.Name, c []domain.Name) []domain.MatchEvidence {
	// Each layer can emit at most len(c) evidence items; 4 layers →
	// 4*len(c) upper bound. Preallocate to avoid the 3–4 reallocations
	// the naive var+append pattern triggers for a 50-candidate screen.
	ev := make([]domain.MatchEvidence, 0, 4*len(c))
	ev = append(ev, e.exactMatcher.Match(q, c)...)
	ev = append(ev, e.fuzzyMatcher.Match(q, c)...)
	ev = append(ev, e.phoneticMatcher.Match(q, c)...)
	ev = append(ev, e.tokenMatcher.Match(q, c)...)
	return ev
}

func (e *Engine) runEmbeddingLayer(
	ctx context.Context, tid domain.TenantID, cfg *domain.MatchConfig,
	q domain.Name, ev []domain.MatchEvidence,
) []domain.MatchEvidence {
	if e.embeddingMatcher == nil || !isLayerEnabled(cfg, "embedding") {
		return ev
	}
	emb, err := e.embeddingMatcher.MatchWithContext(ctx, tid, q)
	if err != nil {
		log.Printf("embedding layer error: %v", err)
		return ev
	}
	return append(ev, emb...)
}
