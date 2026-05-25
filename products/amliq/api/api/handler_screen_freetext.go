package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

type freeTextRequest struct {
	Text      string  `json:"text"`
	Threshold float64 `json:"threshold,omitempty"`
}

func freeTextScreenHandler(
	entities storage.EntityRepository,
	engine *screening.Engine,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req freeTextRequest
		if err := DecodeJSON(r, &req); err != nil {
			Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
			return
		}
		if req.Text == "" {
			Error(w, "VALIDATION", "text required", http.StatusBadRequest)
			return
		}
		if req.Threshold <= 0 {
			req.Threshold = 0.5
		}
		if len(req.Text) > 50000 {
			Error(w, "VALIDATION", "text too long (max 50K)", http.StatusBadRequest)
			return
		}

		start := time.Now()
		names := screening.ExtractNames(req.Text)
		var results []map[string]interface{}

		for _, n := range names {
			candidates := searchCandidates(entities, n.Name, nil, 0.1)
			if len(candidates) == 0 {
				continue
			}
			query := screening.BuildQueryEntity(n.Name)
			matches, err := engine.Screen(query, candidates)
			if err != nil || len(matches) == 0 {
				continue
			}
			filtered := filterByThreshold(matches, req.Threshold)
			if len(filtered) == 0 {
				continue
			}
			risk := classifyRisk(filtered[0].Confidence.Score())
			topMatch := matchToDetailMap(filtered[0], nil)
			results = append(results, map[string]interface{}{
				"extracted_name": n.Name,
				"position":       n.Position,
				"risk_level":     risk,
				"top_match":      topMatch,
				"match_count":    len(filtered),
			})
		}

		elapsed := time.Since(start).Milliseconds()
		Success(w, map[string]interface{}{
			"names_extracted": len(names),
			"matches_found":   len(results),
			"processing_ms":   elapsed,
			"results":         results,
			"text_length":     len(req.Text),
		}, http.StatusOK)
	}
}

func classifyRisk(score float64) string {
	if score > 0.8 {
		return "HIGH"
	}
	if score > 0.5 {
		return "MEDIUM"
	}
	return "LOW"
}
