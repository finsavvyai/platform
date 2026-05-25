package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/reporting"
	"github.com/aegis-aml/aegis/internal/storage"
)

// SARReportingHandler manages SAR and compliance report endpoints.
type SARReportingHandler struct {
	sars       storage.SARRepository
	cases      storage.CaseQueryRepository
	screenings storage.ScreeningRepository
	alerts     storage.AlertRepository
	generator  *reporting.SARGenerator
}

// NewSARReportingHandler creates the handler with dependencies.
func NewSARReportingHandler(
	sars storage.SARRepository,
	cases storage.CaseQueryRepository,
	screenings storage.ScreeningRepository,
	alerts storage.AlertRepository,
	gen *reporting.SARGenerator,
) *SARReportingHandler {
	return &SARReportingHandler{
		sars:       sars,
		cases:      cases,
		screenings: screenings,
		alerts:     alerts,
		generator:  gen,
	}
}

// GenerateSARRequest is the request body.
type GenerateSARRequest struct {
	CaseID       string `json:"case_id"`
	SubjectName  string `json:"subject_name"`
	SubjectType  string `json:"subject_type"`
	ActivityType string `json:"activity_type"`
	Regulator    string `json:"regulator"`
}

// GenerateSAR creates a draft SAR from case data.
func (h *SARReportingHandler) GenerateSAR(
	w http.ResponseWriter, r *http.Request,
) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req GenerateSARRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	actType := domain.SARActivityType(req.ActivityType)
	if !domain.ValidActivityType(actType) {
		Error(w, "INVALID", "invalid activity type", http.StatusBadRequest)
		return
	}
	regBody := domain.RegulatoryBody(req.Regulator)
	ev := reporting.CaseEvidence{
		CaseID:      req.CaseID,
		SubjectName: req.SubjectName,
		SubjectType: req.SubjectType,
	}
	sar, err := h.generator.GenerateSAR(r.Context(), tid, ev, regBody)
	if err != nil {
		Error(w, "GENERATION_FAILED", err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.sars.Create(r.Context(), *sar); err != nil {
		Error(w, "PERSIST_FAILED", err.Error(), http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{"sar": sar}, http.StatusCreated)
}
