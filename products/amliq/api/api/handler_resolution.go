package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ResolutionHandler manages entity resolution/dedup.
type ResolutionHandler struct {
	clusters storage.EntityClusterRepository
}

func NewResolutionHandler(c storage.EntityClusterRepository) *ResolutionHandler {
	return &ResolutionHandler{clusters: c}
}

type DedupeRequest struct {
	Names []string `json:"names"`
}

func (h *ResolutionHandler) Dedupe(w http.ResponseWriter, r *http.Request) {
	var req DedupeRequest
	if err := DecodeJSON(r, &req); err != nil || len(req.Names) < 2 {
		Error(w, "INVALID", "at least 2 names required", http.StatusBadRequest)
		return
	}
	type match struct {
		A     string  `json:"a"`
		B     string  `json:"b"`
		Score float64 `json:"score"`
	}
	var matches []match
	for i := 0; i < len(req.Names); i++ {
		for j := i + 1; j < len(req.Names); j++ {
			score := domain.SimpleDedupeScore(req.Names[i], req.Names[j])
			if score >= 0.5 {
				matches = append(matches, match{
					A: req.Names[i], B: req.Names[j], Score: score,
				})
			}
		}
	}
	Success(w, map[string]interface{}{
		"matches": matches, "total": len(matches),
	}, http.StatusOK)
}

func (h *ResolutionHandler) ListClusters(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	clusters, err := h.clusters.ListByTenant(r.Context(), tid)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"clusters": clusters, "total": len(clusters),
	}, http.StatusOK)
}
