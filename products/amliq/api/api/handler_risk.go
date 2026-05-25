package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func handleRiskScore(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)

	var req struct {
		EntityID  string  `json:"entity_id"`
		Sanctions float64 `json:"sanctions_score"`
		PEP       float64 `json:"pep_score"`
		Media     float64 `json:"adverse_media_score"`
		Country   string  `json:"country"`
		Industry  float64 `json:"industry_score"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}

	countryScore := domain.CountryRiskScore(req.Country)
	weights := domain.DefaultRiskWeights()
	score := domain.CalculateRiskScore(
		req.EntityID, tid,
		req.Sanctions, req.PEP, req.Media, countryScore, req.Industry,
		weights,
	)

	Success(w, map[string]interface{}{
		"entity_id":       score.EntityID,
		"composite_score": score.CompositeScore,
		"risk_level":      string(score.Level),
		"factors":         score.Factors,
		"breakdown": map[string]float64{
			"sanctions":     score.SanctionsScore,
			"pep":           score.PEPScore,
			"adverse_media": score.AdverseMedia,
			"country":       score.CountryRisk,
			"industry":      score.IndustryRisk,
		},
	}, http.StatusOK)
}
