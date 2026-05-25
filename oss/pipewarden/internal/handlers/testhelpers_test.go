package handlers

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// newTestHandlersWithVault creates a Handlers instance that has an enabled
// vault, required when testing code paths that encrypt/decrypt credentials.
// NOTE: newTestHandlers (in embed_test.go) already includes a vault and is
// the standard no-argument factory. Use this one when you need vault access.
func newTestHandlersWithVault(t *testing.T) (*Handlers, *vault.Vault) {
	t.Helper()
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	v, err := vault.New("test-master-key-for-unit-tests")
	if err != nil {
		t.Fatalf("vault.New: %v", err)
	}

	h := New(db, integrations.NewManager(logger), nil, nil, logger, v)
	return h, v
}

// newTestHandlersDB returns both the Handlers (with vault) and the underlying
// DB so tests can seed data directly without going through the HTTP layer.
func newTestHandlersDB(t *testing.T) (*Handlers, *storage.DB) {
	t.Helper()
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	v, err := vault.New("test-master-key-for-unit-tests")
	if err != nil {
		t.Fatalf("vault.New: %v", err)
	}

	h := New(db, integrations.NewManager(logger), nil, nil, logger, v, &config.Config{})
	return h, db
}

// newTestHandlersNoVault creates a Handlers instance with NO vault.
// Use this only for tests that specifically verify vault-absent behavior.
func newTestHandlersNoVault(t *testing.T) *Handlers {
	t.Helper()
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil)
}
