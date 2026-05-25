package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ScreenDemoHandler runs the 6-layer screening engine for demo purposes.
type ScreenDemoHandler struct {
	entities storage.EntityRepository
	engine   *screening.Engine
}

// NewScreenDemoHandler creates a handler wired to entity search + engine.
func NewScreenDemoHandler(
	e storage.EntityRepository, eng *screening.Engine,
) *ScreenDemoHandler {
	return &ScreenDemoHandler{entities: e, engine: eng}
}

type screenDemoRequest struct {
	Name      string   `json:"name"`
	Lists     []string `json:"lists"`
	Threshold float64  `json:"threshold"`
}

// Screen handles POST /api/v1/screen/demo (authenticated).
func (h *ScreenDemoHandler) Screen(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "missing claims", http.StatusUnauthorized)
		return
	}
	if _, err := domain.NewTenantID(claims.TenantID); err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	var req screenDemoRequest
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

	candidates, err := h.entities.Search(req.Name)
	if err != nil {
		Error(w, "SEARCH_ERROR", "candidate search failed",
			http.StatusInternalServerError)
		return
	}
	candidates = filterCandidatesByLists(candidates, req.Lists)
	queryEntity := buildDemoQueryEntity(req.Name)

	start := time.Now()
	matches, err := h.engine.Screen(queryEntity, candidates)
	if err != nil {
		Error(w, "SCREENING_ERROR", "screening failed",
			http.StatusInternalServerError)
		return
	}

	filtered := filterByThreshold(matches, req.Threshold)
	elapsed := time.Since(start).Milliseconds()
	Success(w, buildDemoResponse(req.Name, filtered, elapsed, candidates), http.StatusOK)
}

// publicScreenDemoLimiter limits public demo to 2 req/hr per IP.
var publicScreenDemoLimiter = NewIPRateLimiter(2, 1*time.Hour)

// PublicScreenDemo returns an unauthenticated handler for the public demo.
func PublicScreenDemo(
	entities storage.EntityRepository, engine *screening.Engine,
) http.HandlerFunc {
	return publicScreenDemoHandler(entities, engine)
}
