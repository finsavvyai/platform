package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// WebhookPayload represents a monitoring status change notification.
type WebhookPayload struct {
	Event          string  `json:"event"`
	MonitorID      string  `json:"monitor_id"`
	EntityName     string  `json:"entity_name"`
	PreviousStatus string  `json:"previous_status"`
	NewStatus      string  `json:"new_status"`
	Confidence     float64 `json:"confidence"`
	MatchedList    string  `json:"matched_list,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

// WebhookSender delivers webhook notifications with retry logic.
type WebhookSender struct {
	client     *http.Client
	maxRetries int
	delays     []time.Duration
}

func NewWebhookSender() *WebhookSender {
	return &WebhookSender{
		client:     &http.Client{Timeout: 10 * time.Second},
		maxRetries: 3,
		delays:     []time.Duration{1 * time.Second, 5 * time.Second, 30 * time.Second},
	}
}

// Send delivers a webhook with exponential backoff retry.
func (ws *WebhookSender) Send(
	ctx context.Context, url string, payload WebhookPayload,
) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal webhook: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= ws.maxRetries; attempt++ {
		if attempt > 0 {
			delay := ws.delays[attempt-1]
			log.Printf("webhook retry %d/%d to %s after %v", attempt, ws.maxRetries, url, delay)
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		lastErr = ws.doSend(ctx, url, body)
		if lastErr == nil {
			return nil
		}
	}
	return fmt.Errorf("webhook failed after %d retries: %w", ws.maxRetries, lastErr)
}

func (ws *WebhookSender) doSend(ctx context.Context, url string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AMLIQ-Webhook/1.0")

	resp, err := ws.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("webhook returned status %d", resp.StatusCode)
}
