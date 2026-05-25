package domain

import (
	"testing"
)

func TestWebhookConfigValidateEvents(t *testing.T) {
	tests := []struct {
		name    string
		config  WebhookConfig
		wantErr bool
	}{
		{
			name: "valid match events",
			config: WebhookConfig{
				URL:     "https://example.com/webhook",
				Events:  []string{"match.created", "match.updated"},
				Enabled: true,
			},
		},
		{
			name: "valid sync events",
			config: WebhookConfig{
				URL:     "https://example.com/webhook",
				Events:  []string{"sync.started", "sync.completed"},
				Enabled: true,
			},
		},
		{
			name: "multiple valid events",
			config: WebhookConfig{
				URL: "https://example.com/webhook",
				Events: []string{
					"match.created", "match.dismissed", "match.escalated",
					"sync.failed",
				},
				Enabled: true,
			},
		},
		{
			name: "invalid event type",
			config: WebhookConfig{
				URL:     "https://example.com/webhook",
				Events:  []string{"unknown.event"},
				Enabled: true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
