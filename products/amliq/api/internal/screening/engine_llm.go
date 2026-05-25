package screening

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// runLLMCascade evaluates uncertain matches via LLM.
// Modifies results in-place: boosts confidence if LLM confirms,
// reduces if LLM rejects. Only runs if llmCascade is configured.
func (e *Engine) runLLMCascade(
	ctx context.Context,
	query domain.Entity,
	candidates []domain.Entity,
	results []domain.MatchResult,
) []domain.MatchResult {
	queryName := query.PrimaryName().Full
	if e.llmCascade == nil {
		return results
	}
	if e.screeningCfg == nil || !e.screeningCfg.LLMCascade {
		return results
	}

	for i, r := range results {
		score := r.Confidence.Score()
		if !e.llmCascade.ShouldEvaluate(score) {
			continue
		}
		// Find the candidate entity for this result
		cand := findCandidate(candidates, r.EntityID)
		if cand == nil {
			continue
		}
		// Skip AI for obvious exact matches (name + DOB + country)
		if boosted, expl := TryBoost(query, *cand); boosted {
			results[i].Confidence, _ = domain.NewConfidence(0.99)
			results[i].ExplainChain += "\n[Boost] " + expl
			continue
		}
		verdict, err := e.llmCascade.Evaluate(
			ctx, queryName, *cand, score,
		)
		if err != nil {
			log.Printf("LLM cascade error for %s: %v", r.EntityID, err)
			continue
		}
		if verdict.IsSameEntity {
			boosted := score + 0.2
			if boosted > 0.99 { boosted = 0.99 }
			results[i].Confidence, _ = domain.NewConfidence(boosted)
			results[i].ExplainChain += "\n[LLM] Claude confirmed match"
		} else {
			reduced := score - 0.3
			if reduced < 0.1 { reduced = 0.1 }
			results[i].Confidence, _ = domain.NewConfidence(reduced)
			results[i].ExplainChain += "\n[LLM] Claude rejected match"
		}
	}
	return results
}

func findCandidate(
	candidates []domain.Entity, id domain.EntityID,
) *domain.Entity {
	for i := range candidates {
		if candidates[i].ID == id {
			return &candidates[i]
		}
	}
	return nil
}

// SetScreeningConfig applies a per-tenant screening configuration.
func (e *Engine) SetScreeningConfig(cfg *domain.ScreeningConfig) {
	e.screeningCfg = cfg
}
