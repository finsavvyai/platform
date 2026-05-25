package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type CaseHandler struct {
	cases    storage.CaseRepository
	queries  storage.CaseQueryRepository
	comments storage.CaseCommentRepository
}

func NewCaseHandler(
	c storage.CaseRepository,
	q storage.CaseQueryRepository,
	cm storage.CaseCommentRepository,
) *CaseHandler {
	return &CaseHandler{cases: c, queries: q, comments: cm}
}

func (h *CaseHandler) ListCases(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	status := QueryParam(r, "status")
	cases, err := h.queries.ListByTenant(r.Context(), tid, status, 100)
	if err != nil {
		Error(w, "INTERNAL", "failed to list cases", http.StatusInternalServerError)
		return
	}
	priority := QueryParam(r, "priority")
	if priority != "" {
		cases = filterByPriority(cases, domain.CasePriority(priority))
	}
	if cases == nil {
		cases = []domain.ComplianceCase{}
	}
	Success(w, map[string]interface{}{
		"cases": cases, "total": len(cases),
	}, http.StatusOK)
}

func filterByPriority(
	cases []domain.ComplianceCase, p domain.CasePriority,
) []domain.ComplianceCase {
	var filtered []domain.ComplianceCase
	for _, c := range cases {
		if c.Priority == p {
			filtered = append(filtered, c)
		}
	}
	return filtered
}

func (h *CaseHandler) GetCase(w http.ResponseWriter, r *http.Request) {
	caseID := PathParam(r, "id")
	if caseID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}
	c, err := h.cases.GetByID(r.Context(), caseID)
	if err != nil || c == nil {
		Error(w, "NOT_FOUND", "case not found", http.StatusNotFound)
		return
	}
	comments, _ := h.comments.ListByCaseID(r.Context(), caseID)
	Success(w, map[string]interface{}{
		"case": c, "comments": comments,
	}, http.StatusOK)
}
