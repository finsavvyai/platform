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

const apiURL = "https://api.anthropic.com/v1/messages"

// Client calls the Claude Messages API for error diagnosis.
type Client struct {
	apiKey string
	model  string
}

// NewClient creates a Claude API client. Reads ANTHROPIC_API_KEY from env.
func NewClient() *Client {
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}
	return &Client{
		apiKey: os.Getenv("ANTHROPIC_API_KEY"),
		model:  model,
	}
}

// NewClientWithModel creates a client. Use "claude-sonnet-4-6" for complex tasks.
func NewClientWithModel(model string) *Client {
	return &Client{
		apiKey: os.Getenv("ANTHROPIC_API_KEY"),
		model:  model,
	}
}

// IsConfigured returns true if API key is set.
func (c *Client) IsConfigured() bool {
	return c.apiKey != ""
}

type request struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []message `json:"messages"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type response struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text,omitempty"`
	} `json:"content"`
}

// Ask sends a user prompt to Claude.
func (c *Client) Ask(ctx context.Context, prompt string) (string, error) {
	return c.AskWithSystem(ctx, "", prompt)
}

// AskWithSystem sends a system + user message to Claude.
// Runs input through self-hosted Claw guard before calling the LLM.
func (c *Client) AskWithSystem(ctx context.Context, system, prompt string) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}
	if err := Guard(ctx, prompt); err != nil {
		return "", fmt.Errorf("prompt guard: %w", err)
	}
	body, _ := json.Marshal(request{
		Model: c.model, MaxTokens: 2000, System: system,
		Messages: []message{{Role: "user", Content: prompt}},
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(body))
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("claude api: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("claude api %d: %s", resp.StatusCode, b)
	}
	var result response
	json.NewDecoder(resp.Body).Decode(&result)
	for _, block := range result.Content {
		if block.Type == "text" && block.Text != "" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("empty response")
}
