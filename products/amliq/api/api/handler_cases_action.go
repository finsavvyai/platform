package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

type CaseActionHandler struct {
	cases storage.CaseRepository
}

func NewCaseActionHandler(c storage.CaseRepository) *CaseActionHandler {
	return &CaseActionHandler{cases: c}
}

type AssignRequest struct {
	UserID string `json:"user_id"`
}

func (h *CaseActionHandler) Assign(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	var req AssignRequest
	if err := DecodeJSON(r, &req); err != nil || req.UserID == "" {
		Error(w, "INVALID", "user_id required", http.StatusBadRequest)
		return
	}
	c.Assign(req.UserID)
	if err := h.cases.Update(r.Context(), *c); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, c, http.StatusOK)
}

func (h *CaseActionHandler) Escalate(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	c.Escalate()
	if err := h.cases.Update(r.Context(), *c); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, c, http.StatusOK)
}

type ResolveRequest struct {
	Resolution string `json:"resolution"`
	TrueMatch  bool   `json:"true_match"`
}

func (h *CaseActionHandler) Resolve(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var req ResolveRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	userID := ""
	if claims != nil {
		userID = claims.UserID
	}
	if err := c.Resolve(userID, req.Resolution, req.TrueMatch); err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.cases.Update(r.Context(), *c); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}
	Success(w, c, http.StatusOK)
}
