package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func handleGetMatchConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	cfg := domain.DefaultMatchConfig(tid)
	Success(w, cfg, http.StatusOK)
}

func handleUpdateMatchConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req domain.MatchConfig
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	req.TenantID = tid

	if req.FuzzyThreshold < 0 || req.FuzzyThreshold > 1 {
		Error(w, "VALIDATION", "fuzzy_threshold must be 0-1", http.StatusBadRequest)
		return
	}
	if req.EmbeddingThreshold < 0 || req.EmbeddingThreshold > 1 {
		Error(w, "VALIDATION", "embedding_threshold must be 0-1", http.StatusBadRequest)
		return
	}
	if req.MinConfidence < 0 || req.MinConfidence > 1 {
		Error(w, "VALIDATION", "min_confidence must be 0-1", http.StatusBadRequest)
		return
	}

	Success(w, map[string]interface{}{
		"message": "match config updated", "config": req,
	}, http.StatusOK)
}
