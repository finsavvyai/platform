package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// containsWebhookEvent
// ---------------------------------------------------------------------------

func TestContainsWebhookEvent_Found(t *testing.T) {
	events := []string{"findings", "audit", "deployment"}
	assert.True(t, containsWebhookEvent(events, "findings"))
	assert.True(t, containsWebhookEvent(events, "audit"))
}

func TestContainsWebhookEvent_CaseInsensitive(t *testing.T) {
	events := []string{"Findings", "AUDIT"}
	assert.True(t, containsWebhookEvent(events, "findings"))
	assert.True(t, containsWebhookEvent(events, "audit"))
}

func TestContainsWebhookEvent_NotFound(t *testing.T) {
	events := []string{"findings"}
	assert.False(t, containsWebhookEvent(events, "audit"))
	assert.False(t, containsWebhookEvent(events, ""))
}

func TestContainsWebhookEvent_EmptySlice(t *testing.T) {
	assert.False(t, containsWebhookEvent(nil, "findings"))
	assert.False(t, containsWebhookEvent([]string{}, "findings"))
}

func TestContainsWebhookEvent_Whitespace(t *testing.T) {
	events := []string{" findings "}
	assert.True(t, containsWebhookEvent(events, "findings"))
}

// ---------------------------------------------------------------------------
// decryptWebhookSecret — requires vault
// ---------------------------------------------------------------------------

func TestDecryptWebhookSecret_NoVault_Fails(t *testing.T) {
	h := newTestHandlersNoVault(t)
	_, err := h.decryptWebhookSecret("some-secret")
	require.Error(t, err)
	assert.ErrorIs(t, err, errVaultRequired)
}

func TestDecryptWebhookSecret_EmptyString_OK(t *testing.T) {
	h := newTestHandlersNoVault(t)
	result, err := h.decryptWebhookSecret("")
	require.NoError(t, err)
	assert.Equal(t, "", result)
}

func TestDecryptWebhookSecret_WithVault_RoundTrip(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	plaintext := "my-webhook-secret"
	encrypted, err := v.Encrypt(plaintext)
	require.NoError(t, err)

	decrypted, err := h.decryptWebhookSecret(encrypted)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

// ---------------------------------------------------------------------------
// encryptWebhookSecret
// ---------------------------------------------------------------------------

func TestEncryptWebhookSecret_NoVault_Fails(t *testing.T) {
	h := newTestHandlersNoVault(t)
	_, err := h.encryptWebhookSecret("secret")
	require.Error(t, err)
	assert.ErrorIs(t, err, errVaultRequired)
}

func TestEncryptWebhookSecret_EmptyString_OK(t *testing.T) {
	h := newTestHandlersNoVault(t)
	result, err := h.encryptWebhookSecret("")
	require.NoError(t, err)
	assert.Equal(t, "", result)
}

func TestEncryptWebhookSecret_WithVault(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	encrypted, err := h.encryptWebhookSecret("my-secret")
	require.NoError(t, err)
	assert.NotEqual(t, "my-secret", encrypted)

	// Should be decryptable.
	plain, err := v.Decrypt(encrypted)
	require.NoError(t, err)
	assert.Equal(t, "my-secret", plain)
}

// ---------------------------------------------------------------------------
// saveWebhookConfig / loadWebhookConfig (via vault)
// ---------------------------------------------------------------------------

func TestSaveWebhookConfig_NilRecord(t *testing.T) {
	h := newTestHandlers(t)
	err := h.saveWebhookConfig(nil)
	require.Error(t, err)
}

func TestSaveWebhookConfig_DefaultsName(t *testing.T) {
	h := newTestHandlers(t)

	// No secret — vault not required.
	rec := &storage.WebhookConfigRecord{
		URL:     "https://example.com/hook",
		Events:  []string{"findings"},
		Enabled: true,
	}
	require.NoError(t, h.saveWebhookConfig(rec))
	assert.Equal(t, defaultWebhookConfigName, rec.Name)
}

func TestSaveWebhookConfig_DefaultsEvents(t *testing.T) {
	h := newTestHandlers(t)

	rec := &storage.WebhookConfigRecord{
		Name:    "myhook",
		URL:     "https://example.com/hook",
		Enabled: true,
		// No events provided — should default to defaultWebhookEvents.
	}
	require.NoError(t, h.saveWebhookConfig(rec))
	assert.Equal(t, defaultWebhookEvents, rec.Events)
}

// ---------------------------------------------------------------------------
// deliverFindingWebhook — no webhook configured → no-op (must not panic)
// ---------------------------------------------------------------------------

func TestDeliverFindingWebhook_NoConfig_Noop(t *testing.T) {
	h := newTestHandlers(t)

	rec := &storage.FindingRecord{
		ConnectionName: "conn",
		Title:          "Test",
		Severity:       "high",
	}
	// Should not panic when no webhook config is saved.
	require.NotPanics(t, func() {
		h.deliverFindingWebhook(rec)
	})
}

func TestDeliverFindingWebhook_NilRecord_Noop(t *testing.T) {
	h := newTestHandlers(t)
	require.NotPanics(t, func() {
		h.deliverFindingWebhook(nil)
	})
}
