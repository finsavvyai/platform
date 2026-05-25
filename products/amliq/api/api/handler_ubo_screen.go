package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

type UBOScreenHandler struct {
	ubos       storage.UBORepository
	screenings storage.ScreeningRepository
}

func NewUBOScreenHandler(
	ubos storage.UBORepository,
	screenings storage.ScreeningRepository,
) *UBOScreenHandler {
	return &UBOScreenHandler{ubos: ubos, screenings: screenings}
}

type UBOScreenResult struct {
	OwnerID           string  `json:"owner_id"`
	OwnerName         string  `json:"owner_name"`
	OwnershipPct      float64 `json:"ownership_pct"`
	Matches           int     `json:"matches"`
	HighestConfidence float64 `json:"highest_confidence"`
	Flagged           bool    `json:"flagged"`
}

func (h *UBOScreenHandler) ScreenChain(w http.ResponseWriter, r *http.Request) {
	orgID := PathParam(r, "id")
	if orgID == "" {
		Error(w, "MISSING_PARAM", "org id required", http.StatusBadRequest)
		return
	}
	owners, err := h.ubos.ListByOrg(r.Context(), orgID)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	var results []UBOScreenResult
	for _, owner := range owners {
		result := UBOScreenResult{
			OwnerID:      owner.ID,
			OwnerName:    owner.OwnerName,
			OwnershipPct: owner.OwnershipPct,
			Flagged:      owner.Status == "flagged",
		}
		results = append(results, result)
	}
	Success(w, map[string]interface{}{
		"organization_id": orgID,
		"screening_time":  "2024-01-15T10:30:00Z",
		"results":         results,
	}, http.StatusOK)
}
