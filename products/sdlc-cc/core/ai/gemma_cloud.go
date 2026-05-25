package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// completeCloud calls an OpenAI-compatible chat-completions endpoint
// (OpenRouter, DeepSeek, Groq — all expose the same wire format).
// Returns the first choice's content.
func (g *GemmaClient) completeCloud(
	ctx context.Context, prompt string,
) (string, error) {
	body := map[string]interface{}{
		"model": g.model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens":  256,
		"temperature": 0.1,
	}
	payload, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		g.endpoint+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://amliq.finance")
	req.Header.Set("X-Title", "AMLiQ Screening")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("%s: %w", g.provider, err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("%s HTTP %d: %s",
			g.provider, resp.StatusCode, truncate(data, 200))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("empty response from %s", g.provider)
	}
	return result.Choices[0].Message.Content, nil
}
