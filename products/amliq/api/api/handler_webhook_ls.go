package api

import (
	"bytes"
	"io"
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
)

type WebhookHandler struct {
	svc *billing.BillingService
}

func NewWebhookHandler(svc *billing.BillingService) *WebhookHandler {
	return &WebhookHandler{svc: svc}
}

func (h *WebhookHandler) Handle(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	signature := req.Header.Get("X-Signature")
	if signature == "" {
		http.Error(w, "Missing signature", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	cfg, err := billing.LoadLemonSqueezyConfig()
	if err != nil {
		http.Error(w, "Config error", http.StatusInternalServerError)
		return
	}

	if err := billing.VerifyWebhookSignature(body, signature, cfg.WebhookSecret); err != nil {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	reader := bytes.NewReader(body)
	event, err := billing.ParseWebhookEvent(reader)
	if err != nil {
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	handler := NewWebhookEventHandler(h.svc)
	if err := billing.HandleWebhookEvent(event, handler); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	Success(w, map[string]string{"status": "processed"}, http.StatusOK)
}
