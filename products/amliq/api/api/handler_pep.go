package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// PEPHandler manages PEP screening endpoints.
type PEPHandler struct {
	peps storage.PEPRepository
}

func NewPEPHandler(p storage.PEPRepository) *PEPHandler {
	return &PEPHandler{peps: p}
}

type PEPScreenRequest struct {
	EntityID string `json:"entity_id"`
	Name     string `json:"name"`
	Country  string `json:"country"`
}

func (h *PEPHandler) Screen(w http.ResponseWriter, r *http.Request) {
	var req PEPScreenRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	if req.EntityID == "" && req.Name == "" {
		Error(w, "VALIDATION", "entity_id or name required", http.StatusBadRequest)
		return
	}
	if req.EntityID != "" {
		profile, err := h.peps.GetByEntityID(r.Context(), req.EntityID)
		if err != nil || profile == nil {
			Success(w, map[string]interface{}{
				"is_pep": false, "profile": nil,
			}, http.StatusOK)
			return
		}
		Success(w, map[string]interface{}{
			"is_pep":      true,
			"profile":     profile,
			"tier":        profile.Tier.String(),
			"risk_weight": profile.Tier.RiskWeight(),
		}, http.StatusOK)
		return
	}
	results, err := h.peps.SearchByName(r.Context(), req.Name, 50)
	if err != nil {
		Error(w, "DB_ERROR", "search failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"results": results, "total": len(results),
	}, http.StatusOK)
}

func (h *PEPHandler) ListByCountry(w http.ResponseWriter, r *http.Request) {
	country := QueryParam(r, "country")
	if country == "" {
		Error(w, "VALIDATION", "country required", http.StatusBadRequest)
		return
	}
	profiles, err := h.peps.ListByCountry(r.Context(), country, 100)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"profiles": profiles, "total": len(profiles),
	}, http.StatusOK)
}
