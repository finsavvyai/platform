package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/metrics"
)

// CostSummary serves /api/v1/cost-summary — JSON snapshot of AI spend
// since process start. Powers the in-app cost widget and lets ops verify
// PIPEWARDEN_CHEAP_MODE is actually saving money before flipping it on
// for the full team.
func (h *Handlers) CostSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(metrics.Snapshot())
}
