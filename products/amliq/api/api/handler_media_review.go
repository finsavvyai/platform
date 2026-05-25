package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ReviewMediaRequest holds the review decision.
type ReviewMediaRequest struct {
	Status string `json:"status"`
}

// ReviewMediaHit updates the review status of a media hit.
func ReviewMediaHit(w http.ResponseWriter, r *http.Request) {
	hitID := PathParam(r, "id")
	if hitID == "" {
		Error(w, "MISSING_PARAM", "hit id required", http.StatusBadRequest)
		return
	}
	var req ReviewMediaRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	status := domain.ReviewStatus(req.Status)
	validStatuses := map[domain.ReviewStatus]bool{
		domain.ReviewRelevant:   true,
		domain.ReviewIrrelevant: true,
		domain.ReviewEscalated:  true,
	}
	if !validStatuses[status] {
		Error(w, "INVALID", "status must be relevant, irrelevant, or escalated",
			http.StatusBadRequest)
		return
	}
	// In production, this would update via repository
	Success(w, map[string]interface{}{
		"hit_id": hitID,
		"status": status,
	}, http.StatusOK)
}
