package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// AnthropicClient implements screening.LLMClient using Claude API.
type AnthropicClient struct {
	apiKey string
	model  string
}

// NewAnthropicClient creates a client using ANTHROPIC_API_KEY env var.
func NewAnthropicClient() *AnthropicClient {
	return &AnthropicClient{
		apiKey: os.Getenv("ANTHROPIC_API_KEY"),
		model:  "claude-haiku-4-5-20251001", // fast + cheap for screening
	}
}

// IsConfigured returns true if the API key is set.
func (c *AnthropicClient) IsConfigured() bool {
	return c.apiKey != ""
}

// Name implements Provider — used for fallback-chain logging
// and observability so a 503 from "anthropic" vs "bedrock" is
// distinguishable in audit logs.
func (c *AnthropicClient) Name() string { return "anthropic" }

// Model returns the configured model id (e.g. "claude-haiku-4-5...").
// Public so callers in other modules can attribute cost/usage.
func (c *AnthropicClient) Model() string { return c.model }

// Complete sends a prompt to Claude and returns the response.
func (c *AnthropicClient) Complete(
	ctx context.Context, prompt string,
) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	body := map[string]interface{}{
		"model":      c.model,
		"max_tokens": 256,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	}
	payload, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.anthropic.com/v1/messages",
		bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("anthropic HTTP %d: %s",
			resp.StatusCode, string(data[:min(len(data), 200)]))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response")
	}
	return result.Content[0].Text, nil
}
