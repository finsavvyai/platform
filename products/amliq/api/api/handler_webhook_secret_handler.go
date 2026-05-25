package api

import "net/http"

// WebhookSecretHandler exposes Get + Rotate over HTTP for the
// dashboard's webhook-config screen. Tenant resolved from JWT
// claims so callers can only manage their own secret.
type WebhookSecretHandler struct {
	store *WebhookSecretStore
}

func NewWebhookSecretHandler(store *WebhookSecretStore) *WebhookSecretHandler {
	return &WebhookSecretHandler{store: store}
}

type secretResponse struct {
	Secret       string `json:"secret"`
	Rotated      bool   `json:"rotated"`
	Instructions string `json:"instructions"`
}

func (h *WebhookSecretHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	sec, err := h.store.Get(claims.TenantID)
	if err != nil {
		http.Error(w, "failed to get secret", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, secretResponse{
		Secret:       sec,
		Instructions: "Include header X-AMLIQ-Signature: t=<unix>,v1=<hex-hmac-sha256>",
	})
}

func (h *WebhookSecretHandler) Rotate(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	sec, err := h.store.Rotate(claims.TenantID)
	if err != nil {
		http.Error(w, "failed to rotate secret", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, secretResponse{
		Secret: sec, Rotated: true,
		Instructions: "Previous secret is now invalid. Update all integrations.",
	})
}
