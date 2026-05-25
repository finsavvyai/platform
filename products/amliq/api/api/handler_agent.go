package api

import (
	"encoding/json"
	"net/http"
	"time"
)

// AgentHandler handles on-premise agent management endpoints.
type AgentHandler struct{}

// NewAgentHandler creates a new agent handler.
func NewAgentHandler() *AgentHandler {
	return &AgentHandler{}
}

type agentRegisterReq struct {
	AgentID  string `json:"agent_id"`
	Hostname string `json:"hostname"`
	Version  string `json:"version"`
}

type agentRegisterResp struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Register handles POST /api/v1/agent/register.
func (h *AgentHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req agentRegisterReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.AgentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id required"})
		return
	}
	resp := agentRegisterResp{
		Token:     "agt_" + req.AgentID,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	}
	writeJSON(w, http.StatusOK, resp)
}

// LatestLists handles GET /api/v1/agent/lists/latest.
func (h *AgentHandler) LatestLists(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version":    "2026-04-05",
		"entity_count": 0,
		"entities":   []interface{}{},
	})
}

// DeltaLists handles GET /api/v1/agent/lists/delta?since=2026-04-01.
func (h *AgentHandler) DeltaLists(w http.ResponseWriter, r *http.Request) {
	since := r.URL.Query().Get("since")
	if since == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "since parameter required"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"since":   since,
		"added":   []interface{}{},
		"removed": []interface{}{},
		"updated": []interface{}{},
	})
}

type agentResultsReq struct {
	AgentID    string `json:"agent_id"`
	AlertCount int    `json:"alert_count"`
	ScanType   string `json:"scan_type"`
}

// ReportResults handles POST /api/v1/agent/results.
func (h *AgentHandler) ReportResults(w http.ResponseWriter, r *http.Request) {
	var req agentResultsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.AgentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id required"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "received",
	})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
