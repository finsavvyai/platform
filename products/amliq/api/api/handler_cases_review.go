package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// FourEyesReviewRequest represents a dual-approval submission.
type FourEyesReviewRequest struct {
	Disposition   string `json:"disposition"`
	Justification string `json:"justification"`
}

func handleFourEyesSubmit(cases storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID := GetTenantID(r)
		if tenantID == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}
		caseID := r.PathValue("id")
		if caseID == "" {
			Error(w, "MISSING_PARAM", "case id required", http.StatusBadRequest)
			return
		}

		var req FourEyesReviewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, "INVALID_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}

		c, err := cases.GetByID(r.Context(), caseID)
		if err != nil || c == nil {
			Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
			return
		}

		// If first review, move to pending_review
		if c.Status == "open" || c.Status == "in_review" {
			if err := cases.UpdateStatus(r.Context(), caseID, "pending_review"); err != nil {
				Error(w, "INTERNAL", "update failed", http.StatusInternalServerError)
				return
			}
			Success(w, map[string]string{
				"status":  "pending_review",
				"message": "First review submitted. Awaiting second reviewer.",
			}, http.StatusOK)
			return
		}

		// If already pending_review, this is the confirming review
		if c.Status == "pending_review" {
			if err := cases.UpdateStatus(r.Context(), caseID, req.Disposition); err != nil {
				Error(w, "INTERNAL", "resolve failed", http.StatusInternalServerError)
				return
			}
			Success(w, map[string]string{
				"status":  req.Disposition,
				"message": "Four-eyes review complete. Case resolved.",
			}, http.StatusOK)
			return
		}

		Error(w, "INVALID_STATE", "case not in reviewable state", http.StatusConflict)
	}
}
