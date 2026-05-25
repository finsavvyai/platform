package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

// clawLogger returns a default logger for test use.
func clawLogger() *logging.Logger { return logging.NewDefault() }

// ---- NewClawClient ----

func TestNewClawClient_DefaultBaseURL(t *testing.T) {
	cfg := ClawConfig{APIKey: "key", ProjectID: "proj"}
	c := NewClawClient(cfg, clawLogger())
	if c == nil {
		t.Fatal("NewClawClient returned nil")
	}
	if c.config.BaseURL != defaultClawBaseURL {
		t.Errorf("expected default base URL %s, got %s", defaultClawBaseURL, c.config.BaseURL)
	}
}

func TestNewClawClient_CustomBaseURL(t *testing.T) {
	cfg := ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: "https://custom.example.com/v1/"}
	c := NewClawClient(cfg, clawLogger())
	// Trailing slash should be stripped.
	if strings.HasSuffix(c.config.BaseURL, "/") {
		t.Errorf("expected trailing slash stripped, got %s", c.config.BaseURL)
	}
	if c.config.BaseURL != "https://custom.example.com/v1" {
		t.Errorf("unexpected base URL: %s", c.config.BaseURL)
	}
}

func TestNewClawClient_HTTPClientNotNil(t *testing.T) {
	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p"}, clawLogger())
	if c.httpClient == nil {
		t.Error("expected non-nil http client")
	}
}

// ---- SetHTTPClient ----

func TestSetHTTPClient_Replaces(t *testing.T) {
	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p"}, clawLogger())
	custom := &http.Client{Timeout: 5 * time.Second}
	c.SetHTTPClient(custom)
	if c.httpClient != custom {
		t.Error("SetHTTPClient did not replace the http client")
	}
}

// ---- Enabled ----

func TestEnabled_BothFieldsSet(t *testing.T) {
	c := NewClawClient(ClawConfig{APIKey: "key", ProjectID: "proj"}, clawLogger())
	if !c.Enabled() {
		t.Error("expected Enabled=true when both APIKey and ProjectID set")
	}
}

func TestEnabled_MissingAPIKey(t *testing.T) {
	c := NewClawClient(ClawConfig{ProjectID: "proj"}, clawLogger())
	if c.Enabled() {
		t.Error("expected Enabled=false when APIKey is empty")
	}
}

func TestEnabled_MissingProjectID(t *testing.T) {
	c := NewClawClient(ClawConfig{APIKey: "key"}, clawLogger())
	if c.Enabled() {
		t.Error("expected Enabled=false when ProjectID is empty")
	}
}

func TestEnabled_BothEmpty(t *testing.T) {
	c := NewClawClient(ClawConfig{}, clawLogger())
	if c.Enabled() {
		t.Error("expected Enabled=false when both fields empty")
	}
}

// ---- Analyze ----

func TestAnalyze_Success(t *testing.T) {
	want := ClawResponse{
		ID:     "resp-1",
		Status: "ok",
		Usage:  ClawUsage{CreditsUsed: 3, TokensIn: 100, TokensOut: 50},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/analyze" {
			t.Errorf("expected path /analyze, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer testkey" {
			t.Errorf("bad auth header: %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-Project-ID") != "proj1" {
			t.Errorf("bad project header: %s", r.Header.Get("X-Project-ID"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "testkey", ProjectID: "proj1", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	resp, err := c.Analyze(context.Background(), "scan", map[string]string{"target": "pipeline"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != want.ID {
		t.Errorf("expected ID %s, got %s", want.ID, resp.ID)
	}
	if resp.Status != want.Status {
		t.Errorf("expected status %s, got %s", want.Status, resp.Status)
	}
	if resp.Usage.CreditsUsed != want.Usage.CreditsUsed {
		t.Errorf("expected credits %d, got %d", want.Usage.CreditsUsed, resp.Usage.CreditsUsed)
	}
}

func TestAnalyze_HTTP500Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("server exploded"))
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, err := c.Analyze(context.Background(), "scan", nil)
	if err == nil {
		t.Fatal("expected error for HTTP 500")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("expected error to mention 500, got: %v", err)
	}
}

func TestAnalyze_HTTP404Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte("not found"))
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, err := c.Analyze(context.Background(), "scan", nil)
	if err == nil {
		t.Fatal("expected error for HTTP 404")
	}
}

func TestAnalyze_MalformedJSONResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not-json{{{"))
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, err := c.Analyze(context.Background(), "scan", nil)
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestAnalyze_NetworkFailure(t *testing.T) {
	// Point at a port that refuses connections.
	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: "http://127.0.0.1:1"}, clawLogger())
	_, err := c.Analyze(context.Background(), "scan", nil)
	if err == nil {
		t.Fatal("expected error for network failure")
	}
}

func TestAnalyze_ContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never respond — simulate a slow server.
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, err := c.Analyze(ctx, "scan", nil)
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

// ---- HealthCheck ----

func TestHealthCheck_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Path != "/health" {
			t.Errorf("expected /health path, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer hkey" {
			t.Errorf("missing auth header, got: %s", r.Header.Get("Authorization"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "hkey", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	if err := c.HealthCheck(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestHealthCheck_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	err := c.HealthCheck(context.Background())
	if err == nil {
		t.Fatal("expected error for 503")
	}
	if !strings.Contains(err.Error(), "503") {
		t.Errorf("expected error to mention HTTP status, got: %v", err)
	}
}

func TestHealthCheck_NetworkFailure(t *testing.T) {
	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: "http://127.0.0.1:1"}, clawLogger())
	err := c.HealthCheck(context.Background())
	if err == nil {
		t.Fatal("expected error for network failure")
	}
}

func TestHealthCheck_ContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	err := c.HealthCheck(ctx)
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

// ---- doRequest (indirectly via Analyze) ----

func TestDoRequest_SetsContentTypeHeader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", ct)
		}
		_ = json.NewEncoder(w).Encode(ClawResponse{Status: "ok"})
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: "p", BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, _ = c.Analyze(context.Background(), "test", nil)
}

func TestDoRequest_ProjectIDHeaderSet(t *testing.T) {
	const projID = "proj-xyz"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-Project-ID"); got != projID {
			t.Errorf("expected X-Project-ID=%s, got %s", projID, got)
		}
		_ = json.NewEncoder(w).Encode(ClawResponse{Status: "ok"})
	}))
	defer srv.Close()

	c := NewClawClient(ClawConfig{APIKey: "k", ProjectID: projID, BaseURL: srv.URL}, clawLogger())
	c.SetHTTPClient(srv.Client())

	_, _ = c.Analyze(context.Background(), "test", nil)
}
