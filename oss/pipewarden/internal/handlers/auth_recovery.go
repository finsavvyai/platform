package handlers

import (
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/auth"
)

// AuthRecoveryGenerate issues a fresh batch of recovery codes for the
// signed-in user, invalidating any prior batch. The user must save the
// returned codes immediately — we only persist hashes.
func (h *Handlers) AuthRecoveryGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	codes, err := h.db.GenerateRecoveryCodes(claims.UserID)
	if err != nil {
		jsonError(w, "generate codes: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{
		"codes": codes,
		"note":  "Save these now — we never show them again. Each code works once. Use one if you lose access to your authenticator.",
	})
}

// AuthRecoveryStatus returns the count of unused codes — surface in
// /settings/ so the user knows when to regenerate.
func (h *Handlers) AuthRecoveryStatus(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	n, err := h.db.CountUnusedRecoveryCodes(claims.UserID)
	if err != nil {
		jsonError(w, "count: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"unused_codes": n})
}
