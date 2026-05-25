package handlers

import (
	"net/http"
	"strings"
	"time"
)

// EmbedSummary holds severity counts and risk score for the embed widget.
type EmbedSummary struct {
	Critical  int `json:"critical"`
	High      int `json:"high"`
	Medium    int `json:"medium"`
	Low       int `json:"low"`
	RiskScore int `json:"risk_score"`
	Total     int `json:"total"`
}

// EmbedFinding represents a finding for the embed widget.
type EmbedFinding struct {
	ID             int64     `json:"id"`
	ConnectionName string    `json:"connection_name"`
	RunID          string    `json:"run_id"`
	Severity       string    `json:"severity"`
	Category       string    `json:"category"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

// EmbedFindingsResponse wraps findings for the embed widget.
type EmbedFindingsResponse struct {
	Findings []EmbedFinding `json:"findings"`
	Count    int            `json:"count"`
}

// EmbedFindings handles GET /api/v1/embed/findings with CORS support.
func (h *Handlers) EmbedFindings(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	severity := r.URL.Query().Get("severity")
	platform := r.URL.Query().Get("platform")
	status := r.URL.Query().Get("status")
	_ = h.parseTenantID(r)

	// Optional API key validation for embed widget access
	if apiKeyConn, present, ok := h.ValidateEmbedAPIKey(w, r); !ok {
		return
	} else if present {
		_ = apiKeyConn // key validated; connection scope available if needed
	}

	connName := r.URL.Query().Get("connection")
	findings, err := h.db.ListFindings(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	connectionPlatforms := map[string]string{}
	if platform != "" {
		connections, err := h.db.List()
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		for _, conn := range connections {
			connectionPlatforms[conn.Name] = conn.Platform
		}
	}

	filtered := make([]EmbedFinding, 0, len(findings))
	for _, f := range findings {
		if severity != "" && !strings.EqualFold(f.Severity, severity) {
			continue
		}
		if status != "" && !strings.EqualFold(f.Status, status) {
			continue
		}
		if platform != "" && !strings.EqualFold(connectionPlatforms[f.ConnectionName], platform) {
			continue
		}
		filtered = append(filtered, EmbedFinding{
			ID: f.ID, ConnectionName: f.ConnectionName, RunID: f.RunID,
			Severity: f.Severity, Category: f.Category, Title: f.Title,
			Description: f.Description, Status: f.Status, CreatedAt: f.CreatedAt,
		})
	}
	if filtered == nil {
		filtered = []EmbedFinding{}
	}
	jsonOK(w, EmbedFindingsResponse{Findings: filtered, Count: len(filtered)})
}
