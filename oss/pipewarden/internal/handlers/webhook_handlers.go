package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/webhooks"
)

// WebhookConfig represents webhook configuration
type WebhookConfig struct {
	URL     string   `json:"url"`
	Secret  string   `json:"secret"`
	Events  []string `json:"events"`
	Enabled bool     `json:"enabled"`
}

// ConfigureWebhook handles GET/POST /api/v1/webhooks/configure
func (h *Handlers) ConfigureWebhook(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rec, err := h.db.GetWebhookConfig(defaultWebhookConfigName)
		if err != nil {
			jsonOK(w, map[string]interface{}{
				"configured": false,
				"events":     []string{},
				"enabled":    false,
				"has_secret": false,
			})
			return
		}

		jsonOK(w, map[string]interface{}{
			"configured":       true,
			"url":              rec.URL,
			"events":           rec.Events,
			"enabled":          rec.Enabled,
			"has_secret":       rec.Secret != "",
			"last_tested_at":   rec.LastTestedAt,
			"last_status_code": rec.LastStatusCode,
			"last_error":       rec.LastError,
		})
		return
	case http.MethodPost:
	default:
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config WebhookConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if config.URL == "" {
		jsonError(w, "url is required", http.StatusBadRequest)
		return
	}
	parsedURL, err := url.ParseRequestURI(config.URL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		jsonError(w, fmt.Sprintf("invalid webhook URL: %v", err), http.StatusBadRequest)
		return
	}

	if len(config.Events) == 0 {
		config.Events = append([]string{}, defaultWebhookEvents...)
	}

	existing, err := h.loadWebhookConfig(defaultWebhookConfigName, true)
	if err == nil {
		if config.Secret == "" {
			config.Secret = existing.Secret
		}
		if len(config.Events) == 0 {
			config.Events = existing.Events
		}
	}
	if config.Enabled && strings.TrimSpace(config.Secret) == "" {
		jsonError(w, "secret is required when webhook delivery is enabled", http.StatusBadRequest)
		return
	}

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     config.URL,
		Secret:  config.Secret,
		Events:  config.Events,
		Enabled: config.Enabled,
	}
	if existing != nil {
		rec.CreatedAt = existing.CreatedAt
		rec.LastTestedAt = existing.LastTestedAt
		rec.LastStatusCode = existing.LastStatusCode
		rec.LastError = existing.LastError
	}

	if err := h.saveWebhookConfig(rec); err != nil {
		jsonError(w, err.Error(), vaultErrorStatus(err))
		return
	}

	jsonOK(w, map[string]interface{}{
		"status":           "configured",
		"configured":       true,
		"url":              rec.URL,
		"events":           rec.Events,
		"enabled":          rec.Enabled,
		"has_secret":       rec.Secret != "",
		"last_tested_at":   rec.LastTestedAt,
		"last_status_code": rec.LastStatusCode,
		"last_error":       rec.LastError,
		"timestamp":        time.Now(),
	})
}

// TestWebhook handles POST /api/v1/webhooks/test
func (h *Handlers) TestWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config WebhookConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	rec, err := h.loadWebhookConfig(defaultWebhookConfigName, true)
	if err != nil {
		rec = &storage.WebhookConfigRecord{
			Name:   defaultWebhookConfigName,
			Events: append([]string{}, defaultWebhookEvents...),
		}
	}

	if config.URL != "" {
		rec.URL = config.URL
	}
	if config.Secret != "" {
		rec.Secret = config.Secret
	}
	if len(config.Events) > 0 {
		rec.Events = config.Events
	}
	if config.Enabled {
		rec.Enabled = true
	}

	if rec.URL == "" {
		jsonError(w, "url is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(rec.Secret) == "" {
		jsonError(w, "secret is required to send signed webhook payloads", http.StatusBadRequest)
		return
	}

	parsedURL, err := url.ParseRequestURI(rec.URL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		jsonError(w, fmt.Sprintf("invalid webhook URL: %v", err), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	sender := webhooks.NewWebhookSender(rec.URL, rec.Secret, h.logger)
	testPayload := map[string]interface{}{
		"event":     "webhook.test",
		"events":    rec.Events,
		"timestamp": time.Now().UTC(),
		"message":   "Test webhook delivery",
	}
	statusCode, err := sender.SendTestEvent(ctx, testPayload)
	if err != nil {
		_ = h.db.UpdateWebhookConfigResult(defaultWebhookConfigName, 0, err.Error())
		jsonError(w, fmt.Sprintf("webhook delivery failed: %v", err), http.StatusGatewayTimeout)
		return
	}
	_ = h.db.UpdateWebhookConfigResult(defaultWebhookConfigName, statusCode, "")

	success := statusCode >= 200 && statusCode < 300

	jsonOK(w, map[string]interface{}{
		"success":    success,
		"signed":     true,
		"statusCode": statusCode,
		"message":    "Webhook test delivered signed payload",
		"event":      "webhook.test",
		"timestamp":  time.Now(),
	})
}
