package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ScanHistory handles POST /api/v1/connections/{name}/scan/history.
// It decodes a HistoryScanRequest, runs the history DLP scanner, persists
// each finding to the database, and returns the HistoryScanResult.
func (h *Handlers) ScanHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract connection name from path: /api/v1/connections/{name}/scan/history
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	parts := strings.SplitN(path, "/", 3)
	if len(parts) < 1 || parts[0] == "" {
		jsonError(w, "connection name required", http.StatusBadRequest)
		return
	}
	connName := parts[0]

	var req analysis.HistoryScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if len(req.Commits) == 0 {
		jsonError(w, "commits are required", http.StatusBadRequest)
		return
	}

	result := analysis.ScanHistory(req)

	for i := range result.Findings {
		f := &result.Findings[i]
		rec := &storage.FindingRecord{
			ConnectionName: connName,
			RunID:          "history-" + f.SHA,
			Severity:       string(analysis.SeverityCritical),
			Category:       string(analysis.CategorySecrets),
			Title:          "Historical secret: " + f.PatternName,
			Description:    "Secret detected in git history at " + f.File + ":" + itoa(f.LineNumber),
			Remediation:    "Rotate this credential immediately and purge from git history using git filter-repo.",
			File:           f.File,
			Line:           f.LineNumber,
			Confidence:     0.95,
			Status:         "open",
			CreatedAt:      time.Now().UTC(),
		}
		if err := h.db.CreateFinding(rec); err != nil {
			h.logger.Errorw("failed to persist history finding", "error", err)
		}
	}

	jsonOK(w, result)
}

// itoa converts an int to its string representation without importing strconv
// at the package level (already available via fmt in response.go).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	buf := make([]byte, 20)
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}
