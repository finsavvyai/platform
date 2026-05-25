package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Sender sends transactional emails.
type Sender interface {
	Send(to, subject, html string) error
}

// ResendSender sends emails via Resend API.
type ResendSender struct {
	apiKey string
	from   string
}

func NewResendSender() *ResendSender {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "AMLIQ <noreply@amliq.finance>"
	}
	return &ResendSender{
		apiKey: os.Getenv("RESEND_API_KEY"),
		from:   from,
	}
}

func (s *ResendSender) Send(to, subject, html string) error {
	if s.apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not set")
	}
	payload := map[string]interface{}{
		"from":    s.from,
		"to":     []string{to},
		"subject": subject,
		"html":    html,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.resend.com/emails",
		bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		buf := make([]byte, 512)
		n, _ := resp.Body.Read(buf)
		return fmt.Errorf("resend: HTTP %d — %s", resp.StatusCode, string(buf[:n]))
	}
	return nil
}

// NoopSender logs emails instead of sending (for dev).
type NoopSender struct{}

func (n *NoopSender) Send(to, subject, _ string) error {
	fmt.Printf("EMAIL [noop] to=%s subject=%s\n", to, subject)
	return nil
}

// NewSender returns the first configured sender: SendGrid, Resend, or noop.
func NewSender() Sender {
	if os.Getenv("SENDGRID_API_KEY") != "" {
		return NewSendGridSender()
	}
	if os.Getenv("RESEND_API_KEY") != "" {
		return NewResendSender()
	}
	return &NoopSender{}
}
