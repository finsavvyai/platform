package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/email"
	"github.com/aegis-aml/aegis/internal/notification"
)

// AlertSendHandler sends user-facing alerts via email/SMS/WhatsApp.
type AlertSendHandler struct {
	email    email.Sender
	sms      notification.SMSSender
	whatsapp *notification.WhatsAppSender
}

func NewAlertSendHandler() *AlertSendHandler {
	return &AlertSendHandler{
		email:    email.NewSender(),
		sms:      notification.NewSMSSender(),
		whatsapp: notification.NewWhatsAppSender(),
	}
}

type alertSendReq struct {
	Channel  string                   `json:"channel"` // email | sms | whatsapp
	To       string                   `json:"to"`
	Subject  string                   `json:"subject,omitempty"`
	Body     string                   `json:"body,omitempty"`
	Template notification.TemplateKey `json:"template,omitempty"` // internal
	Vars     *notification.AlertVars  `json:"vars,omitempty"`

	// WhatsApp pre-approved Content Templates (Meta-approved)
	ContentSID string            `json:"content_sid,omitempty"` // HX...
	Variables  map[string]string `json:"variables,omitempty"`   // "1":"x"
}

type alertSendResp struct {
	Sent    bool   `json:"sent"`
	Channel string `json:"channel"`
}

// Send — POST /api/v1/alerts/send
func (h *AlertSendHandler) Send(w http.ResponseWriter, r *http.Request) {
	var req alertSendReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.To == "" {
		http.Error(w, "'to' required", http.StatusBadRequest)
		return
	}

	// Render from internal template if provided
	if req.Template != "" && req.Vars != nil {
		subj, body, err := notification.Render(req.Template, *req.Vars)
		if err != nil {
			http.Error(w, "template: "+err.Error(), http.StatusBadRequest)
			return
		}
		if subj != "" {
			req.Subject = subj
		}
		req.Body = body
	}

	// For WhatsApp with ContentSID, body not required
	if req.Body == "" && req.ContentSID == "" {
		http.Error(w, "'body', 'template'+'vars', or 'content_sid' required",
			http.StatusBadRequest)
		return
	}

	if err := h.dispatch(req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, alertSendResp{Sent: true, Channel: req.Channel})
}

func (h *AlertSendHandler) dispatch(req alertSendReq) error {
	switch req.Channel {
	case "email":
		if req.Subject == "" {
			req.Subject = "AMLIQ Alert"
		}
		return h.email.Send(req.To, req.Subject, req.Body)
	case "sms":
		return h.sms.Send(req.To, req.Body)
	case "whatsapp":
		// Production: use pre-approved Content Template
		if req.ContentSID != "" {
			return h.whatsapp.SendTemplate(req.To, req.ContentSID, req.Variables)
		}
		// Sandbox / 24h conversation window: freeform body
		return h.whatsapp.Send(req.To, req.Body)
	}
	return fmt.Errorf("unsupported channel: %s", req.Channel)
}
