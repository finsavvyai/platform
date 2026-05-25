package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// WaitlistRequest is the public POST body for /api/waitlist.
type WaitlistRequest struct {
	Email   string `json:"email"`
	Tier    string `json:"tier,omitempty"`
	Company string `json:"company,omitempty"`
	Source  string `json:"source,omitempty"`
}

// JoinWaitlist persists a website signup when a checkout flow is unavailable
// (e.g. enterprise tier, demo request, or LemonSqueezy not configured). The
// website fallback in pipewarden.com signup modal posts here.
func (h *Handlers) JoinWaitlist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req WaitlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(req.Email)
	if email == "" || !strings.Contains(email, "@") {
		jsonError(w, "valid email is required", http.StatusBadRequest)
		return
	}

	tier := strings.TrimSpace(req.Tier)
	if tier == "" {
		tier = "starter"
	}

	id, err := h.db.CreateWaitlistSignup(storage.WaitlistSignup{
		Email:   email,
		Tier:    tier,
		Company: strings.TrimSpace(req.Company),
		Source:  strings.TrimSpace(req.Source),
	})
	if err != nil {
		h.logger.Errorw("waitlist insert failed", "error", err, "email", email)
		jsonError(w, "could not save signup", http.StatusInternalServerError)
		return
	}

	_ = h.db.AppendAuditLog("waitlist_signup", "anonymous", email, "waitlist",
		map[string]string{"tier": tier, "company": req.Company})

	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":     id,
		"status": "queued",
		"tier":   tier,
	})
}
