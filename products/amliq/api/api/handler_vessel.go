package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

type VesselHandler struct {
	entities storage.EntityRepository
	matcher  *screening.VesselMatcher
}

func NewVesselHandler(
	entities storage.EntityRepository,
) *VesselHandler {
	return &VesselHandler{
		entities: entities,
		matcher:  screening.NewVesselMatcher(),
	}
}

type VesselScreenRequest struct {
	VesselName string `json:"vessel_name"`
	IMO        string `json:"imo,omitempty"`
	MMSI       string `json:"mmsi,omitempty"`
	Flag       string `json:"flag,omitempty"`
}

type VesselScreenResult struct {
	MatchID      string                 `json:"match_id"`
	VesselName   string                 `json:"vessel_name"`
	ListSource   string                 `json:"list_source"`
	Confidence   float64                `json:"confidence"`
	RuleID       string                 `json:"rule_id"`
	Explanation  string                 `json:"explanation"`
	VesselDetails map[string]interface{} `json:"vessel_details"`
}

func (vh *VesselHandler) HandleScreen(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodPost {
		Error(w, "METHOD_NOT_ALLOWED", "POST required",
			http.StatusMethodNotAllowed)
		return
	}

	_, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	var req VesselScreenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_JSON", "malformed request",
			http.StatusBadRequest)
		return
	}

	if req.VesselName == "" {
		Error(w, "MISSING_FIELD", "vessel_name required",
			http.StatusBadRequest)
		return
	}

	// Create query entity
	queryName, _ := domain.NewName(req.VesselName, "", "", "")
	queryMeta := map[string]interface{}{
		"imo":  req.IMO,
		"mmsi": req.MMSI,
		"flag": req.Flag,
	}

	// Search for matching vessel entities
	allEntities, err := vh.entities.ListAll()
	if err != nil {
		Error(w, "DB_ERROR", "entity lookup failed",
			http.StatusInternalServerError)
		return
	}

	var results []VesselScreenResult
	for _, entity := range allEntities {
		// Skip non-vessel entities
		if entity.Type != domain.EntityTypeVessel {
			continue
		}
		candMeta := []map[string]interface{}{}
		for range entity.Names {
			candMeta = append(candMeta, entity.Metadata)
		}

		evidence := vh.matcher.Match(
			queryName,
			entity.Names,
			queryMeta,
			candMeta,
		)

		for _, ev := range evidence {
			result := VesselScreenResult{
				MatchID:      entity.ID.String(),
				VesselName:   entity.PrimaryName().Full,
				ListSource:   entity.ListID,
				Confidence:   ev.Score,
				RuleID:       ev.Algorithm,
				Explanation:  ev.Explanation,
				VesselDetails: entity.Metadata,
			}
			results = append(results, result)
		}
	}

	Success(w, map[string]interface{}{
		"matches": results,
		"total":   len(results),
	}, http.StatusOK)
}
