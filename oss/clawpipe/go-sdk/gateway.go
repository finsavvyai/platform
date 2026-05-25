package clawpipe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GatewayError is returned when the ClawPipe gateway returns a non-2xx status.
type GatewayError struct {
	StatusCode int
	Body       string
}

func (e *GatewayError) Error() string {
	msg := fmt.Sprintf("ClawPipe gateway error: %d", e.StatusCode)
	if e.Body != "" {
		b := e.Body
		if len(b) > 200 {
			b = b[:200]
		}
		msg += " — " + b
	}
	return msg
}

// gatewayConfig holds connection details for the gateway.
type gatewayConfig struct {
	URL       string
	APIKey    string
	ProjectID string
}

// Gateway is the HTTP client for the ClawPipe gateway API.
type Gateway struct {
	cfg    gatewayConfig
	client *http.Client
}

// NewGateway creates a Gateway with a 30-second timeout.
func NewGateway(url, apiKey, projectID string) *Gateway {
	return &Gateway{
		cfg:    gatewayConfig{URL: url, APIKey: apiKey, ProjectID: projectID},
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// Call sends a prompt to the gateway and returns the full response.
func (g *Gateway) Call(
	ctx context.Context,
	prompt string,
	opts *PromptOptions,
	route RouteDecision,
) (*GatewayResponse, error) {
	body := g.buildBody(prompt, opts, route)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		g.cfg.URL+"/prompt", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	g.setHeaders(req)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gateway request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &GatewayError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	var gr GatewayResponse
	if err := json.Unmarshal(respBody, &gr); err != nil {
		return nil, fmt.Errorf("failed to decode gateway response: %w", err)
	}
	return &gr, nil
}

// Stream sends a prompt and returns an io.ReadCloser for streaming chunks.
func (g *Gateway) Stream(
	ctx context.Context,
	prompt string,
	opts *PromptOptions,
	route RouteDecision,
) (io.ReadCloser, error) {
	body := g.buildBody(prompt, opts, route)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		g.cfg.URL+"/stream", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	g.setHeaders(req)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gateway stream failed: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, &GatewayError{StatusCode: resp.StatusCode, Body: string(b)}
	}
	return resp.Body, nil
}

func (g *Gateway) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.cfg.APIKey)
	req.Header.Set("X-Project-Id", g.cfg.ProjectID)
}

type gatewayPayload struct {
	Prompt      string  `json:"prompt"`
	System      string  `json:"system,omitempty"`
	MaxTokens   int     `json:"maxTokens,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
	Model       string  `json:"model,omitempty"`
	Provider    string  `json:"provider,omitempty"`
	TaskType    string  `json:"taskType,omitempty"`
}

func (g *Gateway) buildBody(prompt string, opts *PromptOptions, route RouteDecision) []byte {
	p := gatewayPayload{Prompt: prompt, Provider: route.Provider, Model: route.Model}
	if opts != nil {
		p.System = opts.System
		p.MaxTokens = opts.MaxTokens
		p.Temperature = opts.Temperature
		p.TaskType = opts.TaskType
	}
	b, _ := json.Marshal(p)
	return b
}
