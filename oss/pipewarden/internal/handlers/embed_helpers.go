package handlers

import (
	"net/http"
)

// EmbedSummary handles GET /api/v1/embed/summary with CORS support.
func (h *Handlers) EmbedSummary(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Optional API key validation for embed widget access
	if _, present, ok := h.ValidateEmbedAPIKey(w, r); !ok {
		return
	} else if present {
		// key validated; proceed
		_ = present
	}

	connName := r.URL.Query().Get("connection")
	_ = h.parseTenantID(r)

	findings, err := h.db.ListFindings(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	summary := EmbedSummary{}
	for _, f := range findings {
		summary.Total++
		switch f.Severity {
		case "critical":
			summary.Critical++
		case "high":
			summary.High++
		case "medium":
			summary.Medium++
		case "low":
			summary.Low++
		}
	}
	summary.RiskScore = calculateRiskScore(summary)
	jsonOK(w, summary)
}

// EmbedConfig handles GET /api/v1/embed/config with CORS support.
func (h *Handlers) EmbedConfig(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	jsonOK(w, map[string]interface{}{
		"embed_url":        "/static/embed.html",
		"version":          "1.0",
		"refresh_interval": 60000,
		"max_findings":     1000,
		"theme":            "dark",
		"features": map[string]bool{
			"filtering":  true,
			"pagination": true,
			"export":     false,
		},
	})
}

// calculateRiskScore computes an overall risk score (0-100) based on findings.
func calculateRiskScore(summary EmbedSummary) int {
	if summary.Total == 0 {
		return 0
	}
	score := (summary.Critical * 10) + (summary.High * 5) + (summary.Medium * 2) + summary.Low
	normalized := (score * 100) / (10 * summary.Total)
	if normalized > 100 {
		normalized = 100
	}
	return normalized
}

// setCORSHeaders sets permissive CORS headers for embed endpoints.
func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// parseTenantID extracts tenant_id from query or header for multi-tenant filtering.
func (h *Handlers) parseTenantID(r *http.Request) string {
	if tid := r.URL.Query().Get("tenant_id"); tid != "" {
		return tid
	}
	if tid := r.Header.Get("X-Tenant-ID"); tid != "" {
		return tid
	}
	return ""
}
