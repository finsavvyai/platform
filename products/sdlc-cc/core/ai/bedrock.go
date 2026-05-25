package ai

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

// BedrockClient implements the AISummarizer surface against AWS
// Bedrock's Anthropic-on-Bedrock API. Chosen over direct Anthropic
// for compliance pilots that require AWS-residency: prompts terminate
// in the customer's AWS account, never leaving their VPC if a
// PrivateLink endpoint is wired.
type BedrockClient struct {
	region  string
	model   string
	baseURL string
	hc      *http.Client
	signer  *sigV4Signer
	now     func() time.Time
}

// NewBedrockClient configures from env vars. Returns nil when
// AWS_BEDROCK_REGION is unset (callers can chain into fallback).
func NewBedrockClient() *BedrockClient {
	region := os.Getenv("AWS_BEDROCK_REGION")
	if region == "" {
		return nil
	}
	model := envOrDefault("AWS_BEDROCK_MODEL",
		"anthropic.claude-haiku-4-5-20251001-v1:0")
	return &BedrockClient{
		region:  region,
		model:   model,
		baseURL: fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com", region),
		hc:      &http.Client{Timeout: 60 * time.Second},
		signer: &sigV4Signer{
			accessKey:    os.Getenv("AWS_ACCESS_KEY_ID"),
			secretKey:    os.Getenv("AWS_SECRET_ACCESS_KEY"),
			sessionToken: os.Getenv("AWS_SESSION_TOKEN"),
			region:       region,
			service:      "bedrock",
		},
		now: time.Now,
	}
}

// SetBaseURL substitutes the endpoint (httptest only).
func (b *BedrockClient) SetBaseURL(u string) { b.baseURL = strings.TrimRight(u, "/") }

// SetClock pins the SigV4 timestamp (golden-vector tests).
func (b *BedrockClient) SetClock(fn func() time.Time) { b.now = fn }

// IsConfigured reports whether all required AWS creds + region are set.
func (b *BedrockClient) IsConfigured() bool {
	return b != nil && b.signer.accessKey != "" &&
		b.signer.secretKey != "" && b.region != ""
}

// Name implements Provider — see fallback.go.
func (b *BedrockClient) Name() string { return "bedrock" }

// Complete sends a single prompt and returns the model's text. Matches
// the AISummarizer interface so the AI handler can swap providers
// without branching on type.
func (b *BedrockClient) Complete(ctx context.Context, prompt string) (string, error) {
	body, err := json.Marshal(map[string]interface{}{
		"anthropic_version": "bedrock-2023-05-31",
		"max_tokens":        256,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		b.baseURL+"/model/"+b.model+"/invoke", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	b.signer.sign(req, body, b.now())
	resp, err := b.hc.Do(req)
	if err != nil {
		return "", fmt.Errorf("bedrock: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("bedrock %d: %s",
			resp.StatusCode, string(raw[:min(len(raw), 200)]))
	}
	return parseBedrockResponse(raw)
}
