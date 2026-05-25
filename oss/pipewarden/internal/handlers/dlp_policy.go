package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"encoding/json"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/policy"
	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// DLPScanRequest represents a DLP scan request
type DLPScanRequest struct {
	Content    string `json:"content"`
	Source     string `json:"source"`
	Connection string `json:"connection,omitempty"`
	RunID      string `json:"run_id,omitempty"`
}

// PolicyEvaluateRequest represents a policy evaluation request
type PolicyEvaluateRequest struct {
	ConnectionName string                 `json:"connection_name"`
	Owner          string                 `json:"owner"`
	Repo           string                 `json:"repo"`
	RunID          string                 `json:"run_id"`
	PolicyNames    []string               `json:"policy_names,omitempty"`
	Input          map[string]interface{} `json:"input,omitempty"`
}

// ScanDLP handles POST /api/v1/dlp/scan
func (h *Handlers) ScanDLP(w http.ResponseWriter, r *http.Request) {
	ctx, end := tracing.Task(r.Context(), "ScanDLP")
	defer end()
	_ = ctx

	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DLPScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		jsonError(w, "content is required", http.StatusBadRequest)
		return
	}

	// Perform DLP scan
	dlpScanner := analysis.NewDLPScanner()
	source := req.Source
	if source == "" {
		source = "inline"
	}
	endScan := tracing.Region(ctx, "DLPScan")
	matches := dlpScanner.ScanContent(req.Content, source)
	endScan()

	response := map[string]interface{}{
		"source":    source,
		"matches":   matches,
		"count":     len(matches),
		"scannedAt": time.Now(),
	}

	// If run context provided, persist findings
	if req.Connection != "" && req.RunID != "" {
		for _, match := range matches {
			finding := &analysis.Finding{
				ConnectionName: req.Connection,
				RunID:          req.RunID,
				Title:          fmt.Sprintf("Potential secret detected: %s", match.Pattern),
				Description:    fmt.Sprintf("Detected potential %s in %s", match.Pattern, req.Source),
				Severity:       analysis.SeverityHigh,
				Category:       analysis.CategorySecrets,
				Confidence:     match.Confidence,
				Status:         "open",
				File:           req.Source,
			}
			h.persistFinding(finding)
		}
	}

	jsonOK(w, response)
}

// EvaluatePolicy handles POST /api/v1/policy/evaluate
func (h *Handlers) EvaluatePolicy(w http.ResponseWriter, r *http.Request) {
	traceCtx, end := tracing.Task(r.Context(), "EvaluatePolicy")
	defer end()

	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PolicyEvaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.ConnectionName == "" || req.Owner == "" || req.Repo == "" || req.RunID == "" {
		jsonError(w, "connection_name, owner, repo, and run_id are required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(traceCtx, 30*time.Second)
	defer cancel()

	conn, err := h.manager.Get(req.ConnectionName)
	if err != nil {
		jsonError(w, fmt.Sprintf("connection not found: %v", err), http.StatusNotFound)
		return
	}

	run, err := conn.Provider.GetPipelineRun(ctx, req.Owner, req.Repo, req.RunID)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to get pipeline run: %v", err), http.StatusBadGateway)
		return
	}

	// Build pipeline context from run metadata
	pipelineCtx := &policy.PipelineContext{
		Platform: string(conn.Platform),
		Branch:   run.Branch,
		HasTests: containsStep(run.Steps, "test"),
		HasLint:  containsStep(run.Steps, "lint"),
		HasSAST:  containsStep(run.Steps, "sast"),
		HasSBOM:  containsStep(run.Steps, "sbom"),
	}

	// Evaluate policies
	evaluator := policy.NewEvaluator()
	violations := evaluator.Evaluate(pipelineCtx)

	response := map[string]interface{}{
		"connection": req.ConnectionName,
		"runID":      req.RunID,
		"violations": violations,
		"count":      len(violations),
		"passed":     len(violations) == 0,
		"timestamp":  time.Now(),
	}

	jsonOK(w, response)
}

// persistFinding is a helper to persist a single finding
func (h *Handlers) persistFinding(finding *analysis.Finding) {
	h.persistFindings([]analysis.Finding{*finding})
}

// containsStep checks if a step name is in the steps list
func containsStep(steps []integrations.PipelineStep, name string) bool {
	for _, step := range steps {
		if strings.Contains(strings.ToLower(step.Name), strings.ToLower(name)) {
			return true
		}
	}
	return false
}
