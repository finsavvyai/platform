package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// SuppressionRequest is the body for POST /api/v1/findings/{id}/suppress.
type SuppressionRequest struct {
	Reason string `json:"reason"` // "false_positive" | "accepted_risk" | "wont_fix"
	Note   string `json:"note"`
}

var validSuppressionReasons = map[string]bool{
	"false_positive": true,
	"accepted_risk":  true,
	"wont_fix":       true,
}

// SuppressFinding handles POST /api/v1/findings/{id}/suppress.
func (h *Handlers) SuppressFinding(w http.ResponseWriter, r *http.Request) {
	id, ok := parseFindingID(w, r.URL.Path, "/suppress")
	if !ok {
		return
	}

	var req SuppressionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if !validSuppressionReasons[req.Reason] {
		jsonError(w, "invalid reason: must be false_positive, accepted_risk, or wont_fix", http.StatusBadRequest)
		return
	}

	if err := h.db.SuppressFinding(id, req.Reason, req.Note); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{"id": id, "status": "suppressed", "reason": req.Reason})
}

// ReopenFinding handles POST /api/v1/findings/{id}/reopen.
func (h *Handlers) ReopenFinding(w http.ResponseWriter, r *http.Request) {
	id, ok := parseFindingID(w, r.URL.Path, "/reopen")
	if !ok {
		return
	}

	if err := h.db.ReopenFinding(id); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{"id": id, "status": "open"})
}

// parseFindingID extracts an int64 finding ID from a path like /api/v1/findings/{id}/suppress.
func parseFindingID(w http.ResponseWriter, path, suffix string) (int64, bool) {
	base := "/api/v1/findings/"
	trimmed := strings.TrimPrefix(path, base)
	if trimmed == path {
		jsonError(w, "invalid path", http.StatusBadRequest)
		return 0, false
	}
	idStr := strings.TrimSuffix(trimmed, suffix)
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid finding ID", http.StatusBadRequest)
		return 0, false
	}
	return id, true
}
