package sdln

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the main SDLC.ai client
type Client struct {
	config      *Config
	httpClient  *http.Client
	auth        Authenticator
	middleware  []Middleware
	retryConfig *RetryConfig
	pools       *Pools
	crypto      CryptoManager

	// Service clients
	Users              *UserService
	Tenants            *TenantService
	Documents          *DocumentService
	RAG                *RAGService
	Vector             *VectorService
	Policies           *PoliciesService
	LLM                *LLMService
	Monitoring         *MonitoringService
	MonitoringEnhanced *MonitoringEnhanced
	WebSocket          *WebSocketService
	DLP                *DLPService
	Seamless           *SeamlessService
}

// Config holds client configuration
type Config struct {
	// Required
	BaseURL string

	// Authentication
	APIKey string

	// HTTP client settings
	Timeout             time.Duration
	MaxIdleConns        int
	MaxIdleConnsPerHost int
	IdleConnTimeout     time.Duration
	TLSHandshakeTimeout time.Duration

	// Retry settings
	RetryConfig *RetryConfig

	// Debug mode
	Debug bool

	// User agent
	UserAgent string
}

// RetryConfig controls retry behavior
type RetryConfig struct {
	MaxRetries      int
	InitialBackoff  time.Duration
	MaxBackoff      time.Duration
	BackoffFactor   float64
	RetryableErrors []string
	Jitter          bool
}

// DefaultRetryConfig returns a default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:      3,
		InitialBackoff:  100 * time.Millisecond,
		MaxBackoff:      5 * time.Second,
		BackoffFactor:   2.0,
		RetryableErrors: []string{"timeout", "connection_error", "rate_limit", "internal_error"},
		Jitter:          true,
	}
}

// DefaultConfig returns a default client configuration
func DefaultConfig() *Config {
	return &Config{
		Timeout:             30 * time.Second,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		RetryConfig:         DefaultRetryConfig(),
		UserAgent:           "sdln-sdk-go/1.0.0",
		Debug:               false,
	}
}

// NewClient creates a new SDLC.ai client
func NewClient(config *Config, options ...ClientOption) (*Client, error) {
	if config == nil {
		config = DefaultConfig()
	}

	// Ensure base URL is set
	if config.BaseURL == "" {
		config.BaseURL = "https://api.sdlc.cc"
	}

	client := &Client{
		config:      config,
		middleware:  make([]Middleware, 0),
		retryConfig: config.RetryConfig,
	}

	// Apply options
	for _, option := range options {
		if err := option(client); err != nil {
			return nil, err
		}
	}

	// Initialize HTTP client
	client.httpClient = &http.Client{
		Timeout: client.config.Timeout,
		Transport: &http.Transport{
			MaxIdleConns:        client.config.MaxIdleConns,
			MaxIdleConnsPerHost: client.config.MaxIdleConnsPerHost,
			IdleConnTimeout:     client.config.IdleConnTimeout,
			TLSHandshakeTimeout: client.config.TLSHandshakeTimeout,
		},
	}

	// Initialize pools
	client.pools = NewPools()

	// Initialize crypto manager
	client.crypto = *NewCryptoManager()

	// Initialize service clients
	client.Users = NewUserService(client)
	client.Tenants = NewTenantService(client)
	client.Documents = NewDocumentService(client)
	client.RAG = NewRAGService(client)
	client.Vector = NewVectorService(client)
	client.Policies = NewPoliciesService(client)
	client.LLM = NewLLMService(client)
	client.Monitoring = NewMonitoringService(client)
	client.MonitoringEnhanced = NewMonitoringEnhanced(client)
	client.WebSocket = NewWebSocketService(client)
	client.DLP = NewDLPService(client)
	client.Seamless = NewSeamlessService(client)

	return client, nil
}

// ClientOption configures the client
type ClientOption func(*Client) error

// WithAPIKey returns a ClientOption that sets the API key for authentication
func WithAPIKey(apiKey string) ClientOption {
	return func(c *Client) error {
		c.config.APIKey = apiKey
		return nil
	}
}

// Use adds middleware to the client
func (c *Client) Use(middleware Middleware) {
	c.middleware = append(c.middleware, middleware)
}

// do executes an HTTP request with middleware and retry logic
func (c *Client) do(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Set user agent
	if c.config.UserAgent != "" {
		req.Header.Set("User-Agent", c.config.UserAgent)
	}

	// Apply pre-request middleware
	for _, mw := range c.middleware {
		httpReq := newHTTPRequest(req)
		if err := mw.BeforeRequest(ctx, *httpReq); err != nil {
			return nil, err
		}
	}

	// Execute request with retry
	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, err
	}

	// Apply post-response middleware
	for _, mw := range c.middleware {
		httpResp := newHTTPResponse(resp)
		if err := mw.AfterResponse(ctx, httpResp); err != nil {
			resp.Body.Close()
			return nil, err
		}
	}

	return resp, nil
}

