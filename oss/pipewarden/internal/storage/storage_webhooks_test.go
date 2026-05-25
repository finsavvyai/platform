package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newWebhookConfig(name, url string, enabled bool, events []string) *WebhookConfigRecord {
	return &WebhookConfigRecord{
		Name:    name,
		URL:     url,
		Secret:  "hmac-secret",
		Events:  events,
		Enabled: enabled,
	}
}

func TestSaveAndGetWebhookConfig(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("main", "https://hooks.example.com/recv", true, []string{"finding.created", "scan.completed"})
	require.NoError(t, db.SaveWebhookConfig(rec))

	got, err := db.GetWebhookConfig("main")
	require.NoError(t, err)
	assert.Equal(t, "main", got.Name)
	assert.Equal(t, "https://hooks.example.com/recv", got.URL)
	assert.Equal(t, "hmac-secret", got.Secret)
	assert.True(t, got.Enabled)
	assert.Equal(t, []string{"finding.created", "scan.completed"}, got.Events)
}

func TestGetWebhookConfig_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetWebhookConfig("nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestGetWebhookConfig_EmptyNameFallsBackToDefault(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("default", "https://example.com", true, []string{})
	require.NoError(t, db.SaveWebhookConfig(rec))

	got, err := db.GetWebhookConfig("") // empty → default
	require.NoError(t, err)
	assert.Equal(t, "default", got.Name)
}

func TestSaveWebhookConfig_Upsert(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("wh", "https://v1.example.com", true, []string{"a"})
	require.NoError(t, db.SaveWebhookConfig(rec))

	rec.URL = "https://v2.example.com"
	rec.Events = []string{"b", "c"}
	rec.Enabled = false
	require.NoError(t, db.SaveWebhookConfig(rec))

	got, err := db.GetWebhookConfig("wh")
	require.NoError(t, err)
	assert.Equal(t, "https://v2.example.com", got.URL)
	assert.False(t, got.Enabled)
	assert.Equal(t, []string{"b", "c"}, got.Events)
}

func TestSaveWebhookConfig_NilEventsNormalized(t *testing.T) {
	db := newTestDB(t)

	rec := &WebhookConfigRecord{Name: "wh-nil", URL: "https://example.com", Secret: "s"}
	// Events is nil — normalizeWebhookConfig should set it to []string{}
	require.NoError(t, db.SaveWebhookConfig(rec))

	got, err := db.GetWebhookConfig("wh-nil")
	require.NoError(t, err)
	assert.NotNil(t, got.Events)
}

func TestSaveWebhookConfig_EmptyNameNormalized(t *testing.T) {
	db := newTestDB(t)

	rec := &WebhookConfigRecord{URL: "https://example.com", Events: []string{}}
	// Name is empty → normalized to "default"
	require.NoError(t, db.SaveWebhookConfig(rec))
	assert.Equal(t, "default", rec.Name)

	got, err := db.GetWebhookConfig("default")
	require.NoError(t, err)
	assert.Equal(t, "default", got.Name)
}

func TestUpdateWebhookConfigResult_Success(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("wh-res", "https://example.com", true, []string{})
	require.NoError(t, db.SaveWebhookConfig(rec))

	require.NoError(t, db.UpdateWebhookConfigResult("wh-res", 200, ""))

	got, err := db.GetWebhookConfig("wh-res")
	require.NoError(t, err)
	assert.Equal(t, 200, got.LastStatusCode)
	assert.Equal(t, "", got.LastError)
	assert.NotNil(t, got.LastTestedAt)
}

func TestUpdateWebhookConfigResult_WithError(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("wh-err", "https://example.com", true, []string{})
	require.NoError(t, db.SaveWebhookConfig(rec))

	require.NoError(t, db.UpdateWebhookConfigResult("wh-err", 503, "service unavailable"))

	got, err := db.GetWebhookConfig("wh-err")
	require.NoError(t, err)
	assert.Equal(t, 503, got.LastStatusCode)
	assert.Equal(t, "service unavailable", got.LastError)
}

func TestUpdateWebhookConfigResult_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.UpdateWebhookConfigResult("nonexistent", 200, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestUpdateWebhookConfigResult_EmptyNameFallsToDefault(t *testing.T) {
	db := newTestDB(t)

	rec := newWebhookConfig("default", "https://example.com", true, []string{})
	require.NoError(t, db.SaveWebhookConfig(rec))

	require.NoError(t, db.UpdateWebhookConfigResult("", 201, ""))

	got, err := db.GetWebhookConfig("default")
	require.NoError(t, err)
	assert.Equal(t, 201, got.LastStatusCode)
}
