package domain

import (
	"testing"
)

func TestNewWebhookConfig(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		events  []string
		wantErr bool
	}{
		{
			name:   "valid webhook",
			url:    "https://example.com/webhook",
			events: []string{"match.created", "match.escalated"},
		},
		{
			name:   "disabled webhook",
			url:    "",
			events: []string{},
		},
		{
			name:    "http instead of https",
			url:     "http://example.com/webhook",
			events:  []string{"match.created"},
			wantErr: true,
		},
		{
			name:    "invalid event type",
			url:     "https://example.com/webhook",
			events:  []string{"invalid.event"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewWebhookConfig(tt.url, tt.events)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestWebhookConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  WebhookConfig
		wantErr bool
	}{
		{
			name:   "disabled is valid",
			config: WebhookConfig{Enabled: false},
		},
		{
			name: "valid enabled",
			config: WebhookConfig{
				URL:     "https://example.com/webhook",
				Events:  []string{"match.created", "match.updated"},
				Enabled: true,
			},
		},
		{
			name: "enabled without url",
			config: WebhookConfig{
				URL:     "",
				Events:  []string{"match.created"},
				Enabled: true,
			},
			wantErr: true,
		},
		{
			name: "http not https",
			config: WebhookConfig{
				URL:     "http://example.com/webhook",
				Events:  []string{"match.created"},
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
