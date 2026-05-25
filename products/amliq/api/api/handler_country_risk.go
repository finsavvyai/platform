package api

import (
	"net/http"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CountryRiskHandler struct {
	index *domain.CountryRiskIndex
}

func NewCountryRiskHandler(
	index *domain.CountryRiskIndex,
) *CountryRiskHandler {
	return &CountryRiskHandler{index: index}
}

type CountryRiskEntryResponse struct {
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Score     float64  `json:"score"`
	Level     string   `json:"level"`
	Sources   []string `json:"sources"`
	UpdatedAt string   `json:"updated_at"`
}

func (h *CountryRiskHandler) GetByCode(
	w http.ResponseWriter,
	r *http.Request,
) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		Error(w, "MISSING_PARAM", "country code required",
			http.StatusBadRequest)
		return
	}

	entry, ok := h.index.Entry(code)
	if !ok {
		Error(w, "NOT_FOUND", "country risk entry not found",
			http.StatusNotFound)
		return
	}

	Success(w, CountryRiskEntryResponse{
		Code:      entry.Code,
		Name:      entry.Name,
		Score:     entry.Score,
		Level:     string(entry.Level),
		Sources:   entry.Sources,
		UpdatedAt: entry.UpdatedAt,
	}, http.StatusOK)
}

type ListCountryRiskResponse struct {
	Entries []CountryRiskEntryResponse `json:"entries"`
	Count   int                        `json:"count"`
}

func (h *CountryRiskHandler) ListAll(
	w http.ResponseWriter,
	r *http.Request,
) {
	var entries []CountryRiskEntryResponse
	codes := []string{"US", "GB", "DE", "FR", "JP", "CN", "IR", "KP", "SY"}
	for _, code := range codes {
		if entry, ok := h.index.Entry(code); ok {
			resp := CountryRiskEntryResponse{
				Code:      entry.Code,
				Name:      entry.Name,
				Score:     entry.Score,
				Level:     string(entry.Level),
				Sources:   entry.Sources,
				UpdatedAt: entry.UpdatedAt,
			}
			entries = append(entries, resp)
		}
	}

	Success(w, ListCountryRiskResponse{
		Entries: entries,
		Count:   len(entries),
	}, http.StatusOK)
}
