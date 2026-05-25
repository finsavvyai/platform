package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// RuntimeScan handles POST /api/v1/connections/{name}/scan/runtime.
// It accepts raw pipeline execution log text, detects anomalous patterns,
// persists findings to the database, and returns the results.
func (h *Handlers) RuntimeScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	connName := extractConnNameFromRuntimePath(r.URL.Path)
	if connName == "" {
		jsonError(w, "missing connection name", http.StatusBadRequest)
		return
	}

	var req analysis.RuntimeScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Logs == "" {
		jsonError(w, "logs field is required", http.StatusBadRequest)
		return
	}

	runtimeFindings := analysis.ScanRuntimeLogs(req)

	now := time.Now().UTC()
	for _, rf := range runtimeFindings {
		rec := &storage.FindingRecord{
			ConnectionName: connName,
			RunID:          req.RunID,
			Severity:       rf.Severity,
			Category:       rf.Category,
			Title:          "Runtime: " + rf.Pattern,
			Description:    rf.Description,
			Remediation:    "Review the offending log line and remove or fix the flagged command.",
			Status:         "open",
			Confidence:     0.85,
			CreatedAt:      now,
		}
		// Best-effort persist; non-fatal on error
		_ = h.db.CreateFinding(rec)
	}

	jsonOK(w, map[string]interface{}{
		"connection": connName,
		"run_id":     req.RunID,
		"findings":   runtimeFindings,
		"count":      len(runtimeFindings),
	})
}

// extractConnNameFromRuntimePath parses the connection name out of a path
// matching /api/v1/connections/{name}/scan/runtime.
func extractConnNameFromRuntimePath(path string) string {
	trimmed := strings.TrimPrefix(path, "/api/v1/connections/")
	trimmed = strings.TrimSuffix(trimmed, "/scan/runtime")
	return trimmed
}