// doWithRetry executes an HTTP request with retry logic
func (c *Client) doWithRetry(ctx context.Context, req *http.Request) (*http.Response, error) {
	if c.retryConfig == nil {
		return c.httpClient.Do(req.WithContext(ctx))
	}

	retryer := NewRetryer(c.retryConfig)
	var resp *http.Response
	var err error

	retryErr := retryer.Do(ctx, func() error {
		// Clone request for each retry
		reqClone := req.Clone(ctx)
		if reqClone == nil {
			return fmt.Errorf("failed to clone request")
		}

		resp, err = c.httpClient.Do(reqClone)
		if err != nil {
			return err
		}

		// Check if response indicates an error that should be retried
		if resp.StatusCode >= 500 || resp.StatusCode == 429 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			// Create API error from response
			apiErr := &APIError{
				Type:       getErrorTypeFromStatus(resp.StatusCode),
				StatusCode: resp.StatusCode,
				Message:    string(body),
				Timestamp:  time.Now().UTC(),
			}

			return apiErr
		}

		return nil
	})

	if retryErr != nil {
		if resp != nil {
			resp.Body.Close()
		}
		return nil, retryErr
	}

	return resp, nil
}

// getErrorTypeFromStatus maps HTTP status to error type
func getErrorTypeFromStatus(status int) ErrorType {
	switch {
	case status == 429:
		return ErrTypeRateLimit
	case status >= 500:
		return ErrTypeInternalError
	case status == 408:
		return ErrTypeTimeout
	default:
		return ErrTypeInternalError
	}
}

// Ask performs a seamless query with automatic orchestration
func (c *Client) Ask(ctx context.Context, query string, options *SeamlessOptions) (*SeamlessResponse, error) {
	return c.Seamless.Ask(ctx, query, options)
}

// AskStream performs a streaming seamless query
func (c *Client) AskStream(ctx context.Context, query string, options *SeamlessOptions) (<-chan *StreamingSeamlessResponse, error) {
	return c.Seamless.AskStream(ctx, query, options)
}

// UploadDocument seamlessly uploads and processes a document
func (c *Client) UploadDocument(ctx context.Context, filePath string, options *SeamlessOptions) (*Document, error) {
	return c.Seamless.UploadDocument(ctx, filePath, options)
}

// Search performs seamless search across all available sources
func (c *Client) Search(ctx context.Context, query string, options *SeamlessOptions) (*SearchResults, error) {
	return c.Seamless.Search(ctx, query, options)
}

// GetInsights generates AI insights from data analysis
func (c *Client) GetInsights(ctx context.Context, topic string, options *SeamlessOptions) (*Insights, error) {
	return c.Seamless.GetInsights(ctx, topic, options)
}

// NewAutoClient creates a pre-configured client for seamless operation
func NewAutoClient(apiKey string) *Client {
	config := &Config{
		BaseURL: "https://api.sdlc.cc",
		Timeout: 30 * time.Second,
	}

	client, _ := NewClient(config, WithAPIKey(apiKey))
	return client
}

// IsHealthy checks if the system is healthy
func (c *Client) IsHealthy() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	health, err := c.Monitoring.GetHealth(ctx, "", []string{})
	if err != nil {
		return false
	}

	return health.Status == "healthy"
}

// WaitForBackgroundTasks waits for background tasks to complete
func (c *Client) WaitForBackgroundTasks() {
	// This would check for any background processing and wait
	// For now, just sleep briefly
	time.Sleep(100 * time.Millisecond)
}

// doRequest performs an HTTP request against the client's base URL
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	return c.httpClient.Do(req)
}

// doRequestWithQuery performs an HTTP request with query parameters
func (c *Client) doRequestWithQuery(ctx context.Context, method, path string, query map[string]string, body interface{}) (*http.Response, error) {
	if len(query) > 0 {
		path += "?"
		first := true
		for k, v := range query {
			if !first {
				path += "&"
			}
			path += k + "=" + v
			first = false
		}
	}
	return c.doRequest(ctx, method, path, body)
}

// LearningEngine returns the learning engine service (placeholder)
func (c *Client) LearningEngine() LearningEngineInterface {
	// TODO: Implement LearningEngine service
	return nil
}

// PerformanceOptimizer returns the performance optimizer service (placeholder)
func (c *Client) PerformanceOptimizer() PerformanceOptimizerInterface {
	// TODO: Implement PerformanceOptimizer service
	return nil
}

// QuantumCryptoManager returns the quantum crypto manager service (placeholder)
func (c *Client) QuantumCryptoManager() QuantumCryptoManagerInterface {
	// TODO: Implement QuantumCryptoManager service
	return nil
}

// ComplianceEngine returns the compliance engine service (placeholder)
func (c *Client) ComplianceEngine() ComplianceEngineInterface {
	// TODO: Implement ComplianceEngine service
	return nil
}

// Close closes the client and releases resources
func (c *Client) Close() error {
	if c.pools != nil {
		c.pools.Close()
	}
	return nil
}

// Retryer implements retry logic for HTTP requests
type Retryer struct {
	config *RetryConfig
}

// NewRetryer creates a new retryer with the given configuration
func NewRetryer(config *RetryConfig) *Retryer {
	return &Retryer{config: config}
}

// Do executes fn with retry logic
func (r *Retryer) Do(ctx context.Context, fn func() error) error {
	var lastErr error
	for attempt := 0; attempt <= r.config.MaxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if attempt < r.config.MaxRetries {
			backoff := r.config.InitialBackoff * time.Duration(1<<uint(attempt))
			if backoff > r.config.MaxBackoff {
				backoff = r.config.MaxBackoff
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}
	}
	return lastErr
}
