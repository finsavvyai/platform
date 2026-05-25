package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// loadWebhookConfig — additional paths
// ---------------------------------------------------------------------------

func TestLoadWebhookConfig_NoDBRecord_Error(t *testing.T) {
	h := newTestHandlers(t)
	// No webhook config saved → GetWebhookConfig should return error.
	_, err := h.loadWebhookConfig("nonexistent", false)
	require.Error(t, err)
}

func TestLoadWebhookConfig_WithoutSecret_SecretStripped(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	// Encrypt a secret and save the config.
	encrypted, err := v.Encrypt("mysecret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	// includeSecret=false → secret must be stripped.
	loaded, err := h.loadWebhookConfig(defaultWebhookConfigName, false)
	require.NoError(t, err)
	assert.Equal(t, "", loaded.Secret, "secret should be stripped when includeSecret=false")
	assert.Equal(t, "https://example.com/hook", loaded.URL)
}

func TestLoadWebhookConfig_WithSecret_SecretDecrypted(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("plaintext-secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	// includeSecret=true → secret should be decrypted.
	loaded, err := h.loadWebhookConfig(defaultWebhookConfigName, true)
	require.NoError(t, err)
	assert.Equal(t, "plaintext-secret", loaded.Secret)
}

func TestLoadWebhookConfig_NoSecret_IncludeSecretTrue_ReturnsEmpty(t *testing.T) {
	h := newTestHandlers(t)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  "", // no secret stored
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	loaded, err := h.loadWebhookConfig(defaultWebhookConfigName, true)
	require.NoError(t, err)
	assert.Equal(t, "", loaded.Secret)
}

// ---------------------------------------------------------------------------
// currentWebhookSender — various config states
// ---------------------------------------------------------------------------

func TestCurrentWebhookSender_NoConfig_Error(t *testing.T) {
	h := newTestHandlers(t)
	// No webhook config at all → error.
	sender, cfg, err := h.currentWebhookSender("findings")
	assert.Nil(t, sender)
	assert.Nil(t, cfg)
	require.Error(t, err)
}

func TestCurrentWebhookSender_DisabledConfig_Error(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: false, // disabled
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	sender, _, err := h.currentWebhookSender("findings")
	assert.Nil(t, sender)
	require.Error(t, err)
}

func TestCurrentWebhookSender_MissingURL_Error(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "", // URL missing
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	sender, _, err := h.currentWebhookSender("findings")
	assert.Nil(t, sender)
	require.Error(t, err)
}

func TestCurrentWebhookSender_EventNotEnabled_Error(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"audit"}, // only "audit", not "findings"
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	sender, _, err := h.currentWebhookSender("findings")
	assert.Nil(t, sender)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not enabled")
}

func TestCurrentWebhookSender_FullyConfigured_ReturnsSender(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("webhook-secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"findings", "audit"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	sender, cfg, err := h.currentWebhookSender("findings")
	require.NoError(t, err)
	assert.NotNil(t, sender)
	assert.NotNil(t, cfg)
}

func TestCurrentWebhookSender_EmptyRequiredEvent_SkipsEventCheck(t *testing.T) {
	// requiredEvent="" means any event config is acceptable.
	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("webhook-secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Secret:  encrypted,
		Events:  []string{"custom-event"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	sender, _, err := h.currentWebhookSender("") // empty required event
	require.NoError(t, err)
	assert.NotNil(t, sender)
}

// ---------------------------------------------------------------------------
// deliverFindingWebhook — with real webhook receiver mock
// ---------------------------------------------------------------------------

func TestDeliverFindingWebhook_FullDelivery_HitsReceiver(t *testing.T) {
	received := make(chan bool, 1)
	mockReceiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- true
		w.WriteHeader(http.StatusOK)
	}))
	defer mockReceiver.Close()

	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("webhook-secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     mockReceiver.URL,
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	finding := &storage.FindingRecord{
		ID:             1,
		ConnectionName: "test-conn",
		RunID:          "run-001",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Exposed API key",
		Status:         "open",
		CreatedAt:      time.Now(),
	}

	h.deliverFindingWebhook(finding)

	select {
	case <-received:
		// Webhook was delivered.
	case <-time.After(3 * time.Second):
		t.Error("webhook receiver was never hit within 3s")
	}
}

func TestDeliverFindingWebhook_ReceiverReturns500_UpdatesResult(t *testing.T) {
	mockReceiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer mockReceiver.Close()

	h, v := newTestHandlersWithVault(t)

	encrypted, err := v.Encrypt("webhook-secret")
	require.NoError(t, err)

	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     mockReceiver.URL,
		Secret:  encrypted,
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	finding := &storage.FindingRecord{
		ID:             2,
		ConnectionName: "test-conn",
		RunID:          "run-001",
		Severity:       "critical",
		Title:          "Critical finding",
		Status:         "open",
		CreatedAt:      time.Now(),
	}

	// Should not panic even when receiver returns 500.
	require.NotPanics(t, func() {
		h.deliverFindingWebhook(finding)
	})
}
