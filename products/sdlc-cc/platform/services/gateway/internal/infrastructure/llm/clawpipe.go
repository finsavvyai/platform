// Package llm — ClawPipe provider adapter.
//
// ClawPipe is the OpenClaw family's cost-optimization gateway (21 LLM
// providers, semantic cache, 246 Booster rules). Positioning:
// SDLC (compliance) → ClawPipe (cost) → any upstream LLM.
//
// Bucket E of NEXT-SESSION-PLAN.md.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ClawPipe implements Provider against the ClawPipe /v1/prompt endpoint.
type ClawPipe struct {
	apiKey    string
	projectID string
	baseURL   string
	hc        *http.Client
}

// NewClawPipe returns a ClawPipe adapter. baseURL defaults to the public
// endpoint when empty; callers can override for tests or the shared
// claw-gateway Cloudflare Worker.
func NewClawPipe(apiKey, projectID, baseURL string) *ClawPipe {
	if baseURL == "" {
		baseURL = "https://api.clawpipe.ai"
	}
	return &ClawPipe{
		apiKey:    apiKey,
		projectID: projectID,
		baseURL:   strings.TrimRight(baseURL, "/"),
		hc:        &http.Client{Timeout: 60 * time.Second},
	}
}

// Name implements Provider.
func (c *ClawPipe) Name() string { return "clawpipe" }

// clawRequest is the ClawPipe POST /v1/prompt body.
type clawRequest struct {
	Prompt      string  `json:"prompt"`
	Model       string  `json:"model"`
	System      string  `json:"system,omitempty"`
	MaxTokens   int     `json:"maxTokens,omitempty"`
	Temperature float32 `json:"temperature,omitempty"`
	Stream      bool    `json:"stream,omitempty"`
}

// clawResponse is the ClawPipe response envelope.
type clawResponse struct {
	Text          string  `json:"text"`
	TokensIn      int     `json:"tokensIn"`
	TokensOut     int     `json:"tokensOut"`
	LatencyMs     int64   `json:"latencyMs"`
	Boosted       bool    `json:"boosted"`
	Cached        bool    `json:"cached"`
	Route         string  `json:"route"`
	EstimatedCost float64 `json:"estimatedCostUsd"`
}

// Generate implements Provider. It marshals the vendor-neutral Message
// slice into ClawPipe's single-prompt+system shape, calls /v1/prompt,
// and maps the response back to the shared Response type.
func (c *ClawPipe) Generate(ctx context.Context, req Request) (*Response, error) {
	system, prompt := splitMessages(req.Messages)
	body := clawRequest{
		Prompt:      prompt,
		Model:       req.Model,
		System:      system,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
	}
	if body.MaxTokens == 0 {
		body.MaxTokens = 1024
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("clawpipe marshal: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/prompt", bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("clawpipe request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	if c.projectID != "" {
		httpReq.Header.Set("X-Project-Id", c.projectID)
	}

	start := time.Now()
	resp, err := c.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("clawpipe %d: %s", resp.StatusCode, string(respBody)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("clawpipe %d: %s", resp.StatusCode, string(respBody))
	}
	var cr clawResponse
	if err := json.Unmarshal(respBody, &cr); err != nil {
		return nil, fmt.Errorf("clawpipe decode: %w", err)
	}
	latency := time.Duration(cr.LatencyMs) * time.Millisecond
	if latency == 0 {
		latency = time.Since(start)
	}
	return &Response{
		Content:          cr.Text,
		PromptTokens:     cr.TokensIn,
		CompletionTokens: cr.TokensOut,
		Model:            req.Model,
		Provider:         "clawpipe",
		Latency:          latency,
	}, nil
}

// Embed implements Provider. ClawPipe does not expose an embeddings
// endpoint; callers should use a dedicated embedding provider.
func (c *ClawPipe) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, ErrEmbedUnsupported
}

// splitMessages extracts the first system message and collapses the
// remaining messages into a single prompt string. Multi-turn history
// is formatted as "role: content\n" pairs so ClawPipe sees context.
func splitMessages(msgs []Message) (system, prompt string) {
	var sb strings.Builder
	for _, m := range msgs {
		if m.Role == "system" && system == "" {
			system = m.Content
			continue
		}
		if sb.Len() > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(m.Role)
		sb.WriteString(": ")
		sb.WriteString(m.Content)
	}
	return system, sb.String()
}
