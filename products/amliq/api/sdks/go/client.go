package amliq

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the AMLIQ API client.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates an AMLIQ client with the given API key.
func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		baseURL:    "https://api.amliq.io/api/v1",
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Option configures the client.
type Option func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(url string) Option {
	return func(c *Client) { c.baseURL = url }
}

func (c *Client) do(ctx context.Context, method, path string, body, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("api call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return parseAPIError(resp)
	}
	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

func parseAPIError(resp *http.Response) error {
	var apiErr struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
		return fmt.Errorf("api error: status %d", resp.StatusCode)
	}
	return fmt.Errorf("api error %s: %s", apiErr.Code, apiErr.Message)
}
