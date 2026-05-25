package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// SendGridSender sends emails via SendGrid API.
type SendGridSender struct {
	apiKey   string
	fromAddr string
	fromName string
}

func NewSendGridSender() *SendGridSender {
	return &SendGridSender{
		apiKey:   os.Getenv("SENDGRID_API_KEY"),
		fromAddr: "noreply@amliq.finance",
		fromName: "AMLIQ",
	}
}

type sgPersonalization struct {
	To []sgEmail `json:"to"`
}

type sgEmail struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type sgContent struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type sgRequest struct {
	Personalizations []sgPersonalization `json:"personalizations"`
	From             sgEmail             `json:"from"`
	Subject          string              `json:"subject"`
	Content          []sgContent         `json:"content"`
}

func (s *SendGridSender) Send(to, subject, html string) error {
	if s.apiKey == "" {
		return fmt.Errorf("SENDGRID_API_KEY not set")
	}
	payload := sgRequest{
		Personalizations: []sgPersonalization{{To: []sgEmail{{Email: to}}}},
		From:             sgEmail{Email: s.fromAddr, Name: s.fromName},
		Subject:          subject,
		Content:          []sgContent{{Type: "text/html", Value: html}},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST",
		"https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("sendgrid: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sendgrid: HTTP %d", resp.StatusCode)
	}
	return nil
}
