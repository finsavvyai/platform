// Package llm — OpenAI provider.
//
// REAL HTTP wrapper for /v1/chat/completions and /v1/embeddings.
// Bearer auth via apiKey; tests mock with httptest.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// OpenAI implements Provider.
type OpenAI struct {
	apiKey  string
	baseURL string
	hc      *http.Client
}

// NewOpenAI builds a client. baseURL defaults to the public endpoint
// unless explicitly overridden, or the LLAMAFILE_BASE_URL env var is
// set — in that case dev/CI traffic targets a local llamafile process
// (https://github.com/mozilla-ai/llamafile) instead of OpenAI, so
// integration tests don't need a live API key. Production wiring is
// untouched: callers that pass a real baseURL or apiKey win.
func NewOpenAI(apiKey, baseURL string) *OpenAI {
	if baseURL == "" {
		if dev := strings.TrimSpace(os.Getenv("LLAMAFILE_BASE_URL")); dev != "" {
			baseURL = dev
		} else {
			baseURL = "https://api.openai.com"
		}
	}
	return &OpenAI{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		hc:      &http.Client{Timeout: 60 * time.Second},
	}
}

// Name implements Provider.
func (o *OpenAI) Name() string { return "openai" }

type oaiMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type oaiChatReq struct {
	Model       string   `json:"model"`
	Messages    []oaiMsg `json:"messages"`
	MaxTokens   int      `json:"max_tokens,omitempty"`
	Temperature float32  `json:"temperature,omitempty"`
	Stream      bool     `json:"stream,omitempty"`
}

type oaiChatResp struct {
	Choices []struct {
		Message      oaiMsg `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Model string `json:"model"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

// Generate implements Provider.
func (o *OpenAI) Generate(ctx context.Context, req Request) (*Response, error) {
	body, err := json.Marshal(o.buildChat(req, false))
	if err != nil {
		return nil, err
	}
	httpReq, err := o.newRequest(ctx, "/v1/chat/completions", body)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	resp, err := o.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("openai %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("openai %d: %s", resp.StatusCode, string(raw))
	}
	var or oaiChatResp
	if err := json.Unmarshal(raw, &or); err != nil {
		return nil, fmt.Errorf("openai decode: %w", err)
	}
	if len(or.Choices) == 0 {
		return nil, fmt.Errorf("openai: empty choices")
	}
	return &Response{
		Content:          or.Choices[0].Message.Content,
		PromptTokens:     or.Usage.PromptTokens,
		CompletionTokens: or.Usage.CompletionTokens,
		Model:            or.Model,
		Provider:         "openai",
		Latency:          time.Since(start),
		StopReason:       or.Choices[0].FinishReason,
	}, nil
}

type oaiEmbedReq struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type oaiEmbedResp struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
}

// Embed implements Provider.
func (o *OpenAI) Embed(ctx context.Context, input []string) ([][]float32, error) {
	body, err := json.Marshal(oaiEmbedReq{Model: "text-embedding-3-small", Input: input})
	if err != nil {
		return nil, err
	}
	httpReq, err := o.newRequest(ctx, "/v1/embeddings", body)
	if err != nil {
		return nil, err
	}
	resp, err := o.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("openai embed %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("openai embed %d: %s", resp.StatusCode, string(raw))
	}
	var er oaiEmbedResp
	if err := json.Unmarshal(raw, &er); err != nil {
		return nil, fmt.Errorf("openai embed decode: %w", err)
	}
	out := make([][]float32, len(er.Data))
	for _, d := range er.Data {
		if d.Index < len(out) {
			out[d.Index] = d.Embedding
		}
	}
	return out, nil
}

// Stream implements Streamer (SSE).
func (o *OpenAI) Stream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	body, err := json.Marshal(o.buildChat(req, true))
	if err != nil {
		return nil, err
	}
	httpReq, err := o.newRequest(ctx, "/v1/chat/completions", body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Accept", "text/event-stream")
	resp, err := o.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, fmt.Errorf("openai stream %d: %s", resp.StatusCode, string(raw))
	}
	out := make(chan StreamChunk, 16)
	go consumeOAISSE(resp.Body, out)
	return out, nil
}

func (o *OpenAI) buildChat(req Request, stream bool) oaiChatReq {
	out := oaiChatReq{Model: req.Model, MaxTokens: req.MaxTokens, Temperature: req.Temperature, Stream: stream}
	for _, m := range req.Messages {
		out.Messages = append(out.Messages, oaiMsg{Role: m.Role, Content: m.Content})
	}
	return out
}

func (o *OpenAI) newRequest(ctx context.Context, path string, body []byte) (*http.Request, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)
	return httpReq, nil
}
