package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Ask sends a user prompt to whichever provider the client is bound to.
func (c *Client) Ask(ctx context.Context, prompt string) (string, error) {
	return c.AskWithSystem(ctx, "", prompt)
}

// AskWithSystem sends a system + user message. It dispatches on c.provider
// so that DeepSeek/OpenAI-compatible backends and Anthropic's Messages API
// can coexist behind the same Client type.
func (c *Client) AskWithSystem(ctx context.Context, system, prompt string) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("no AI provider configured (set ANTHROPIC_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPEN_AI_KEY, or GEMINI_API_KEY)")
	}

	switch c.provider {
	case ProviderDeepSeek:
		return askDeepSeek(ctx, c, system, prompt)
	case ProviderGroq:
		return askGroq(ctx, c, system, prompt)
	case ProviderOpenAI:
		return askOpenAI(ctx, c, system, prompt)
	case ProviderGemini:
		return askGemini(ctx, c, system, prompt)
	case ProviderAnthropic, ProviderLocal, "":
		return askAnthropic(ctx, c, system, prompt)
	default:
		return "", fmt.Errorf("unknown ai provider: %s", c.provider)
	}
}

// askAnthropic is the original Claude Messages API path, extracted so
// AskWithSystem can dispatch cleanly.
func askAnthropic(ctx context.Context, c *Client, system, prompt string) (string, error) {
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
