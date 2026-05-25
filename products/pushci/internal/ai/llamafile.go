package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const llamafileURL = "http://localhost:8080/v1/chat/completions"

// LlamafileClient routes AI calls through a local llamafile server.
type LlamafileClient struct {
	url   string
	model string
}

// NewLlamafileClient creates a client pointing at localhost:8080.
func NewLlamafileClient() *LlamafileClient {
	return &LlamafileClient{
		url:   llamafileURL,
		model: "local",
	}
}

// IsConfigured checks if llamafile server is running.
func (c *LlamafileClient) IsConfigured() bool {
	resp, err := http.Get("http://localhost:8080/v1/models")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// openAIRequest / openAIMessage / openAIResponse live in openai_shape.go
// so deepseek.go can reuse them. Both files speak the exact same wire
// format — the only difference is the endpoint and auth header.

// Ask sends a prompt to the local llamafile.
func (c *LlamafileClient) Ask(ctx context.Context, prompt string) (string, error) {
	return c.AskWithSystem(ctx, "", prompt)
}

// AskWithSystem sends system + user message to llamafile.
func (c *LlamafileClient) AskWithSystem(ctx context.Context, system, prompt string) (string, error) {
	msgs := []openAIMessage{}
	if system != "" {
		msgs = append(msgs, openAIMessage{Role: "system", Content: system})
	}
	msgs = append(msgs, openAIMessage{Role: "user", Content: prompt})

	body, _ := json.Marshal(openAIRequest{
		Model:     c.model,
		Messages:  msgs,
		MaxTokens: 2000,
	})

	req, _ := http.NewRequestWithContext(ctx, "POST", c.url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llamafile: %w (is it running at localhost:8080?)", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("llamafile %d: %s", resp.StatusCode, b)
	}

	var result openAIResponse
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Choices) > 0 && result.Choices[0].Message.Content != "" {
		return result.Choices[0].Message.Content, nil
	}
	return "", fmt.Errorf("empty response from llamafile")
}
