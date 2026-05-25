package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// ListPipelineRuns handles GET /api/v1/pipelines/runs
func (h *Handlers) ListPipelineRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	connName := r.URL.Query().Get("connection")
	owner := r.URL.Query().Get("owner")
	repo := r.URL.Query().Get("repo")
	limitStr := r.URL.Query().Get("limit")

	if connName == "" || owner == "" || repo == "" {
		jsonError(w, "connection, owner, and repo are required", http.StatusBadRequest)
		return
	}

	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	conn, err := h.manager.Get(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	runs, err := conn.Provider.ListPipelineRuns(ctx, owner, repo, limit)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to list runs: %v", err), http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]interface{}{"runs": runs, "count": len(runs)})
}

// ListPipelines handles GET /api/v1/pipelines
func (h *Handlers) ListPipelines(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	connName := r.URL.Query().Get("connection")
	owner := r.URL.Query().Get("owner")
	repo := r.URL.Query().Get("repo")

	if connName == "" || owner == "" || repo == "" {
		jsonError(w, "connection, owner, and repo are required", http.StatusBadRequest)
		return
	}

	conn, err := h.manager.Get(connName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	pipelines, err := conn.Provider.ListPipelines(ctx, owner, repo)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to list pipelines: %v", err), http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]interface{}{"pipelines": pipelines, "count": len(pipelines)})
}
