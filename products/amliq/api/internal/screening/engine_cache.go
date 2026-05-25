package screening

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/cache"
	"github.com/aegis-aml/aegis/internal/domain"
)

// DefaultCacheTTL is the screening result cache lifetime.
const DefaultCacheTTL = 24 * time.Hour

// WithScreeningCache enables the screening result cache layer.
func WithScreeningCache(c cache.ScreeningCache) EngineOption {
	return func(e *Engine) { e.screenCache = c }
}

// checkCache returns cached results for a query name, or nil on miss.
func (e *Engine) checkCache(queryName string) ([]domain.MatchResult, error) {
	if e.screenCache == nil {
		return nil, nil
	}
	key := cache.ScreeningCacheKey{EntityName: queryName}
	entry, err := e.screenCache.Get(key)
	if err != nil {
		log.Printf("screening cache get error: %v", err)
		return nil, err
	}
	if entry == nil {
		return nil, nil
	}
	var results []domain.MatchResult
	if err := json.Unmarshal(entry.Result, &results); err != nil {
		log.Printf("screening cache decode error: %v", err)
		return nil, nil
	}
	return results, nil
}

// storeCache persists screening results for future lookups.
func (e *Engine) storeCache(queryName string, results []domain.MatchResult) {
	if e.screenCache == nil {
		return
	}
	data, err := json.Marshal(results)
	if err != nil {
		log.Printf("screening cache encode error: %v", err)
		return
	}
	key := cache.ScreeningCacheKey{EntityName: queryName}
	if err := e.screenCache.Set(key, data, DefaultCacheTTL); err != nil {
		log.Printf("screening cache set error: %v", err)
	}
}

// runGraphLayer executes the graph relationship matcher if configured.
func (e *Engine) runGraphLayer(
	ctx context.Context, cfg *domain.MatchConfig,
	query domain.Entity, candidates []domain.Entity,
	ev []domain.MatchEvidence,
) []domain.MatchEvidence {
	if e.graphMatcher == nil || !isLayerEnabled(cfg, "graph") {
		return ev
	}
	sanctionedIDs := collectEntityIDs(candidates)
	graphEv := e.graphMatcher.MatchEntities(
		ctx, []string{query.ID.String()}, sanctionedIDs,
	)
	return append(ev, graphEv...)
}
