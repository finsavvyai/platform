package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// EmailSender delivers email notifications via Resend API.
type EmailSender struct {
	apiKey  string
	fromAddr string
	client  *http.Client
}

func NewEmailSender(apiKey, fromAddr string) *EmailSender {
	if fromAddr == "" {
		fromAddr = "alerts@amliq.io"
	}
	return &EmailSender{
		apiKey:   apiKey,
		fromAddr: fromAddr,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// EmailPayload holds the email content.
type EmailPayload struct {
	To      string
	Subject string
	Body    string
}

// Send delivers an email via Resend.
func (es *EmailSender) Send(ctx context.Context, payload EmailPayload) error {
	body := map[string]string{
		"from":    es.fromAddr,
		"to":      payload.To,
		"subject": payload.Subject,
		"html":    payload.Body,
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.resend.com/emails", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+es.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := es.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend api: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend returned %d", resp.StatusCode)
	}
	return nil
}

// FormatAlertEmail creates an HTML email body for a monitoring alert.
func FormatAlertEmail(entityName, newStatus string, confidence float64) string {
	return fmt.Sprintf(`<h2>AMLIQ Alert: %s</h2>
<p>Status changed to <strong>%s</strong> (confidence: %.0f%%)</p>
<p><a href="https://app.amliq.io/alerts">View in Dashboard</a></p>`,
		entityName, newStatus, confidence*100)
}
