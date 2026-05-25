package lemonsqueezy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// Config holds Lemon Squeezy configuration
type Config struct {
	APIKey        string
	APIBaseURL    string
	StoreID       string
	WebhookSecret string
}

// Client represents a Lemon Squeezy API client
type Client struct {
	config     *Config
	httpClient *http.Client
	logger     *zap.Logger
}

// NewClient creates a new Lemon Squeezy client
func NewClient(config *Config, logger *zap.Logger) *Client {
	if config.APIBaseURL == "" {
		config.APIBaseURL = "https://api.lemonsqueezy.com/v1"
	}

	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// GetStoreID returns the Store ID
func (c *Client) GetStoreID() string {
	return c.config.StoreID
}

// makeRequest makes an HTTP request to the Lemon Squeezy API
func (c *Client) makeRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.config.APIBaseURL+endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	c.logger.Debug("Making Lemon Squeezy API request",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
	)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("API request failed with status %d", resp.StatusCode)
		}
		resp.Body.Close()
		return nil, fmt.Errorf("API error: %s", apiErr.Error())
	}

	return resp, nil
}

// APIError represents a Lemon Squeezy API error
type APIError struct {
	Message string `json:"error"`
	Detail  string `json:"detail,omitempty"`
}

func (e APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Detail)
	}
	return e.Message
}
