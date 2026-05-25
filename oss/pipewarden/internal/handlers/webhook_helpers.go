package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/webhooks"
)

const defaultWebhookConfigName = "default"

var defaultWebhookEvents = []string{"findings", "audit"}

func (h *Handlers) saveWebhookConfig(rec *storage.WebhookConfigRecord) error {
	if rec == nil {
		return fmt.Errorf("webhook config is required")
	}
	if rec.Name == "" {
		rec.Name = defaultWebhookConfigName
	}
	if len(rec.Events) == 0 {
		rec.Events = append([]string{}, defaultWebhookEvents...)
	}
	if rec.Secret != "" {
		encrypted, err := h.encryptWebhookSecret(rec.Secret)
		if err != nil {
			return err
		}
		rec.Secret = encrypted
	}
	return h.db.SaveWebhookConfig(rec)
}

func (h *Handlers) loadWebhookConfig(name string, includeSecret bool) (*storage.WebhookConfigRecord, error) {
	if h.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	rec, err := h.db.GetWebhookConfig(name)
	if err != nil {
		return nil, err
	}
	if includeSecret && rec.Secret != "" {
		rec.Secret, err = h.decryptWebhookSecret(rec.Secret)
		if err != nil {
			return nil, err
		}
	} else if !includeSecret {
		rec.Secret = ""
	}
	return rec, nil
}

func (h *Handlers) encryptWebhookSecret(secret string) (string, error) {
	if secret == "" {
		return "", nil
	}
	if h.vault == nil || !h.vault.Enabled() {
		return "", fmt.Errorf("%w; set PIPEWARDEN_VAULT_KEY", errVaultRequired)
	}
	encrypted, err := h.vault.Encrypt(secret)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt webhook secret: %w", err)
	}
	return encrypted, nil
}

func (h *Handlers) decryptWebhookSecret(secret string) (string, error) {
	if secret == "" {
		return "", nil
	}
	if h.vault == nil || !h.vault.Enabled() {
		return "", fmt.Errorf("%w; set PIPEWARDEN_VAULT_KEY", errVaultRequired)
	}
	decrypted, err := h.vault.Decrypt(secret)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt webhook secret: %w", err)
	}
	return decrypted, nil
}

func (h *Handlers) currentWebhookSender(requiredEvent string) (*webhooks.WebhookSender, *storage.WebhookConfigRecord, error) {
	rec, err := h.loadWebhookConfig(defaultWebhookConfigName, true)
	if err != nil {
		return nil, nil, err
	}
	if !rec.Enabled || rec.URL == "" || rec.Secret == "" {
		return nil, rec, fmt.Errorf("webhook config incomplete")
	}
	if requiredEvent != "" && !containsWebhookEvent(rec.Events, requiredEvent) {
		return nil, rec, fmt.Errorf("webhook event %q not enabled", requiredEvent)
	}
	return webhooks.NewWebhookSender(rec.URL, rec.Secret, h.logger), rec, nil
}

func (h *Handlers) deliverFindingWebhook(rec *storage.FindingRecord) {
	if rec == nil || h.db == nil {
		return
	}

	event := webhooks.FindingEvent{
		ID:             rec.ID,
		ConnectionName: rec.ConnectionName,
		RunID:          rec.RunID,
		Severity:       rec.Severity,
		Category:       rec.Category,
		Title:          rec.Title,
		Description:    rec.Description,
		Remediation:    rec.Remediation,
		File:           rec.File,
		Line:           rec.Line,
		Confidence:     rec.Confidence,
		Status:         rec.Status,
		Timestamp:      rec.CreatedAt,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// OpenSRE bridge fires independently of any DB-configured webhook: if the
	// operator set PIPEWARDEN_OPENSRE_URL + PIPEWARDEN_OPENSRE_SECRET, every
	// finding becomes an OpenSRE alert. Failures are logged, not retried.
	if h.openSRESender != nil && h.openSRESender.Enabled() {
		if err := h.openSRESender.SendFinding(ctx, event); err != nil {
			h.logger.Warnw("opensre alert delivery failed", "error", err, "finding_id", rec.ID)
		}
	}

	sender, cfg, err := h.currentWebhookSender("findings")
	if err != nil {
		return
	}

	if err := sender.SendFinding(ctx, event); err != nil {
		_ = h.db.UpdateWebhookConfigResult(cfg.Name, 0, err.Error())
		h.logger.Warnw("failed to deliver finding webhook", "error", err, "finding_id", rec.ID)
		return
	}
	_ = h.db.UpdateWebhookConfigResult(cfg.Name, 200, "")
}

func containsWebhookEvent(events []string, target string) bool {
	target = strings.TrimSpace(strings.ToLower(target))
	for _, event := range events {
		if strings.TrimSpace(strings.ToLower(event)) == target {
			return true
		}
	}
	return false
}
