package api

import (
	"context"
	"net/http"
)

// CaseEventRepository reads case activity events.
type CaseEventRepository interface {
	ListByCaseID(ctx context.Context, caseID string, limit int) ([]CaseEvent, error)
}

// CaseEvent is a single activity event for a case.
type CaseEvent struct {
	ID        int64  `json:"id"`
	CaseID    string `json:"case_id"`
	EventType string `json:"event_type"`
	Actor     string `json:"actor"`
	Details   string `json:"details"`
	CreatedAt string `json:"created_at"`
}

func handleCaseActivity(events CaseEventRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		caseID := r.PathValue("id")
		if caseID == "" {
			Error(w, "MISSING_PARAM", "case id required", http.StatusBadRequest)
			return
		}
		list, err := events.ListByCaseID(r.Context(), caseID, 100)
		if err != nil {
			Error(w, "INTERNAL", "list events failed", http.StatusInternalServerError)
			return
		}
		if list == nil {
			list = []CaseEvent{}
		}
		Success(w, map[string]interface{}{
			"case_id":  caseID,
			"events":   list,
			"total":    len(list),
		}, http.StatusOK)
	}
}
