package domain

import (
	"fmt"
	"net/url"
	"strings"
)

// WebhookConfig holds webhook notification settings.
type WebhookConfig struct {
	URL     string
	Events  []string
	Secret  string
	Enabled bool
}

// NewWebhookConfig creates a validated webhook configuration.
func NewWebhookConfig(webhookURL string, events []string) (WebhookConfig, error) {
	wc := WebhookConfig{
		URL:     webhookURL,
		Events:  events,
		Enabled: webhookURL != "",
	}
	return wc, wc.Validate()
}

// Validate checks webhook config is sound.
func (wc WebhookConfig) Validate() error {
	if !wc.Enabled {
		return nil
	}
	if wc.URL == "" {
		return fmt.Errorf("webhook URL required when enabled")
	}
	if _, err := url.Parse(wc.URL); err != nil {
		return fmt.Errorf("invalid webhook URL: %w", err)
	}
	if !strings.HasPrefix(wc.URL, "https://") {
		return fmt.Errorf("webhook URL must be HTTPS")
	}
	if len(wc.Events) == 0 {
		return fmt.Errorf("at least one event type required")
	}
	for _, event := range wc.Events {
		if err := validateEventType(event); err != nil {
			return err
		}
	}
	return nil
}

func validateEventType(event string) error {
	valid := map[string]bool{
		"match.created":   true,
		"match.updated":   true,
		"match.dismissed": true,
		"match.escalated": true,
		"sync.started":    true,
		"sync.completed":  true,
		"sync.failed":     true,
	}
	if !valid[event] {
		return fmt.Errorf("invalid event type: %s", event)
	}
	return nil
}
