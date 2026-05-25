package clawpipe

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDetectLocalProvider(t *testing.T) {
	// Mock Ollama server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tags" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"models": []map[string]string{
					{"name": "mistral:latest"},
					{"name": "neural-chat"},
				},
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// Simulate Ollama endpoint
	oldEndpoints := LocalModelEndpoints
	LocalModelEndpoints = map[string]string{
		"test": server.URL,
	}
	defer func() { LocalModelEndpoints = oldEndpoints }()

	provider := DetectLocalProvider()
	if provider == nil {
		t.Fatal("expected provider to be detected")
	}

	if provider.model != "mistral:latest" {
		t.Errorf("expected model mistral:latest, got %s", provider.model)
	}
}

func TestDetectLocalProviderNotFound(t *testing.T) {
	// Clear endpoints to ensure no detection
	oldEndpoints := LocalModelEndpoints
	LocalModelEndpoints = map[string]string{}
	defer func() { LocalModelEndpoints = oldEndpoints }()

	provider := DetectLocalProvider()
	if provider != nil {
		t.Fatal("expected provider to be nil when no local models available")
	}
}

func TestOfflineProviderPrompt(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/generate" && r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"response": "This is an offline model response about security checks.",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	provider := &OfflineProvider{
		baseURL: server.URL,
		model:   "mistral",
	}

	ctx := context.Background()
	resp, err := provider.Prompt(ctx, "analyze this pipeline for security issues")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if resp.Text != "This is an offline model response about security checks." {
		t.Errorf("unexpected response: %s", resp.Text)
	}

	if resp.Meta.Provider != "offline" {
		t.Errorf("expected provider to be 'offline', got %s", resp.Meta.Provider)
	}

	if resp.Meta.Model != "mistral" {
		t.Errorf("expected model to be 'mistral', got %s", resp.Meta.Model)
	}
}

func TestOfflineProviderPromptError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("model error"))
	}))
	defer server.Close()

	provider := &OfflineProvider{
		baseURL: server.URL,
		model:   "mistral",
	}

	ctx := context.Background()
	_, err := provider.Prompt(ctx, "analyze pipeline")

	if err == nil {
		t.Fatal("expected error for server error response")
	}
}

func TestOfflineProviderNil(t *testing.T) {
	var provider *OfflineProvider

	ctx := context.Background()
	_, err := provider.Prompt(ctx, "test")

	if err == nil {
		t.Fatal("expected error for nil provider")
	}
}

func TestIsLocalProviderAvailable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	available := isLocalProviderAvailable(server.URL)
	if !available {
		t.Fatal("expected provider to be available")
	}
}

func TestIsLocalProviderNotAvailable(t *testing.T) {
	available := isLocalProviderAvailable("http://localhost:65432")
	if available {
		t.Fatal("expected provider to be unavailable")
	}
}

func TestDetectDefaultModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"models": []map[string]string{
				{"name": "neural-chat:latest"},
			},
		})
	}))
	defer server.Close()

	model := detectDefaultModel(server.URL)
	if model != "neural-chat:latest" {
		t.Errorf("expected neural-chat:latest, got %s", model)
	}
}

func TestDetectDefaultModelFallback(t *testing.T) {
	// When API fails, should return default model
	model := detectDefaultModel("http://localhost:65432")
	if model != "mistral" {
		t.Errorf("expected mistral fallback, got %s", model)
	}
}
