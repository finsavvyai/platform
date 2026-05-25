package aianalysis

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/clawpipe"
)

// TestCallClaude_OfflineOnlyRefuses verifies that PIPEWARDEN_OFFLINE_ONLY=1
// blocks the outbound call before any HTTP request is dispatched. Uses an
// httptest.Server that fails the test if hit.
func TestCallClaude_OfflineOnlyRefuses(t *testing.T) {
	t.Setenv(clawpipe.EnvOfflineOnly, "1")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("Anthropic endpoint must not be called when offline-only is on")
	}))
	defer srv.Close()

	a := NewClaudeAnalyzer(ClaudeConfig{
		APIKey:  "test-key",
		BaseURL: srv.URL,
	}, testLogger())
	a.SetHTTPClient(srv.Client())

	_, err := a.callClaude(context.Background(), "scan this prompt")
	if err == nil {
		t.Fatal("callClaude must return an error when offline-only is set")
	}
	if !errors.Is(err, clawpipe.ErrOfflineOnly) {
		t.Fatalf("expected ErrOfflineOnly, got %v", err)
	}
}

// TestCallClaude_OfflineOnlyOff_HitsServer is the regression guard: when
// the env var is unset, the analyzer must reach the configured BaseURL.
func TestCallClaude_OfflineOnlyOff_HitsServer(t *testing.T) {
	t.Setenv(clawpipe.EnvOfflineOnly, "")

	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"{}"}],"usage":{"input_tokens":1,"output_tokens":1}}`))
	}))
	defer srv.Close()

	a := NewClaudeAnalyzer(ClaudeConfig{APIKey: "k", BaseURL: srv.URL}, testLogger())
	a.SetHTTPClient(srv.Client())

	if _, err := a.callClaude(context.Background(), "ok"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !hit {
		t.Fatal("Anthropic endpoint must be called when offline-only is unset")
	}
}
