package notification

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// WhatsAppSender sends WhatsApp messages via Twilio's WhatsApp API.
// Requires TWILIO_WHATSAPP_FROM (format: "whatsapp:+14155238886")
// and a pre-approved template or active conversation window.
type WhatsAppSender struct {
	accountSID string
	authToken  string
	fromNumber string // must be prefixed with "whatsapp:"
}

func NewWhatsAppSender() *WhatsAppSender {
	// Accept TWILIO_WHATSAPP_FROM or fall back to TWILIO_PHONE_NUMBER
	from := os.Getenv("TWILIO_WHATSAPP_FROM")
	if from == "" {
		from = os.Getenv("TWILIO_PHONE_NUMBER")
	}
	if from != "" && !strings.HasPrefix(from, "whatsapp:") {
		from = "whatsapp:" + from
	}
	return &WhatsAppSender{
		accountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		authToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		fromNumber: from,
	}
}

func (w *WhatsAppSender) IsConfigured() bool {
	return w.accountSID != "" && w.authToken != "" && w.fromNumber != ""
}

// Send delivers a WhatsApp message.
// `to` must be E.164 format (e.g. "+14155551234"); the "whatsapp:" prefix is added.
func (w *WhatsAppSender) Send(to, body string) error {
	if !w.IsConfigured() {
		return fmt.Errorf("twilio whatsapp not configured")
	}
	toAddr := to
	if !strings.HasPrefix(toAddr, "whatsapp:") {
		toAddr = "whatsapp:" + toAddr
	}

	endpoint := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		w.accountSID)

	form := url.Values{}
	form.Set("To", toAddr)
	form.Set("From", w.fromNumber)
	form.Set("Body", body)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(w.accountSID, w.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio whatsapp: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("twilio whatsapp HTTP %d", resp.StatusCode)
	}
	return nil
}

// SendTemplate delivers a WhatsApp message using a pre-approved Content Template.
// contentSID: Twilio Content SID (starts with "HX...") created in Console
// variables: map of variable index → value (keys: "1", "2", ...)
// Required for production (outside 24h customer service window).
func (w *WhatsAppSender) SendTemplate(
	to, contentSID string, variables map[string]string,
) error {
	if !w.IsConfigured() {
		return fmt.Errorf("twilio whatsapp not configured")
	}
	if contentSID == "" {
		return fmt.Errorf("content_sid required")
	}
	toAddr := to
	if !strings.HasPrefix(toAddr, "whatsapp:") {
		toAddr = "whatsapp:" + toAddr
	}

	endpoint := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		w.accountSID)

	form := url.Values{}
	form.Set("To", toAddr)
	form.Set("From", w.fromNumber)
	form.Set("ContentSid", contentSID)

	if len(variables) > 0 {
		varsJSON, err := json.Marshal(variables)
		if err != nil {
			return fmt.Errorf("marshal vars: %w", err)
		}
		form.Set("ContentVariables", string(varsJSON))
	}

	req, err := http.NewRequest("POST", endpoint,
		strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(w.accountSID, w.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio whatsapp template: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("twilio whatsapp template HTTP %d", resp.StatusCode)
	}
	return nil
}
