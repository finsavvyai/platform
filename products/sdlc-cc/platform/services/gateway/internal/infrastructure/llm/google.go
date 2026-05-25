// Package llm — Google Vertex AI Gemini provider.
//
// REAL HTTP wrapper. Auth uses an injected TokenSource so production
// can wire google.golang.org/x/oauth2/google service-account flow and
// tests can use a static token without dragging the dep into this file.
// Wire shapes live in google_types.go; SSE in google_sse.go.
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

// TokenSource returns a Bearer token for Vertex AI calls.
type TokenSource interface {
	Token(ctx context.Context) (string, error)
}

// StaticTokenSource is the test/dev source that returns a fixed token.
type StaticTokenSource string

// Token implements TokenSource.
func (s StaticTokenSource) Token(_ context.Context) (string, error) {
	if string(s) == "" {
		return "", fmt.Errorf("google: empty static token")
	}
	return string(s), nil
}

// Google implements Provider + Streamer for Vertex AI Gemini.
type Google struct {
	project    string
	region     string
	baseURL    string
	tokens     TokenSource
	embedModel string
	hc         *http.Client
}

// NewVertex builds a Vertex AI client. Production wires a service-account
// TokenSource; tests inject StaticTokenSource("test-token").
func NewVertex(project, region string, ts TokenSource) *Google {
	return &Google{
		project:    project,
		region:     region,
		baseURL:    fmt.Sprintf("https://%s-aiplatform.googleapis.com", region),
		tokens:     ts,
		embedModel: "text-embedding-004",
		hc:         &http.Client{Timeout: 60 * time.Second},
	}
}

// SetBaseURL overrides the endpoint host (httptest).
func (g *Google) SetBaseURL(u string) { g.baseURL = strings.TrimRight(u, "/") }

// Name implements Provider.
func (g *Google) Name() string { return "google" }

// Generate implements Provider.
func (g *Google) Generate(ctx context.Context, req Request) (*Response, error) {
	body, err := json.Marshal(g.buildGen(req))
	if err != nil {
		return nil, err
	}
	path := fmt.Sprintf("/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
		g.project, g.region, req.Model)
	httpReq, err := g.newRequest(ctx, path, body)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	resp, err := g.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("vertex %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("vertex %d: %s", resp.StatusCode, string(raw))
	}
	var vr vertexGenResp
	if err := json.Unmarshal(raw, &vr); err != nil {
		return nil, fmt.Errorf("vertex decode: %w", err)
	}
	if len(vr.Candidates) == 0 {
		return nil, fmt.Errorf("vertex: empty candidates")
	}
	var sb strings.Builder
	for _, p := range vr.Candidates[0].Content.Parts {
		sb.WriteString(p.Text)
	}
	return &Response{
		Content:          sb.String(),
		PromptTokens:     vr.UsageMetadata.PromptTokenCount,
		CompletionTokens: vr.UsageMetadata.CandidatesTokenCount,
		Model:            firstNonEmpty(vr.ModelVersion, req.Model),
		Provider:         "google",
		Latency:          time.Since(start),
		StopReason:       vr.Candidates[0].FinishReason,
	}, nil
}

// Embed implements Provider via :predict on text-embedding-004.
func (g *Google) Embed(ctx context.Context, input []string) ([][]float32, error) {
	er := vertexEmbedReq{}
	for _, s := range input {
		er.Instances = append(er.Instances, vertexEmbedInstance{Content: s})
	}
	body, err := json.Marshal(er)
	if err != nil {
		return nil, err
	}
	path := fmt.Sprintf("/v1/projects/%s/locations/%s/publishers/google/models/%s:predict",
		g.project, g.region, g.embedModel)
	httpReq, err := g.newRequest(ctx, path, body)
	if err != nil {
		return nil, err
	}
	resp, err := g.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("vertex embed %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("vertex embed %d: %s", resp.StatusCode, string(raw))
	}
	var er2 vertexEmbedResp
	if err := json.Unmarshal(raw, &er2); err != nil {
		return nil, fmt.Errorf("vertex embed decode: %w", err)
	}
	out := make([][]float32, 0, len(er2.Predictions))
	for _, p := range er2.Predictions {
		out = append(out, p.Embeddings.Values)
	}
	return out, nil
}

// Stream implements Streamer via :streamGenerateContent.
func (g *Google) Stream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	body, err := json.Marshal(g.buildGen(req))
	if err != nil {
		return nil, err
	}
	path := fmt.Sprintf("/v1/projects/%s/locations/%s/publishers/google/models/%s:streamGenerateContent?alt=sse",
		g.project, g.region, req.Model)
	httpReq, err := g.newRequest(ctx, path, body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Accept", "text/event-stream")
	resp, err := g.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, fmt.Errorf("vertex stream %d: %s", resp.StatusCode, string(raw))
	}
	out := make(chan StreamChunk, 16)
	go consumeVertexSSE(resp.Body, out)
	return out, nil
}

func (g *Google) buildGen(req Request) vertexGenReq {
	out := vertexGenReq{}
	if req.MaxTokens > 0 || req.Temperature > 0 {
		out.GenerationConfig = &vertexGenCfg{MaxOutputTokens: req.MaxTokens, Temperature: req.Temperature}
	}
	for _, m := range req.Messages {
		if m.Role == "system" {
			out.SystemInstruction = &vertexContent{Parts: []vertexPart{{Text: m.Content}}}
			continue
		}
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		out.Contents = append(out.Contents, vertexContent{Role: role, Parts: []vertexPart{{Text: m.Content}}})
	}
	return out
}

func (g *Google) newRequest(ctx context.Context, path string, body []byte) (*http.Request, error) {
	tok, err := g.tokens.Token(ctx)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+tok)
	return httpReq, nil
}
