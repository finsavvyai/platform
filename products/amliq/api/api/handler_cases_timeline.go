package api

import "net/http"

// Timeline returns the full activity log for a case.
func (h *CaseWorkflowHandler) Timeline(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	if caseID == "" {
		Error(w, "MISSING_PARAM", "case id required", http.StatusBadRequest)
		return
	}
	events, _ := h.events.ListByCaseID(r.Context(), caseID, 200)
	comments, _ := h.comments.ListByCaseID(r.Context(), caseID)
	if events == nil {
		events = []CaseEvent{}
	}
	Success(w, map[string]interface{}{
		"case_id":  caseID,
		"events":   events,
		"comments": comments,
		"total":    len(events) + len(comments),
	}, http.StatusOK)
}
