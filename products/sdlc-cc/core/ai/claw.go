package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ClawEndpoint is the default Claw Gateway URL.
const ClawEndpoint = "https://claw-gateway.broad-dew-49ad.workers.dev"

// ClawClient communicates with the Claw Gateway for AI prompts.
type ClawClient struct {
	APIKey    string
	ProjectID string
	Endpoint  string
	client    *http.Client
}

// NewClawClient creates a client with default endpoint.
func NewClawClient(apiKey, projectID string) *ClawClient {
	return &ClawClient{
		APIKey:    apiKey,
		ProjectID: projectID,
		Endpoint:  ClawEndpoint,
		client:    http.DefaultClient,
	}
}

type clawRequest struct {
	ProjectID string `json:"project_id"`
	System    string `json:"system"`
	User      string `json:"user"`
	MaxTokens int    `json:"max_tokens"`
}

type clawResponse struct {
	Text  string `json:"text"`
	Error string `json:"error,omitempty"`
}

// Prompt sends a system+user prompt to the Claw Gateway.
func (c *ClawClient) Prompt(
	ctx context.Context,
	system, user string,
	maxTokens int,
) (string, error) {
	body := clawRequest{
		ProjectID: c.ProjectID,
		System:    system,
		User:      user,
		MaxTokens: maxTokens,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("claw marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx, "POST", c.Endpoint+"/v1/prompt",
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", fmt.Errorf("claw request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("claw http: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("claw HTTP %d: %s",
			resp.StatusCode, truncate(data, 200))
	}

	var result clawResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return "", fmt.Errorf("claw decode: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("claw error: %s", result.Error)
	}
	return result.Text, nil
}

func truncate(b []byte, max int) string {
	if len(b) <= max {
		return string(b)
	}
	return string(b[:max])
}
