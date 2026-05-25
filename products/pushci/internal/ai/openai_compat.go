package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// openai_compat.go — shared HTTP caller for every OpenAI-compatible backend.
// Provider constructors (DeepSeek, Groq, OpenAI) live in openai_providers.go.
// Dispatch stubs (askDeepSeek, askGroq, askOpenAI) are also here for locality.

func askDeepSeek(ctx context.Context, c *Client, system, prompt string) (string, error) {
	return askOpenAICompat(ctx, c, system, prompt, "deepseek")
}

func askGroq(ctx context.Context, c *Client, system, prompt string) (string, error) {
	return askOpenAICompat(ctx, c, system, prompt, "groq")
}

func askOpenAI(ctx context.Context, c *Client, system, prompt string) (string, error) {
	return askOpenAICompat(ctx, c, system, prompt, "openai")
}

// ---- Shared OpenAI-compatible caller ---------------------------------------

// askOpenAICompat is the single HTTP path for every OpenAI-compatible backend.
// The providerName is used only for error messages — all HTTP, serialization,
// and response parsing is identical regardless of which endpoint answers.
func askOpenAICompat(ctx context.Context, c *Client, system, prompt, providerName string) (string, error) {
	messages := make([]openAIMessage, 0, 2)
	if system != "" {
		messages = append(messages, openAIMessage{Role: "system", Content: system})
	}
	messages = append(messages, openAIMessage{Role: "user", Content: prompt})

	body, _ := json.Marshal(openAIRequest{
		Model:     c.model,
		Messages:  messages,
		MaxTokens: 2000,
	})

	req, _ := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%s api: %w", providerName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("%s api %d: %s", providerName, resp.StatusCode, b)
	}

	var result openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("%s decode: %w", providerName, err)
	}
	if len(result.Choices) == 0 || result.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("%s empty response", providerName)
	}
	return result.Choices[0].Message.Content, nil
}
