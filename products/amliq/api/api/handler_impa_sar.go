package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/reports"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ImpaSARHandler exports a stored screening as an IMPA Form 411 SAR
// XML document so a compliance officer can submit it through the
// IMPA online portal without re-keying. The endpoint is tenant-
// scoped: a screening fetched by ID must belong to the caller's
// tenant or the response is 404.
type ImpaSARHandler struct {
	screenings storage.ScreeningRepository
}

func NewImpaSARHandler(s storage.ScreeningRepository) *ImpaSARHandler {
	return &ImpaSARHandler{screenings: s}
}

// Get serves GET /api/v1/reports/impa-sar/{id}.
func (h *ImpaSARHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "auth required",
			http.StatusUnauthorized)
		return
	}
	id := PathParam(r, "id")
	if id == "" {
		Error(w, "MISSING_PARAM", "id required",
			http.StatusBadRequest)
		return
	}
	resp, err := h.screenings.GetByID(id)
	if err != nil {
		Error(w, "DB_ERROR", "lookup failed",
			http.StatusInternalServerError)
		return
	}
	if resp == nil ||
		resp.Request.TenantID.String() != claims.TenantID {
		Error(w, "NOT_FOUND", "screening not found",
			http.StatusNotFound)
		return
	}
	sar, err := reports.BuildImpaSAR(resp)
	if err != nil {
		Error(w, "BUILD_FAILED", err.Error(),
			http.StatusInternalServerError)
		return
	}
	xmlBody, err := reports.MarshalImpaSAR(sar)
	if err != nil {
		Error(w, "MARSHAL_FAILED", err.Error(),
			http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Content-Disposition",
		`attachment; filename="impa-sar-`+id+`.xml"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(xmlBody)
}
