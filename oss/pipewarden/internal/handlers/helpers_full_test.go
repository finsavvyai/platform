package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// ---------------------------------------------------------------------------
// LoadConnectionsFromDB
// ---------------------------------------------------------------------------

func TestLoadConnectionsFromDB_EmptyDB(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	db, err := storage.NewInMemory()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	manager := integrations.NewManager(logger)
	v, _ := vault.New("test-key")

	// Should not panic on empty DB.
	require.NotPanics(t, func() {
		LoadConnectionsFromDB(db, manager, v, logger, nil)
	})

	assert.Equal(t, 0, manager.Count())
}

func TestLoadConnectionsFromDB_SkipsVaultRequiredWithNoVault(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	db, err := storage.NewInMemory()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	// Insert a connection with a token but pass nil vault.
	rec := &storage.ConnectionRecord{
		Name:         "gh-conn",
		Platform:     "github",
		AuthMethod:   "token",
		Token:        "ghp_some_plaintext_token",
		HealthStatus: "pending",
	}
	require.NoError(t, db.Create(rec))

	manager := integrations.NewManager(logger)

	// No vault — should skip connections with secrets.
	require.NotPanics(t, func() {
		LoadConnectionsFromDB(db, manager, nil, logger, nil)
	})
	assert.Equal(t, 0, manager.Count())
}

func TestLoadConnectionsFromDB_LoadsDemoConnection(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	db, err := storage.NewInMemory()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	// Demo connections have no secrets (authMethod=demo, no token).
	rec := &storage.ConnectionRecord{
		Name:       "demo-gh",
		Platform:   "github",
		AuthMethod: "demo",
		// No token/username/appPassword.
	}
	require.NoError(t, db.Create(rec))

	manager := integrations.NewManager(logger)

	// With nil vault, demo connections (no secrets) should still load.
	require.NotPanics(t, func() {
		LoadConnectionsFromDB(db, manager, nil, logger, nil)
	})
	// Demo provider should be added.
	assert.Equal(t, 1, manager.Count())
}

func TestLoadConnectionsFromDB_SkipsUnknownPlatform(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	db, err := storage.NewInMemory()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	rec := &storage.ConnectionRecord{
		Name:       "unknown-conn",
		Platform:   "unsupported-platform",
		AuthMethod: "token",
		// No token — vault check passes.
	}
	require.NoError(t, db.Create(rec))

	manager := integrations.NewManager(logger)
	require.NotPanics(t, func() {
		LoadConnectionsFromDB(db, manager, nil, logger, nil)
	})
	assert.Equal(t, 0, manager.Count())
}

// ---------------------------------------------------------------------------
// buildProvider
// ---------------------------------------------------------------------------

func TestBuildProvider_GitHub(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	p := buildProvider("github", "token", "ghp_test", "", "", "", nil, logger)
	assert.NotNil(t, p)
}

func TestBuildProvider_GitLab(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	p := buildProvider("gitlab", "token", "glpat_test", "", "", "", nil, logger)
	assert.NotNil(t, p)
}

func TestBuildProvider_Bitbucket(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	p := buildProvider("bitbucket", "basic", "", "user", "pass", "", nil, logger)
	assert.NotNil(t, p)
}

func TestBuildProvider_UnsupportedPlatform(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	p := buildProvider("notexist", "token", "tok", "", "", "", nil, logger)
	assert.Nil(t, p)
}

func TestBuildProvider_ExperimentalPlatforms_RequireFlag(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})

	// Without cfg.Features.ExperimentalProviders these return nil.
	for _, platform := range []string{"azure_devops", "jenkins", "circleci"} {
		p := buildProvider(platform, "token", "tok", "", "", "", nil, logger)
		assert.Nil(t, p, "platform %s requires experimental flag", platform)
	}
}

func TestBuildProvider_ExperimentalPlatforms_WithFlag(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	cfg := &config.Config{}
	cfg.Features.ExperimentalProviders = true

	for _, platform := range []string{"azure_devops", "jenkins", "circleci"} {
		p := buildProvider(platform, "token", "tok", "user", "pass", "http://base", cfg, logger)
		assert.NotNil(t, p, "platform %s should return provider when experimental flag set", platform)
	}
}

func TestBuildProvider_Demo(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error"})
	// authMethod=demo overrides all platform checks.
	p := buildProvider("github", "demo", "", "", "", "", nil, logger)
	assert.NotNil(t, p)
}

// ---------------------------------------------------------------------------
// decryptRecord
// ---------------------------------------------------------------------------

func TestDecryptRecord_AllFields(t *testing.T) {
	v, err := vault.New("round-trip-key")
	require.NoError(t, err)

	encTok, _ := v.Encrypt("ghp_tok")
	encUser, _ := v.Encrypt("user@example.com")
	encPw, _ := v.Encrypt("app-pw")

	rec := &storage.ConnectionRecord{
		Token:       encTok,
		Username:    encUser,
		AppPassword: encPw,
	}

	require.NoError(t, decryptRecord(rec, v))
	assert.Equal(t, "ghp_tok", rec.Token)
	assert.Equal(t, "user@example.com", rec.Username)
	assert.Equal(t, "app-pw", rec.AppPassword)
}
