package clawpipe

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClient_Defaults(t *testing.T) {
	cfg := Config{
		APIKey:    "test-key",
		ProjectID: "test-project",
	}
	c := NewClient(cfg)

	if c.config.BaseURL != defaultBaseURL {
		t.Errorf("expected default BaseURL %q, got %q", defaultBaseURL, c.config.BaseURL)
	}
	if c.config.APIKey != "test-key" {
		t.Errorf("expected APIKey test-key, got %q", c.config.APIKey)
	}
	if c.config.ProjectID != "test-project" {
		t.Errorf("expected ProjectID test-project, got %q", c.config.ProjectID)
	}
}

func TestNewClient_CustomBaseURL(t *testing.T) {
	cfg := Config{
		APIKey:  "key",
		BaseURL: "https://custom.clawpipe.ai/",
	}
	c := NewClient(cfg)

	if c.config.BaseURL != "https://custom.clawpipe.ai" {
		t.Errorf("expected trailing slash trimmed, got %q", c.config.BaseURL)
	}
}

func TestEnabled_WithAPIKey(t *testing.T) {
	c := NewClient(Config{APIKey: "test-key"})
	if !c.Enabled() {
		t.Error("expected Enabled() = true with API key set")
	}
}

func TestEnabled_WithoutAPIKey(t *testing.T) {
	c := NewClient(Config{})
	if c.Enabled() {
		t.Error("expected Enabled() = false with empty API key")
	}
}

func TestPrompt_Success(t *testing.T) {
	resp := clawpipeResponse{
		Text: "This is the response from ClawPipe",
		Meta: clawpipeMeta{
			Cached:        false,
			Boosted:       true,
			Model:         "claude-sonnet",
			Provider:      "anthropic",
			InputTokens:   42,
			OutputTokens:  123,
			LatencyMs:     1500,
			EstimatedCost: 0.00123,
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify headers
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("expected Authorization header with Bearer token, got %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-Project-ID") != "test-project" {
			t.Errorf("expected X-Project-ID header, got %q", r.Header.Get("X-Project-ID"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %q", r.Header.Get("Content-Type"))
		}

		// Verify path
		if r.URL.Path != "/prompt" {
			t.Errorf("expected path /prompt, got %q", r.URL.Path)
		}

		// Verify method
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %q", r.Method)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:    "test-key",
		ProjectID: "test-project",
		BaseURL:   server.URL,
	})

	result, err := c.Prompt(context.Background(), "test prompt", PromptOptions{
		Model:       "claude-sonnet",
		Temperature: 0.7,
		MaxTokens:   2048,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Text != "This is the response from ClawPipe" {
		t.Errorf("unexpected text: %q", result.Text)
	}
	if result.Meta.Model != "claude-sonnet" {
		t.Errorf("expected model claude-sonnet, got %q", result.Meta.Model)
	}
	if result.Meta.InputTokens != 42 {
		t.Errorf("expected 42 input tokens, got %d", result.Meta.InputTokens)
	}
	if result.Meta.OutputTokens != 123 {
		t.Errorf("expected 123 output tokens, got %d", result.Meta.OutputTokens)
	}
	if result.Meta.Cached {
		t.Error("expected Cached = false")
	}
	if !result.Meta.Boosted {
		t.Error("expected Boosted = true")
	}
}

func TestPrompt_CacheHit(t *testing.T) {
	resp := clawpipeResponse{
		Text: "Cached response",
		Meta: clawpipeMeta{
			Cached:        true,
			Boosted:       false,
			Model:         "claude-haiku",
			Provider:      "anthropic",
			InputTokens:   10,
			OutputTokens:  20,
			LatencyMs:     50,
			EstimatedCost: 0.0001,
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:  "test-key",
		BaseURL: server.URL,
	})

	result, err := c.Prompt(context.Background(), "cached prompt", PromptOptions{
		Model:     "claude-haiku",
		MaxTokens: 1024,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Meta.Cached {
		t.Error("expected Cached = true")
	}
	if result.Meta.LatencyMs != 50 {
		t.Errorf("expected latency 50ms, got %d", result.Meta.LatencyMs)
	}
}

func TestPrompt_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid API key"}`))
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:  "invalid-key",
		BaseURL: server.URL,
	})

	_, err := c.Prompt(context.Background(), "test", PromptOptions{Model: "claude-sonnet"})

	if err == nil {
		t.Fatal("expected error for unauthorized response")
	}
	if err.Error() != "clawpipe API error (HTTP 401): {\"error\":\"invalid API key\"}" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestPrompt_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`not valid json`))
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:  "test-key",
		BaseURL: server.URL,
	})

	_, err := c.Prompt(context.Background(), "test", PromptOptions{Model: "claude-sonnet"})

	if err == nil {
		t.Fatal("expected error for invalid JSON response")
	}
}

func TestPrompt_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow response
		<-r.Context().Done()
		w.WriteHeader(http.StatusRequestTimeout)
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:  "test-key",
		BaseURL: server.URL,
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := c.Prompt(ctx, "test", PromptOptions{Model: "claude-sonnet"})

	if err == nil {
		t.Fatal("expected error for canceled context")
	}
}

func TestPrompt_WithoutProjectID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// X-Project-ID header should not be present
		if r.Header.Get("X-Project-ID") != "" {
			t.Errorf("expected no X-Project-ID header, got %q", r.Header.Get("X-Project-ID"))
		}

		resp := clawpipeResponse{
			Text: "Success",
			Meta: clawpipeMeta{
				Model:        "claude-sonnet",
				InputTokens:  10,
				OutputTokens: 20,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := NewClient(Config{
		APIKey:  "test-key",
		BaseURL: server.URL,
	})

	result, err := c.Prompt(context.Background(), "test", PromptOptions{Model: "claude-sonnet"})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != "Success" {
		t.Errorf("unexpected response: %q", result.Text)
	}
}
