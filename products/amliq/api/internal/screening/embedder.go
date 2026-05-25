package screening

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OpenAIEmbedder generates embeddings via OpenAI-compatible API.
type OpenAIEmbedder struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

func NewOpenAIEmbedder(apiKey, baseURL, model string) *OpenAIEmbedder {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "text-embedding-3-small"
	}
	return &OpenAIEmbedder{
		apiKey: apiKey, baseURL: baseURL, model: model,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (e *OpenAIEmbedder) Embed(ctx context.Context, text string) ([]float64, error) {
	body := map[string]interface{}{
		"input": text, "model": e.model,
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal embedding request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		e.baseURL+"/embeddings", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embedding API call: %w", err)
	}
	defer resp.Body.Close()
	return parseEmbeddingResponse(resp.Body, resp.StatusCode)
}

func parseEmbeddingResponse(body io.Reader, status int) ([]float64, error) {
	if status != http.StatusOK {
		return nil, fmt.Errorf("embedding API returned %d", status)
	}
	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode embedding: %w", err)
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("empty embedding response")
	}
	return result.Data[0].Embedding, nil
}
