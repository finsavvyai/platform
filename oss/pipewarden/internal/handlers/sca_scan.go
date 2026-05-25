package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// SCAScan handles POST /api/v1/sca/scan — operator pastes CI install
// output (or a go.mod), gets back known vulnerabilities from OSV.dev.
//
// Request: {"logs": "..."}  — accepts either npm/pip/gem/cargo/go install
// output OR a raw go.mod. Both extractors run; results are deduped.
//
// Response: {"dependencies": [...], "vulnerabilities": [...findings]}
//
// Calls OSV.dev — operator must have outbound network. Air-gapped
// installs should disable this endpoint at the reverse-proxy layer.
func (h *Handlers) SCAScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20))
	if err != nil {
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()

	var req struct {
		Logs       string `json:"logs"`
		Connection string `json:"connection"`
		RunID      string `json:"run_id"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON: missing or malformed fields"}`, http.StatusBadRequest)
		return
	}
	if req.Logs == "" {
		http.Error(w, `{"error":"'logs' is required"}`, http.StatusBadRequest)
		return
	}

	// Run both extractors and merge.
	deps := analysis.ExtractDependenciesFromLogs(req.Logs)
	deps = append(deps, analysis.ExtractGoModDependencies(req.Logs)...)
	deps = analysis.DedupDependencies(deps)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	scanner := analysis.NewSCAScanner()
	vulns, err := scanner.ScanDependencies(r.Context(), deps)
	if err != nil {
		// Network error: still return extracted deps so the operator can
		// see what was identified, just without vuln data.
		_ = json.NewEncoder(w).Encode(map[string]any{
			"dependencies":    deps,
			"vulnerabilities": []any{},
			"warning":         "OSV query failed: " + err.Error(),
		})
		return
	}

	findings := analysis.VulnsToFindings(req.Connection, req.RunID, vulns)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"dependencies":    deps,
		"vulnerabilities": findings,
	})
}
