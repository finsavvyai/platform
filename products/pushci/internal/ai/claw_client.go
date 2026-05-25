package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const clawEndpoint = "https://claw-gateway.broad-dew-49ad.workers.dev"

// ClawClient calls the Claw Gateway for AI-powered analysis.
type ClawClient struct {
	APIKey    string
	ProjectID string
	Endpoint  string
}

// NewClawClient creates a Claw Gateway client from env vars.
func NewClawClient(apiKey, projectID string) *ClawClient {
	endpoint := os.Getenv("CLAW_GATEWAY_URL")
	if endpoint == "" {
		endpoint = clawEndpoint
	}
	return &ClawClient{
		APIKey:    apiKey,
		ProjectID: projectID,
		Endpoint:  endpoint,
	}
}

// NewClawClientFromEnv creates a client reading all config from env.
func NewClawClientFromEnv() *ClawClient {
	return NewClawClient(
		os.Getenv("CLAW_API_KEY"),
		os.Getenv("CLAW_PROJECT_ID"),
	)
}

// IsConfigured returns true if API key and project ID are set.
func (c *ClawClient) IsConfigured() bool {
	return c.APIKey != "" && c.ProjectID != ""
}

type clawRequest struct {
	ProjectID string `json:"project_id"`
	System    string `json:"system,omitempty"`
	Prompt    string `json:"prompt"`
	MaxTokens int    `json:"max_tokens"`
}

type clawResponse struct {
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

// Prompt sends a system+user message through the Claw Gateway.
func (c *ClawClient) Prompt(ctx context.Context, system, user string, maxTokens int) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("claw gateway: CLAW_API_KEY or CLAW_PROJECT_ID not set")
	}
	if maxTokens <= 0 {
		maxTokens = 2000
	}
	body, _ := json.Marshal(clawRequest{
		ProjectID: c.ProjectID,
		System:    system,
		Prompt:    user,
		MaxTokens: maxTokens,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", c.Endpoint+"/v1/prompt", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("claw gateway: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("claw gateway: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("claw gateway %d: %s", resp.StatusCode, b)
	}
	var result clawResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("claw gateway decode: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("claw gateway: %s", result.Error)
	}
	if result.Result == "" {
		return "", fmt.Errorf("claw gateway: empty response")
	}
	return result.Result, nil
}
