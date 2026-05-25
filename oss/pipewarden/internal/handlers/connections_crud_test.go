package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestCreateConnectionRequiresVaultForSecrets(t *testing.T) {
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}
	defer func() { _ = db.Close() }()

	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}

	h := New(db, integrations.NewManager(logger), nil, nil, logger, nil)

	body, err := json.Marshal(map[string]string{
		"name":     "github-main",
		"platform": "github",
		"token":    "ghp_test_token",
	})
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateConnection(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d with body %s", http.StatusServiceUnavailable, w.Code, w.Body.String())
	}
}
