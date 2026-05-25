package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/exports"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListFindings handles GET /api/v1/analysis/findings
func (h *Handlers) ListFindings(w http.ResponseWriter, r *http.Request) {
	connName := r.URL.Query().Get("connection")
	findings, err := h.db.ListFindings(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if findings == nil {
		findings = []storage.FindingRecord{}
	}

	jsonOK(w, map[string]interface{}{"findings": findings, "count": len(findings)})
}

// UpdateFinding handles PATCH /api/v1/analysis/findings/{id}
func (h *Handlers) UpdateFinding(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/analysis/findings/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid finding ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{"open": true, "acknowledged": true, "resolved": true, "false_positive": true}
	if !validStatuses[req.Status] {
		jsonError(w, "invalid status: must be open, acknowledged, resolved, or false_positive", http.StatusBadRequest)
		return
	}

	if err := h.db.UpdateFindingStatus(id, req.Status); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{"id": id, "status": req.Status})
}

// DeleteFinding handles DELETE /api/v1/analysis/findings/{id}
func (h *Handlers) DeleteFinding(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/analysis/findings/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid finding ID", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteFinding(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]string{"status": "deleted"})
}

// ExportFindings handles GET /api/v1/analysis/findings/export
func (h *Handlers) ExportFindings(w http.ResponseWriter, r *http.Request) {
	connName := r.URL.Query().Get("connection")
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	findings, err := h.db.ListFindings(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if findings == nil {
		findings = []storage.FindingRecord{}
	}

	if format == "json" {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=pipewarden-findings.json")
		_ = json.NewEncoder(w).Encode(findings)
		return
	}
	if format == "sarif" {
		exportFindings := make([]exports.Finding, 0, len(findings))
		for _, f := range findings {
			exportFindings = append(exportFindings, exports.Finding{
				ID:          f.ID,
				Title:       f.Title,
				Description: f.Description,
				Severity:    f.Severity,
				File:        f.File,
				Line:        f.Line,
				Confidence:  f.Confidence,
				Category:    f.Category,
			})
		}

		payload, err := exports.ExportSARIF(exportFindings, exports.ExportOptions{
			IncludeRules: true,
			IncludeHelp:  true,
		})
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/sarif+json")
		w.Header().Set("Content-Disposition", "attachment; filename=pipewarden-findings.sarif.json")
		_, _ = w.Write(payload)
		return
	}

	// CSV export
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=pipewarden-findings.csv")
	_, _ = w.Write([]byte("ID,Connection,Run ID,Severity,Category,Title,Description,Remediation,File,Line,Confidence,Status,Created At\n"))

	for _, f := range findings {
		line := fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%d,%.2f,%s,%s\n",
			f.ID,
			csvEscape(f.ConnectionName),
			csvEscape(f.RunID),
			f.Severity,
			f.Category,
			csvEscape(f.Title),
			csvEscape(f.Description),
			csvEscape(f.Remediation),
			csvEscape(f.File),
			f.Line,
			f.Confidence,
			f.Status,
			f.CreatedAt.Format(time.RFC3339),
		)
		_, _ = w.Write([]byte(line))
	}
}
