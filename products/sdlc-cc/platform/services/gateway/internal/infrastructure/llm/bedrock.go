// Package llm — AWS Bedrock provider.
//
// REAL HTTP wrapper. SigV4 in sigv4.go; eventstream parser coverage in
// bedrock_eventstream.go. Endpoints:
//   Generate: POST /model/{model}/invoke (Anthropic-on-Bedrock body)
//   Stream:   POST /model/{model}/invoke-with-response-stream
//   Embed:    POST /model/amazon.titan-embed-text-v1/invoke (Titan).
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

// Bedrock implements Provider + Streamer.
type Bedrock struct {
	region  string
	baseURL string
	hc      *http.Client
	signer  *sigV4Signer
	now     func() time.Time
}

// NewBedrock returns a configured client. SessionToken may be empty
// for static IAM users; SSO/STS callers supply it.
func NewBedrock(region, accessKey, secretKey, sessionToken string) *Bedrock {
	return &Bedrock{
		region:  region,
		baseURL: fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com", region),
		hc:      &http.Client{Timeout: 60 * time.Second},
		signer: &sigV4Signer{
			accessKey: accessKey, secretKey: secretKey, sessionToken: sessionToken,
			region: region, service: "bedrock",
		},
		now: time.Now,
	}
}

// SetBaseURL is for tests.
func (b *Bedrock) SetBaseURL(u string) { b.baseURL = strings.TrimRight(u, "/") }

// SetClock is for tests.
func (b *Bedrock) SetClock(fn func() time.Time) { b.now = fn }

// Name implements Provider.
func (b *Bedrock) Name() string { return "bedrock" }

type bedrockClaudeReq struct {
	AnthropicVersion string         `json:"anthropic_version"`
	MaxTokens        int            `json:"max_tokens"`
	Messages         []anthropicMsg `json:"messages"`
	System           string         `json:"system,omitempty"`
	Temperature      float32        `json:"temperature,omitempty"`
}

type bedrockClaudeResp struct {
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
func (b *Bedrock) Generate(ctx context.Context, req Request) (*Response, error) {
	body, err := json.Marshal(b.buildClaude(req))
	if err != nil {
		return nil, err
	}
	httpReq, err := b.newSignedRequest(ctx, "/model/"+req.Model+"/invoke", body)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	resp, err := b.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("bedrock %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("bedrock %d: %s", resp.StatusCode, string(raw))
	}
	var br bedrockClaudeResp
	if err := json.Unmarshal(raw, &br); err != nil {
		return nil, fmt.Errorf("bedrock decode: %w", err)
	}
	var sb strings.Builder
	for _, c := range br.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	return &Response{
		Content:          sb.String(),
		PromptTokens:     br.Usage.InputTokens,
		CompletionTokens: br.Usage.OutputTokens,
		Model:            req.Model,
		Provider:         "bedrock",
		Latency:          time.Since(start),
		StopReason:       br.StopReason,
	}, nil
}

type titanEmbedReq struct {
	InputText string `json:"inputText"`
}

type titanEmbedResp struct {
	Embedding []float32 `json:"embedding"`
}

// Embed implements Provider via Titan text embeddings.
func (b *Bedrock) Embed(ctx context.Context, input []string) ([][]float32, error) {
	out := make([][]float32, 0, len(input))
	for _, s := range input {
		body, err := json.Marshal(titanEmbedReq{InputText: s})
		if err != nil {
			return nil, err
		}
		httpReq, err := b.newSignedRequest(ctx, "/model/amazon.titan-embed-text-v1/invoke", body)
		if err != nil {
			return nil, err
		}
		resp, err := b.hc.Do(httpReq)
		if err != nil {
			return nil, Transient(err)
		}
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode >= 500 {
			return nil, Transient(fmt.Errorf("bedrock embed %d: %s", resp.StatusCode, string(raw)))
		}
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("bedrock embed %d: %s", resp.StatusCode, string(raw))
		}
		var er titanEmbedResp
		if err := json.Unmarshal(raw, &er); err != nil {
			return nil, fmt.Errorf("bedrock embed decode: %w", err)
		}
		out = append(out, er.Embedding)
	}
	return out, nil
}

// Stream implements Streamer. See package note re: parser coverage.
func (b *Bedrock) Stream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	body, err := json.Marshal(b.buildClaude(req))
	if err != nil {
		return nil, err
	}
	httpReq, err := b.newSignedRequest(ctx, "/model/"+req.Model+"/invoke-with-response-stream", body)
	if err != nil {
		return nil, err
	}
	resp, err := b.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, fmt.Errorf("bedrock stream %d: %s", resp.StatusCode, string(raw))
	}
	out := make(chan StreamChunk, 16)
	go consumeBedrockEventStream(resp.Body, out)
	return out, nil
}

func (b *Bedrock) buildClaude(req Request) bedrockClaudeReq {
	out := bedrockClaudeReq{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        req.MaxTokens,
		Temperature:      req.Temperature,
	}
	if out.MaxTokens == 0 {
		out.MaxTokens = 1024
	}
	for _, m := range req.Messages {
		if m.Role == "system" {
			out.System = m.Content
			continue
		}
		out.Messages = append(out.Messages, anthropicMsg{Role: m.Role, Content: m.Content})
	}
	return out
}

func (b *Bedrock) newSignedRequest(ctx context.Context, path string, body []byte) (*http.Request, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, b.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	b.signer.sign(httpReq, body, b.now())
	return httpReq, nil
}

