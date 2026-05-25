package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// RunAnalysis handles POST /api/v1/analysis/run (Claude AI)
func (h *Handlers) RunAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx, end := tracing.Task(r.Context(), "RunAnalysis")
	defer end()

	var req analysis.AnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.ConnectionName == "" || req.Owner == "" || req.Repo == "" || req.RunID == "" {
		jsonError(w, "connection_name, owner, repo, and run_id are required", http.StatusBadRequest)
		return
	}
	if h.claudeAnalyzer == nil || !h.claudeAnalyzer.Enabled() {
		jsonError(w, "Claude API key not configured", http.StatusServiceUnavailable)
		return
	}

	conn, err := h.manager.Get(req.ConnectionName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	endFetch := tracing.Region(ctx, "ProviderFetch")
	run, err := conn.Provider.GetPipelineRun(ctx, req.Owner, req.Repo, req.RunID)
	endFetch()
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to get pipeline run: %v", err), http.StatusBadGateway)
		return
	}

	endClaude := tracing.Region(ctx, "ClaudeAnalyze")
	result, err := h.claudeAnalyzer.AnalyzeRun(ctx, conn, run)
	endClaude()
	if err != nil {
		jsonError(w, fmt.Sprintf("analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	endStore := tracing.Region(ctx, "PersistFindings")
	h.persistFindings(result.Findings)
	endStore()
	h.persistAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: result.ConnectionName,
		RunID:          result.RunID,
		Summary:        result.Summary,
		RiskScore:      result.RiskScore,
		FindingsCount:  len(result.Findings),
		TokensUsed:     result.TokensUsed,
		Model:          result.Model,
		DurationMS:     result.DurationMS,
		AnalyzedAt:     result.AnalyzedAt,
	})
	_ = h.db.AppendAuditLog("scan_completed", "system", req.ConnectionName, "connection",
		map[string]string{"run_id": result.RunID, "model": result.Model, "findings": fmt.Sprintf("%d", len(result.Findings))})
	h.notifyCriticalFindings(result.ConnectionName, result.Findings)

	jsonOK(w, result)
}

// QuickAnalysis handles POST /api/v1/analysis/quick (heuristic)
func (h *Handlers) QuickAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx, end := tracing.Task(r.Context(), "QuickAnalysis")
	defer end()

	var req analysis.AnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.ConnectionName == "" || req.Owner == "" || req.Repo == "" || req.RunID == "" {
		jsonError(w, "connection_name, owner, repo, and run_id are required", http.StatusBadRequest)
		return
	}

	conn, err := h.manager.Get(req.ConnectionName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	endFetch := tracing.Region(ctx, "ProviderFetch")
	run, err := conn.Provider.GetPipelineRun(ctx, req.Owner, req.Repo, req.RunID)
	endFetch()
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to get pipeline run: %v", err), http.StatusBadGateway)
		return
	}

	endAnalyze := tracing.Region(ctx, "HeuristicAnalyze")
	result := h.heuristicAnalyzer.AnalyzeRun(conn, run)
	endAnalyze()

	endStore := tracing.Region(ctx, "PersistFindings")
	h.persistFindings(result.Findings)
	endStore()
	h.persistAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: result.ConnectionName,
		RunID:          result.RunID,
		Summary:        result.Summary,
		RiskScore:      result.RiskScore,
		FindingsCount:  len(result.Findings),
		TokensUsed:     0,
		Model:          "heuristic-v1",
		DurationMS:     result.DurationMS,
		AnalyzedAt:     result.AnalyzedAt,
	})
	_ = h.db.AppendAuditLog("scan_completed", "system", req.ConnectionName, "connection",
		map[string]string{"run_id": result.RunID, "model": "heuristic-v1", "findings": fmt.Sprintf("%d", len(result.Findings))})
	h.notifyCriticalFindings(result.ConnectionName, result.Findings)

	jsonOK(w, result)
}

// ListHistory handles GET /api/v1/analysis/history
func (h *Handlers) ListHistory(w http.ResponseWriter, r *http.Request) {
	connName := r.URL.Query().Get("connection")
	history, err := h.db.ListAnalysisHistory(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if history == nil {
		history = []storage.AnalysisRecord{}
	}

	jsonOK(w, map[string]interface{}{"history": history, "count": len(history)})
}

// GetStats handles GET /api/v1/analysis/stats
func (h *Handlers) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.db.GetFindingStats()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, stats)
}
