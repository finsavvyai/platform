package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// completeGemini calls Google's Generative AI API (non-OpenAI format).
func (g *GemmaClient) completeGemini(
	ctx context.Context, prompt string,
) (string, error) {
	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{"parts": []map[string]string{{"text": prompt}}},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.1,
			"maxOutputTokens": 256,
		},
	}
	payload, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s",
		g.endpoint, g.model, g.apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url,
		bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("gemini HTTP %d: %s",
			resp.StatusCode, truncate(data, 200))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}
