package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/notification"
)

type VerifyHandler struct {
	verifier *notification.TwilioVerifier
}

func NewVerifyHandler() *VerifyHandler {
	return &VerifyHandler{verifier: notification.NewTwilioVerifier()}
}

type sendVerifyReq struct {
	To      string `json:"to"`
	Channel string `json:"channel"` // sms | whatsapp | email | call
}

type checkVerifyReq struct {
	To   string `json:"to"`
	Code string `json:"code"`
}

// Send starts a verification — POST /api/v1/verify/send
func (h *VerifyHandler) Send(w http.ResponseWriter, r *http.Request) {
	var req sendVerifyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.To == "" {
		http.Error(w, "'to' required", http.StatusBadRequest)
		return
	}
	channel := notification.VerifyChannel(req.Channel)
	if channel == "" {
		channel = notification.ChannelSMS
	}
	resp, err := h.verifier.Send(req.To, channel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  resp.Status,
		"to":      resp.To,
		"channel": string(channel),
	})
}

// Check verifies an OTP code — POST /api/v1/verify/check
func (h *VerifyHandler) Check(w http.ResponseWriter, r *http.Request) {
	var req checkVerifyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.To == "" || req.Code == "" {
		http.Error(w, "'to' and 'code' required", http.StatusBadRequest)
		return
	}
	resp, err := h.verifier.Check(req.To, req.Code)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": resp.Status,
		"valid":  resp.Status == "approved",
	})
}
