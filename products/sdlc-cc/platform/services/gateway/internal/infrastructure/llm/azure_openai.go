// Package llm — Azure OpenAI provider.
//
// REAL HTTP wrapper. Azure differs from public OpenAI in two ways:
//
//  1. URL pattern: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...
//  2. Auth header: api-key: <key> (not Bearer)
//
// The deployment id is per-tenant Azure config and replaces the
// model field on the wire. We keep the Request.Model as the logical
// model alias and map deployment id at construction time.
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

// AzureOpenAI implements Provider.
type AzureOpenAI struct {
	apiKey     string
	endpoint   string // e.g. https://my-resource.openai.azure.com
	deployment string // Azure deployment id
	apiVersion string // e.g. 2024-02-15-preview
	hc         *http.Client
}

// NewAzureOpenAI configures a deployment-scoped client.
func NewAzureOpenAI(apiKey, endpoint, deployment, apiVersion string) *AzureOpenAI {
	if apiVersion == "" {
		apiVersion = "2024-02-15-preview"
	}
	return &AzureOpenAI{
		apiKey:     apiKey,
		endpoint:   strings.TrimRight(endpoint, "/"),
		deployment: deployment,
		apiVersion: apiVersion,
		hc:         &http.Client{Timeout: 60 * time.Second},
	}
}

// Name implements Provider.
func (a *AzureOpenAI) Name() string { return "azure_openai" }

// Generate implements Provider.
func (a *AzureOpenAI) Generate(ctx context.Context, req Request) (*Response, error) {
	body, err := json.Marshal(buildAzureChat(req))
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/openai/deployments/%s/chat/completions?api-version=%s",
		a.endpoint, a.deployment, a.apiVersion)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("api-key", a.apiKey)
	start := time.Now()
	resp, err := a.hc.Do(httpReq)
	if err != nil {
		return nil, Transient(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 500 {
		return nil, Transient(fmt.Errorf("azure %d: %s", resp.StatusCode, string(raw)))
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("azure %d: %s", resp.StatusCode, string(raw))
	}
	var or oaiChatResp
	if err := json.Unmarshal(raw, &or); err != nil {
		return nil, fmt.Errorf("azure decode: %w", err)
	}
	if len(or.Choices) == 0 {
		return nil, fmt.Errorf("azure: empty choices")
	}
	return &Response{
		Content:          or.Choices[0].Message.Content,
		PromptTokens:     or.Usage.PromptTokens,
		CompletionTokens: or.Usage.CompletionTokens,
		Model:            a.deployment,
		Provider:         "azure_openai",
		Latency:          time.Since(start),
		StopReason:       or.Choices[0].FinishReason,
	}, nil
}

// Embed implements Provider — Azure exposes embeddings under a
// separate deployment; for now treat it as unsupported here and
// expect a dedicated embedding-deployment client.
func (a *AzureOpenAI) Embed(_ context.Context, _ []string) ([][]float32, error) {
	return nil, ErrEmbedUnsupported
}

func buildAzureChat(req Request) oaiChatReq {
	out := oaiChatReq{MaxTokens: req.MaxTokens, Temperature: req.Temperature}
	for _, m := range req.Messages {
		out.Messages = append(out.Messages, oaiMsg{Role: m.Role, Content: m.Content})
	}
	return out
}
