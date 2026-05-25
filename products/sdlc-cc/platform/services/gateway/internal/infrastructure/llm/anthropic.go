// Package llm — Anthropic provider. REAL HTTP wrapper for /v1/messages.
// API key required at runtime; tests use httptest.NewServer.
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Anthropic implements Provider + Streamer.
type Anthropic struct {
	apiKey  string
	baseURL string
	hc      *http.Client
}

// NewAnthropic returns a configured client. baseURL defaults to the
// public endpoint when empty so callers can override for tests.
func NewAnthropic(apiKey, baseURL string) *Anthropic {
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}
	return &Anthropic{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		hc:      &http.Client{Timeout: 60 * time.Second},
	}
}

// Name implements Provider.
func (a *Anthropic) Name() string { return "anthropic" }

type anthropicMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicReq struct {
	Model       string         `json:"model"`
	MaxTokens   int            `json:"max_tokens"`
	Messages    []anthropicMsg `json:"messages"`
	System      string         `json:"system,omitempty"`
	Temperature float32        `json:"temperature,omitempty"`
	Stream      bool           `json:"stream,omitempty"`
}

type anthropicResp struct {
	Content []struct {
		Text string `json:"text"`
		Type string `json:"type"`
	} `json:"content"`
	Model      string `json:"model"`
	StopReason string `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// Generate implements Provider.
func (a *Anthropic) Generate(ctx context.Context, req Request) (*Response, error) {
	body, err := a.buildBody(req, false)
	if err != nil {
		return nil, err
	}
	httpReq, err := a.newRequest(ctx, "/v1/messages", body)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	resp, err := a.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("anthropic %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, string(raw))
	}
	var ar anthropicResp
	if err := json.Unmarshal(raw, &ar); err != nil {
		return nil, fmt.Errorf("anthropic decode: %w", err)
	}
	var sb strings.Builder
	for _, c := range ar.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	return &Response{
		Content:          sb.String(),
		PromptTokens:     ar.Usage.InputTokens,
		CompletionTokens: ar.Usage.OutputTokens,
		Model:            ar.Model,
		Provider:         "anthropic",
		Latency:          time.Since(start),
		StopReason:       ar.StopReason,
	}, nil
}

// Embed implements Provider — Anthropic has no embeddings endpoint.
func (a *Anthropic) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, ErrEmbedUnsupported
}

// Stream implements Streamer (SSE consumer for /v1/messages stream).
func (a *Anthropic) Stream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	body, err := a.buildBody(req, true)
	if err != nil {
		return nil, err
	}
	httpReq, err := a.newRequest(ctx, "/v1/messages", body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Accept", "text/event-stream")
	resp, err := a.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, fmt.Errorf("anthropic stream %d: %s", resp.StatusCode, string(raw))
	}
	out := make(chan StreamChunk, 16)
	go a.consumeSSE(resp.Body, out)
	return out, nil
}

func (a *Anthropic) consumeSSE(body io.ReadCloser, out chan<- StreamChunk) {
	defer close(out)
	defer body.Close()
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			out <- StreamChunk{Done: true}
			return
		}
		var ev struct {
			Delta struct {
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(payload), &ev); err == nil && ev.Delta.Text != "" {
			out <- StreamChunk{Delta: ev.Delta.Text}
		}
	}
	if err := scanner.Err(); err != nil {
		out <- StreamChunk{Err: err}
	}
}

func (a *Anthropic) buildBody(req Request, stream bool) ([]byte, error) {
	ar := anthropicReq{
		Model:       req.Model,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		Stream:      stream,
	}
	if ar.MaxTokens == 0 {
		ar.MaxTokens = 1024
	}
	for _, m := range req.Messages {
		if m.Role == "system" {
			ar.System = m.Content
			continue
		}
		ar.Messages = append(ar.Messages, anthropicMsg{Role: m.Role, Content: m.Content})
	}
	return json.Marshal(ar)
}

func (a *Anthropic) newRequest(ctx context.Context, path string, body []byte) (*http.Request, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	return httpReq, nil
}
