package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// WebhookNotifier sends notifications to a generic HTTP endpoint.
type WebhookNotifier struct {
	URL     string
	Headers map[string]string
	Method  string
	Client  *http.Client
}

// NewWebhookNotifier creates a WebhookNotifier for the given URL.
func NewWebhookNotifier(url string) *WebhookNotifier {
	return &WebhookNotifier{
		URL:    url,
		Method: http.MethodPost,
		Client: http.DefaultClient,
	}
}

type webhookPayload struct {
	Repo      string        `json:"repo"`
	Branch    string        `json:"branch"`
	Status    string        `json:"status"`
	Duration  string        `json:"duration"`
	Checks    []CheckResult `json:"checks"`
	Timestamp string        `json:"timestamp"`
}

// Send delivers a JSON payload to the configured webhook URL.
func (w *WebhookNotifier) Send(event NotifyEvent) error {
	payload := webhookPayload{
		Repo: event.Repo, Branch: event.Branch,
		Status: string(event.Status), Duration: event.Duration,
		Checks: event.Checks, Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("webhook marshal: %w", err)
	}
	req, err := http.NewRequest(w.Method, w.URL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range w.Headers {
		req.Header.Set(k, v)
	}
	resp, err := w.Client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
