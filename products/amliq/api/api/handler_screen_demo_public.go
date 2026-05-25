package api

import (
	"context"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

type publicScreenRequest struct {
	Name      string   `json:"name"`
	Lists     []string `json:"lists,omitempty"`
	Threshold float64  `json:"threshold,omitempty"`
	FuzzyMin  float64  `json:"fuzzy_min,omitempty"`
}

func publicScreenDemoHandler(
	entities storage.EntityRepository,
	engine *screening.Engine,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !publicScreenDemoLimiter.Allow(ip) {
			Error(w, "RATE_LIMITED", "demo: 2 screens/hour", http.StatusTooManyRequests)
			return
		}

		var req publicScreenRequest
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			Error(w, "VALIDATION", "name required", http.StatusBadRequest)
			return
		}
		if req.Threshold <= 0 {
			req.Threshold = 0.5
		}
		if req.FuzzyMin <= 0 {
			req.FuzzyMin = 0.15
		}

		// Apply per-tenant config if authenticated, else defaults
		cfg := domain.DefaultScreeningConfig()
		if tenantID := GetTenantID(r); tenantID != "" {
			cfg = loadTenantScreeningConfig(tenantID)
		}
		if req.Threshold > 0 && req.Threshold < cfg.OverallThreshold {
			cfg.OverallThreshold = req.Threshold
		}
		engine.SetScreeningConfig(&cfg)

		start := time.Now()
		candidates := searchCandidates(entities, req.Name, req.Lists, req.FuzzyMin)

		queryEntity := buildDemoQueryEntity(req.Name)
		matches, err := engine.Screen(queryEntity, candidates)
		if err != nil {
			Error(w, "SCREENING_ERROR", "engine error", http.StatusInternalServerError)
			return
		}

		filtered := filterByThreshold(matches, req.Threshold)
		maxRes := cfg.MaxResults
		if maxRes <= 0 {
			maxRes = 10
		}
		if len(filtered) > maxRes {
			filtered = filtered[:maxRes]
		}
		elapsed := time.Since(start).Milliseconds()
		Success(w, buildDemoResponse(req.Name, filtered, elapsed, candidates), http.StatusOK)
	}
}

func searchCandidates(
	entities storage.EntityRepository,
	name string, lists []string, fuzzyMin float64,
) []domain.Entity {
	if pgxRepo, ok := entities.(*spgx.EntityRepository); ok {
		cands, err := pgxRepo.FastSearch(context.Background(), spgx.SearchOptions{
			Query: name, Lists: lists, Threshold: fuzzyMin, Limit: 50,
		})
		if err == nil {
			return cands
		}
	} else {
	}
	cands, _ := entities.Search(name)
	return cands
}

func loadTenantScreeningConfig(tenantID string) domain.ScreeningConfig {
	_ = tenantID // In production, load from storage
	return domain.DefaultScreeningConfig()
}
