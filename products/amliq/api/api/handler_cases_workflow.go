package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// CaseWorkflowHandler manages case transitions, evidence, and timeline.
type CaseWorkflowHandler struct {
	cases    storage.CaseRepository
	comments storage.CaseCommentRepository
	events   CaseEventRepository
}

// NewCaseWorkflowHandler creates a workflow handler.
func NewCaseWorkflowHandler(
	c storage.CaseRepository,
	cm storage.CaseCommentRepository,
	ev CaseEventRepository,
) *CaseWorkflowHandler {
	return &CaseWorkflowHandler{cases: c, comments: cm, events: ev}
}

// TransitionRequest holds the desired status change.
type TransitionRequest struct {
	ToStatus string `json:"to_status"`
	Comment  string `json:"comment"`
}

// Transition validates and applies a case status change.
func (h *CaseWorkflowHandler) Transition(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	var req TransitionRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	to := domain.CaseStatus(req.ToStatus)
	if err := c.Transition(to, req.Comment); err != nil {
		Error(w, "INVALID_TRANSITION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.cases.Update(r.Context(), *c); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	next := domain.ValidNextStatuses(c.Status)
	Success(w, map[string]interface{}{
		"case": c, "valid_transitions": next,
	}, http.StatusOK)
}

// AddEvidence attaches evidence to a case.
func (h *CaseWorkflowHandler) AddEvidence(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	var req struct {
		Type    string `json:"type"`
		Content string `json:"content"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	userID := ""
	if claims != nil {
		userID = claims.UserID
	}
	ev, err := domain.NewEvidence(caseID, domain.EvidenceType(req.Type), req.Content, userID)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	Success(w, ev, http.StatusCreated)
}

