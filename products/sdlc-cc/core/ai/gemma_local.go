package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// completeLocal calls a local Ollama server. Ollama uses a
// different request/response shape than the cloud OpenAI-compatible
// endpoints, hence the dedicated method.
func (g *GemmaClient) completeLocal(
	ctx context.Context, prompt string,
) (string, error) {
	body := map[string]interface{}{
		"model":  g.model,
		"prompt": prompt,
		"stream": false,
		"options": map[string]interface{}{
			"temperature": 0.1,
			"num_predict": 256,
		},
	}
	payload, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST",
		g.endpoint+"/api/generate", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("ollama HTTP %d: %s",
			resp.StatusCode, truncate(data, 200))
	}

	var result struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	return result.Response, nil
}

// checkOllama verifies the local daemon is reachable by hitting
// /api/tags with a 2s timeout.
func (g *GemmaClient) checkOllama() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", g.endpoint+"/api/tags", nil)
	resp, err := g.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}
