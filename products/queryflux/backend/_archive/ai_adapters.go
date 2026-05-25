package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"


)

// OpenAIAdapter implements the ExternalAIAPIClient interface for OpenAI
type OpenAIAdapter struct {
	baseURL   string
	timeout   time.Duration
	apiKey    string
	userAgent string
}

func (c *OpenAIAdapter) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"Authorization": "Bearer " + c.apiKey,
		"Content-Type":  "application/json",
		"User-Agent":    c.userAgent,
	}

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Make request with timeout
	client := &http.Client{Timeout: c.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode >= 400 {
		var apiErr struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		json.Unmarshal(respBody, &apiErr)
		if apiErr.Error.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

func (c *OpenAIAdapter) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"Authorization": "Bearer " + c.apiKey,
		"Content-Type":  "application/json",
		"User-Agent":    c.userAgent,
	}

	// Add streaming header
	reqHeaders["Accept"] = "text/event-stream"

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Create channel for streaming responses
	ch := make(chan []byte, 100)

	// Start streaming in goroutine
	go func() {
		defer close(ch)

		client := &http.Client{Timeout: c.timeout}
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return
		}

		// Read stream line by line
		decoder := json.NewDecoder(resp.Body)
		for {
			var event struct {
				Data string `json:"data"`
			}
			if err := decoder.Decode(&event); err != nil {
				break
			}
			if event.Data == "[DONE]" {
				break
			}
			if event.Data != "" {
				ch <- []byte(event.Data)
			}
		}
	}()

	return ch, nil
}

func (c *OpenAIAdapter) SetAPIKey(apiKey string) {
	c.apiKey = apiKey
}

func (c *OpenAIAdapter) SetBaseURL(baseURL string) {
	c.baseURL = baseURL
}

func (c *OpenAIAdapter) SetTimeout(timeout time.Duration) {
	c.timeout = timeout
}

func (c *OpenAIAdapter) ValidateAPIKey(ctx context.Context) error {
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Make a simple request to validate the API key
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create validation request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("User-Agent", c.userAgent)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API key validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return fmt.Errorf("invalid API key")
	} else if resp.StatusCode >= 400 {
		return fmt.Errorf("API key validation failed with status %d", resp.StatusCode)
	}

	return nil
}

func (c *OpenAIAdapter) ValidateConfiguration() error {
	if c.baseURL == "" {
		return fmt.Errorf("base URL is required")
	}
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}
	if c.timeout <= 0 {
		return fmt.Errorf("timeout must be greater than 0")
	}
	if c.userAgent == "" {
		return fmt.Errorf("user agent is required")
	}
	return nil
}

func (c *OpenAIAdapter) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	// OpenAI rate limits are included in response headers
	// This would require making a test request to get current limits
	return map[string]interface{}{
		"requests_per_minute": 3500,
		"tokens_per_minute":   90000,
		"daily_requests":      10000,
	}, nil
}

func (c *OpenAIAdapter) ResetRateLimit(ctx context.Context) error {
	// Rate limits reset automatically per minute/hour/day
	// No manual reset available for OpenAI
	return nil
}

// ClaudeAdapter implements the ExternalAIAPIClient interface for Claude (Anthropic)
type ClaudeAdapter struct {
	baseURL   string
	timeout   time.Duration
	apiKey    string
	userAgent string
}

func (c *ClaudeAdapter) MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"x-api-key":         c.apiKey,
		"Content-Type":      "application/json",
		"anthropic-version": "2023-06-01",
		"User-Agent":        c.userAgent,
	}

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Make request with timeout
	client := &http.Client{Timeout: c.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode >= 400 {
		var apiErr struct {
			Error struct {
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"error"`
		}
		json.Unmarshal(respBody, &apiErr)
		if apiErr.Error.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

func (c *ClaudeAdapter) StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	// Prepare request headers
	reqHeaders := map[string]string{
		"x-api-key":         c.apiKey,
		"Content-Type":      "application/json",
		"anthropic-version": "2023-06-01",
		"User-Agent":        c.userAgent,
	}

	// Add streaming header
	reqHeaders["Accept"] = "text/event-stream"

	// Add custom headers
	for k, v := range headers {
		reqHeaders[k] = v
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := c.baseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for k, v := range reqHeaders {
		req.Header.Set(k, v)
	}

	// Create channel for streaming responses
	ch := make(chan []byte, 100)

	// Start streaming in goroutine
	go func() {
		defer close(ch)

		client := &http.Client{Timeout: c.timeout}
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			return
		}

		// Read stream line by line
		decoder := json.NewDecoder(resp.Body)
		for {
			var event struct {
				Type  string `json:"type"`
				Delta string `json:"delta"`
			}
			if err := decoder.Decode(&event); err != nil {
				break
			}
			if event.Type == "content_block_delta" && event.Delta != "" {
				ch <- []byte(event.Delta)
			}
		}
	}()

	return ch, nil
}

func (c *ClaudeAdapter) SetAPIKey(apiKey string) {
	c.apiKey = apiKey
}

func (c *ClaudeAdapter) SetBaseURL(baseURL string) {
	c.baseURL = baseURL
}

func (c *ClaudeAdapter) SetTimeout(timeout time.Duration) {
	c.timeout = timeout
}

func (c *ClaudeAdapter) ValidateAPIKey(ctx context.Context) error {
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Make a simple request to validate the API key
	payload := map[string]interface{}{
		"model": "claude-3-haiku-20240307",
		"max_tokens": 10,
		"messages": []map[string]string{
			{"role": "user", "content": "Hi"},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal validation payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create validation request: %w", err)
	}

	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("User-Agent", c.userAgent)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API key validation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return fmt.Errorf("invalid API key")
	} else if resp.StatusCode >= 400 {
		return fmt.Errorf("API key validation failed with status %d", resp.StatusCode)
	}

	return nil
}

func (c *ClaudeAdapter) ValidateConfiguration() error {
	if c.baseURL == "" {
		return fmt.Errorf("base URL is required")
	}
	if c.apiKey == "" {
		return fmt.Errorf("API key is required")
	}
	if c.timeout <= 0 {
		return fmt.Errorf("timeout must be greater than 0")
	}
	if c.userAgent == "" {
		return fmt.Errorf("user agent is required")
	}
	return nil
}

func (c *ClaudeAdapter) GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error) {
	// Claude rate limits
	return map[string]interface{}{
		"requests_per_minute": 1000,
		"tokens_per_minute":   80000,
		"daily_requests":      5000,
	}, nil
}

func (c *ClaudeAdapter) ResetRateLimit(ctx context.Context) error {
	// Rate limits reset automatically
	return nil
}