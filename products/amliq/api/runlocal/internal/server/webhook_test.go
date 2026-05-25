package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/platform"
)

type mockProvider struct {
	event *platform.Event
	err   error
}

func (m *mockProvider) ParseWebhook(_ *http.Request) (*platform.Event, error) {
	return m.event, m.err
}

func (m *mockProvider) PostStatus(_ context.Context, _ *platform.Event, _ *platform.Status) error {
	return nil
}

func (m *mockProvider) PostComment(_ context.Context, _ *platform.Event, _ string) error {
	return nil
}

func TestHealthEndpoint(t *testing.T) {
	srv := New("/tmp", nil)
	handler := srv.Handler()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("status = %d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "ok") {
		t.Errorf("body = %q, want ok", w.Body.String())
	}
}

func TestWebhookNoProvider(t *testing.T) {
	srv := New("/tmp", nil)
	handler := srv.Handler()
	req := httptest.NewRequest("POST", "/webhook/github", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != 404 {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestWebhookWithProvider(t *testing.T) {
	srv := New("/tmp", nil)
	srv.RegisterProvider("github", &mockProvider{
		event: &platform.Event{
			Provider: "github", Action: "push",
			Repo: "o/r", Branch: "main", SHA: "abc",
		},
	})
	handler := srv.Handler()
	req := httptest.NewRequest("POST", "/webhook/github",
		strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("status = %d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "accepted") {
		t.Errorf("body = %q, want accepted", w.Body.String())
	}
}

func TestWebhookRouting(t *testing.T) {
	tests := []struct{ name, path string; code int }{
		{"github", "/webhook/github", 404},
		{"gitlab", "/webhook/gitlab", 404},
		{"bitbucket", "/webhook/bitbucket", 404},
		{"health", "/health", 200},
	}
	srv := New("/tmp", nil)
	h := srv.Handler()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest("POST", tt.path, nil))
			if w.Code != tt.code {
				t.Errorf("%s: status = %d, want %d", tt.path, w.Code, tt.code)
			}
		})
	}
}
