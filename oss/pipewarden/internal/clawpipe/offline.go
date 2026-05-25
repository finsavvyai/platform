package clawpipe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OfflineProvider detects and uses local LLM models (Ollama, LLamaFile, LM Studio)
// for cost optimization when ClawPipe API is unavailable or disabled.
type OfflineProvider struct {
	baseURL string
	model   string
}

// LocalModelEndpoints contains common local model server endpoints.
var LocalModelEndpoints = map[string]string{
	"ollama":    "http://localhost:11434",
	"llamafile": "http://localhost:8080",
	"lm-studio": "http://localhost:1234",
}

// DetectLocalProvider checks for available local LLM model servers
// in this order: Ollama, LLamaFile, LM Studio.
// Returns nil if no local provider is detected.
func DetectLocalProvider() *OfflineProvider {
	for _, baseURL := range LocalModelEndpoints {
		if isLocalProviderAvailable(baseURL) {
			model := detectDefaultModel(baseURL)
			return &OfflineProvider{
				baseURL: baseURL,
				model:   model,
			}
		}
	}
	return nil
}

// isLocalProviderAvailable checks if a local model server responds to requests.
func isLocalProviderAvailable(baseURL string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/tags", nil)
	if err != nil {
		return false
	}

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()

	return resp.StatusCode == http.StatusOK
}

// detectDefaultModel queries the local provider for available models
// and returns the first suitable one.
func detectDefaultModel(baseURL string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/tags", nil)
	if err != nil {
		return "mistral"
	}

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "mistral"
	}
	defer func() { _ = resp.Body.Close() }()

	var tags struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tags); err == nil && len(tags.Models) > 0 {
		return tags.Models[0].Name
	}

	return "mistral"
}

// Prompt sends a prompt to the local model using OpenAI-compatible API format
// that Ollama and LLamaFile support.
func (o *OfflineProvider) Prompt(ctx context.Context, prompt string) (*PromptResponse, error) {
	if o == nil || o.baseURL == "" {
		return nil, fmt.Errorf("offline provider not initialized")
	}

	reqBody := map[string]interface{}{
		"model":  o.model,
		"prompt": prompt,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("local model error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// Read response (streaming format from Ollama)
	respBodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result struct {
		Response string `json:"response"`
	}

	if err := json.Unmarshal(respBodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &PromptResponse{
		Text: result.Response,
		Meta: ResponseMeta{
			Model:    o.model,
			Provider: "offline",
		},
	}, nil
}
