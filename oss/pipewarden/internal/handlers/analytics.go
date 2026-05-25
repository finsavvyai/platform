package handlers

import (
	"net/http"
	"strconv"
)

// TrendResponse wraps trend data points with query metadata.
type TrendResponse struct {
	Points     interface{} `json:"points"`
	Connection string      `json:"connection,omitempty"`
	Days       int         `json:"days"`
}

// GetTrends handles GET /api/v1/analytics/trends
func (h *Handlers) GetTrends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			days = n
		}
	}
	connection := r.URL.Query().Get("connection")

	points, err := h.db.FindingTrends(connection, days)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, TrendResponse{
		Points:     points,
		Connection: connection,
		Days:       days,
	})
}

// GetSummary handles GET /api/v1/analytics/summary
func (h *Handlers) GetSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	summary, err := h.db.FindingSummary()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, summary)
}

// GetTopFindings handles GET /api/v1/analytics/top-findings
func (h *Handlers) GetTopFindings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	categories, err := h.db.TopFindingCategories(limit)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{"categories": categories, "limit": limit})
}
