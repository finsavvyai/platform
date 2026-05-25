package sdln

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// BaseService provides common functionality for all service clients
type BaseService struct {
	client     *Client
	serviceURL string
	name       string
}

// NewBaseService creates a new base service
func NewBaseService(client *Client, name, path string) *BaseService {
	return &BaseService{
		client:     client,
		serviceURL: client.config.BaseURL + "/" + path,
		name:       name,
	}
}

// Name returns the service name
func (s *BaseService) Name() string {
	return s.name
}

// Client returns the underlying client
func (s *BaseService) Client() *Client {
	return s.client
}

// HealthCheck checks the service health
func (s *BaseService) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", s.serviceURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := s.client.do(ctx, req)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("service unhealthy: status %d", resp.StatusCode)
	}

	return nil
}

// doRequest performs an HTTP request with proper error handling
func (s *BaseService) doRequest(ctx context.Context, method, path string, headers map[string]string, body interface{}, result interface{}) error {
	// Build URL
	fullURL, err := url.JoinPath(s.serviceURL, path)
	if err != nil {
		return fmt.Errorf("failed to build URL: %w", err)
	}

	// Marshal body if provided
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// Add authentication
	if s.client.auth != nil {
		httpReq := newHTTPRequest(req)
		if err := s.client.auth.Authenticate(ctx, httpReq); err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}
	}

	// Execute request
	resp, err := s.client.do(ctx, req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for error response
	if resp.StatusCode >= 400 {
		apiErr, err := ValidateAPIError(respBody)
		if err != nil {
			apiErr = &APIError{
				Type:       getErrorTypeFromStatus(resp.StatusCode),
				Message:    string(respBody),
				StatusCode: resp.StatusCode,
				Timestamp:  time.Now().UTC(),
			}
		}
		apiErr.StatusCode = resp.StatusCode
		return apiErr
	}

	// Unmarshal result if provided
	if result != nil && len(respBody) > 0 {
		if err := ValidateAPIResponse(respBody, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

// doGet performs a GET request
func (s *BaseService) doGet(ctx context.Context, path string, result interface{}) error {
	return s.doRequest(ctx, http.MethodGet, path, nil, nil, result)
}

// doPost performs a POST request
func (s *BaseService) doPost(ctx context.Context, path string, body interface{}, result interface{}) error {
	return s.doRequest(ctx, http.MethodPost, path, nil, body, result)
}

// doPut performs a PUT request
func (s *BaseService) doPut(ctx context.Context, path string, body interface{}, result interface{}) error {
	return s.doRequest(ctx, http.MethodPut, path, nil, body, result)
}

// doPatch performs a PATCH request
func (s *BaseService) doPatch(ctx context.Context, path string, body interface{}, result interface{}) error {
	return s.doRequest(ctx, http.MethodPatch, path, nil, body, result)
}

// doDelete performs a DELETE request
func (s *BaseService) doDelete(ctx context.Context, path string) error {
	return s.doRequest(ctx, http.MethodDelete, path, nil, nil, nil)
}

// buildQuery builds a query string from filters
func (s *BaseService) buildQuery(filters map[string]interface{}) string {
	if len(filters) == 0 {
		return ""
	}
	values := url.Values{}
	for k, v := range filters {
		values.Add(k, fmt.Sprintf("%v", v))
	}
	return "?" + values.Encode()
}

// buildPath builds a path with parameters
func (s *BaseService) buildPath(template string, params map[string]string) string {
	path := template
	for k, v := range params {
		path = url.PathEscape(path)
		path = fmt.Sprintf(path, v)
	}
	return path
}
