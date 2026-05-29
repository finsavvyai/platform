package sdln

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ========================================
// Client Tests
// ========================================

func TestNewClient(t *testing.T) {
	t.Run("with valid config", func(t *testing.T) {
		config := &Config{
			BaseURL:      "https://api.sdlc.ai",
			Timeout:      30 * time.Second,
			RetryConfig:  DefaultRetryConfig(),
			Debug:        false,
		}

		client, err := NewClient(config, WithAPIKey("test-key"))
		assert.NoError(t, err)
		assert.NotNil(t, client)
		assert.Equal(t, config, client.GetConfig())
	})

	t.Run("with invalid config", func(t *testing.T) {
		config := &Config{
			BaseURL: "", // Invalid empty URL
		}

		_, err := NewClient(config, WithAPIKey("test-key"))
		assert.Error(t, err)
	})
}

func TestClient_Close(t *testing.T) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)

	err = client.Close()
	assert.NoError(t, err)
}

func TestClient_Use(t *testing.T) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)

	// Add middleware
	mockMiddleware := &BaseMiddleware{name: "test"}
	client.Use(mockMiddleware)

	assert.Len(t, client.middleware, 1)
	assert.Equal(t, "test", client.middleware[0].Name())
}

// ========================================
// Authentication Tests
// ========================================

func TestAPIKeyAuth_Authenticate(t *testing.T) {
	auth := WithAPIKey("test-api-key")
	assert.Equal(t, "api_key", auth.Type())
	assert.True(t, auth.IsValid())
}

func TestJWTAuth_Authenticate(t *testing.T) {
	auth := WithJWT("test-jwt-token")
	assert.Equal(t, "jwt", auth.Type())
	assert.True(t, auth.IsValid())
}

func TestOAuthConfig(t *testing.T) {
	config := &OAuthConfig{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost:8080/callback",
		Scopes:       []string{"read", "write"},
	}
	assert.Equal(t, "test-client", config.ClientID)
	assert.Equal(t, "test-secret", config.ClientSecret)
}

func TestMTLSConfig(t *testing.T) {
	config := &MTLSConfig{
		CertFile: "client.crt",
		KeyFile:  "client.key",
		CAFile:  "ca.crt",
	}
	assert.Equal(t, "client.crt", config.CertFile)
	assert.Equal(t, "client.key", config.KeyFile)
	assert.Equal(t, "ca.crt", config.CAFile)
}

// ========================================
// Configuration Tests
// ========================================

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	assert.Equal(t, "https://api.sdlc.ai", config.BaseURL)
	assert.Equal(t, 30*time.Second, config.Timeout)
	assert.NotNil(t, config.RetryConfig)
	assert.Equal(t, "sdln-sdk-go/1.0.0", config.UserAgent)
	assert.False(t, config.Debug)
}

func TestConfig_CustomConfig(t *testing.T) {
	config := &Config{
		BaseURL:            "https://custom.api.com",
		Timeout:            60 * time.Second,
		MaxIdleConns:       200,
		MaxIdleConnsPerHost: 50,
		IdleConnTimeout:     120 * time.Second,
		TLSHandshakeTimeout: 15 * time.Second,
		Debug:              true,
	}

	assert.Equal(t, "https://custom.api.com", config.BaseURL)
	assert.Equal(t, 60*time.Second, config.Timeout)
	assert.Equal(t, 200, config.MaxIdleConns)
}

func TestRetryConfig_Default(t *testing.T) {
	config := DefaultRetryConfig()

	assert.Equal(t, 3, config.MaxRetries)
	assert.Equal(t, 100*time.Millisecond, config.InitialBackoff)
	assert.Equal(t, 5*time.Second, config.MaxBackoff)
	assert.Equal(t, 2.0, config.BackoffFactor)
	assert.Equal(t, []string{"timeout", "connection_error", "rate_limit"}, config.RetryableErrors)
	assert.True(t, config.Jitter)
}

// ========================================
// Type Tests
// ========================================

func TestTime_MarshalJSON(t *testing.T) {
	testTime := NowTime()

	data, err := testTime.MarshalJSON()
	assert.NoError(t, err)
	assert.JSONEq(t, []byte(`"`+testTime.String()+`"`), data)
}

func TestTime_UnmarshalJSON(t *testing.T) {
	jsonStr := `"2024-01-15T10:30:00Z"`

	var timeVal Time
	err := json.Unmarshal([]byte(jsonStr), &timeVal)
	assert.NoError(t, err)
	assert.Equal(t, "2024-01-15T10:30:00Z", timeVal.String())
}

func TestTime_IsZero(t *testing.T) {
	var zero Time
	assert.True(t, zero.IsZero())

	now := NowTime()
	assert.False(t, now.IsZero())
}

func TestTime_BeforeAfter(t *testing.T) {
	time1 := NowTime()
	time2 := NowTime()

	assert.False(t, time1.Before(time2))
	assert.True(t, time2.Before(time1))
}

func TestTime_ToTime(t *testing.T) {
	timeVal := NowTime()
	goTime := time.Time(timeVal)

	assert.Equal(t, timeVal, goTime)
}

// ========================================
// Error Tests
// ========================================

func TestAPIError_Error(t *testing.T) {
	err := NewAPIError(ErrTypeNotFound, "not found", 404)

	assert.Equal(t, ErrTypeNotFound, err.Type)
	assert.Equal(t, "not found", err.Message)
	assert.Equal(t, 404, err.StatusCode)
	assert.NotNil(t, err.Timestamp)
	assert.Equal(t, "api_error", err.Type)
}

func TestAPIError_Unwrap(t *testing.T) {
	wrappedErr := fmt.Errorf("wrapped error: %w", fmt.Errorf("original error"))
	err := WrapAPIError(wrappedErr, ErrTypeInternalError, "database error", 500)

	assert.Equal(t, ErrTypeInternalError, err.Type)
	assert.Equal(t, "database error", err.Message)
	assert.True(t, errors.Is(err, ErrTypeInternalError))
	assert.Equal(t, wrappedErr, err.Unwrap())
}

func NewAPIError(errorType ErrorType, message string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Message:    message,
		StatusCode: statusCode,
		Timestamp:  time.Now().UTC(),
	}
}

func WrapAPIError(err error, errorType ErrorType, message string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Message:    message,
		StatusCode: statusCode,
		Timestamp: Time{Time: time.Now().UTC(),},
		wrapped:   err,
	}
}

func TestAPIError_IsRetryable(t *testing.T) {
	// Test retryable error types
		assert.True(t, NewAPIError(ErrTypeRateLimit, "rate limit", 429).IsRetryable())
		assert.True(t, NewAPIError(ErrTypeTimeout, "timeout", 408).IsRetryable())
		assert.True(t, NewAPIError(ErrTypeNetworkError, "connection error", 0).IsRetryable())
		assert.True(t, NewAPIError(ErrTypeInternalError, "server error", 500).IsRetryable())
		assert.True(t, NewAPIError(ErrTypeServiceUnavailable, "service unavailable", 503).IsRetryable())

		// Test non-retryable error types
		assert.False(t, NewAPIError(ErrTypeBadRequest, "bad request", 400).IsRetryable())
		assert.False(t, NewAPIError(ErrTypeUnauthorized, "unauthorized", 401).IsRetryable())
		assert.False(t, NewAPIError(ErrTypeForbidden, "forbidden", 403).IsRetryable())
		assert.False(t, NewAPIError(ErrTypeConflict, "conflict", 409).IsRetryable())
		assert.False(t, NewAPIError(ErrTypeValidationError, "validation error", 422).IsRetryable())
		assert.False(t, NewAPIError(ErrTypeNotFound, "not found", 404).IsRetryable())
	}
}

func TestAPIError_IsClientError(t *testing.T) {
	assert.True(t, NewAPIError(ErrTypeBadRequest, "bad request", 400).IsClientError())
	assert.True(t, NewAPIError(ErrTypeUnauthorized, "unauthorized", 401).IsClientError())
	assert.True(t, NewAPIError(ErrTypeForbidden, "forbidden", 403).IsClientError())
	assert.True(t, NewAPIError(ErrTypeNotFound, "not found", 404).IsClientError())
	assert.False(t, NewAPIError(ErrTypeInternalError, "server error", 500).IsClientError())
	assert.False(t, NewAPIError(ErrTypeServiceUnavailable, "service unavailable", 503).IsClientError())
}

func TestAPIError_IsServerError(t *testing.T) {
	assert.False(t, NewAPIError(ErrTypeBadRequest, "bad request", 400).IsServerError())
	assert.False, NewAPIError(ErrTypeUnauthorized, "unauthorized", 401).IsServerError())
	assert.False, NewAPIError(ErrTypeNotFound, "not found", 404).IsServerError())
	assert.True(t, NewAPIError(ErrTypeInternalError, "server error", 500).IsServerError())
	assert.True, NewAPIError(ErrTypeTimeout, "timeout", 408).IsServerError())
	assert.True, NewAPIError(ErrTypeServiceUnavailable, "service unavailable", 503).IsServerError())
}

// ========================================
// HTTP Wrapper Tests
// ========================================

func TestHTTPRequestBuilder(t *testing.T) {
	req := NewRequestBuilder("POST", "https://api.example.com")

	assert.Equal(t, "POST", req.Method())
	assert.Equal(t, "https://api.example.com", req.URL())

	// Add headers
	req.Header("Authorization", "Bearer token")
	req.Header("Content-Type", "application/json")

	// Add body
	req.JSONBody(map[string]interface{}{"key": "value"})

	// Build request
	httpReq, err := req.Build()
	assert.NoError(t, err)
	assert.Equal(t, "POST", httpReq.Method)
	assert.Equal(t, "https://api.example.com", httpReq.URL())
	assert.Equal(t, "Bearer token", httpReq.Header.Get("Authorization"))
	assert.Equal(t, "application/json", httpReq.Header.Get("Content-Type"))
}

func TestURLBuilder_Build(t *testing.T) {
	// Basic URL building
	url := NewURLBuilder("https://api.sdlc.ai")
	assert.Equal(t, "https://api.sdlc.ai", url.MustBuild())

	// Add path segments
	url.Path("v1", "users").Path("123")
	assert.Equal(t, "https://api.sdlc.ai/v1/users/123", url.MustBuild())

	// Add query parameters
	url.Query("page", "1").Query("limit", "10")
	assert.Equal(t, "https://api.sdlc.ai/v1/users?page=1&limit=10", url.MustBuild())

	// Add fragment
	url.Fragment("section1").Fragment("subsection1")
	assert.Equal(t, "https://api.sdlc.ai/v1/users?page=1&limit=10#section1#subsection1", url.MustBuild())
}

func TestFormBuilder_ToString(t *testing.T) {
	form := NewFormBuilder()

	form.Add("name", "John Doe")
	form.Add("email", "john@example.com")
	form.Add("age", "30")
	form.Add("tags", "tag1", "tag2", "tag3")

	expected := "email=john@example.com&name=John+Doe&age=30&tags=tag1&tags=tag2&tags=tag3"
	assert.Equal(t, expected, form.Encode())
}

func TestMultipartBuilder_CreatePDFUpload(t *testing.T) {
	builder := NewMultipartBuilder()

	fileContent := []byte("PDF content")

	err := builder.AddFile("document", "test.pdf", fileContent, "application/pdf")
	assert.NoError(t, err)

	reader, contentType, err := builder.Build()
	assert.NoError(t, err)
	assert.NotNil(t, reader)
	assert.Equal(t, "multipart/form-data; boundary=", contentType[:len(multipart/form-data; boundary=")-8)])
	assert.NotNil(t, reader)
}

// ========================================
// Retry Tests
// ========================================

func TestExponentialBackoff_NextDelay(t *testing.T) {
	backoff := NewExponentialBackoff(100*time.Millisecond, 5*time.Second, 2.0, true)

	// Test sequence
	assert.Equal(t, 100*time.Millisecond, backoff.NextDelay(0, nil))
	assert.Equal(t, 200*time.Millisecond, backoff.NextDelay(1, nil))
	assert.Equal(t, 400*time.Millisecond, backoff.NextDelay(2, nil))
	assert.Equal(t, 800*time.Millisecond, backoff.NextDelay(3, nil))

	// Test max capping
	assert.Equal(t, 5*time.Second, backoff.NextDelay(100, nil))
	assert.Equal(t, 5*time.Second, backoff.NextDelay(100, nil))
}

func TestLinearBackoff_NextDelay(t *testing.T) {
	backoff := NewLinearBackoff(50*time.Millisecond, 100*time.Millisecond, 2*time.Second, true)

	// Test sequence
	assert.Equal(t, 50*time.Millisecond, backoff.NextDelay(0, nil))
	assert.Equal(t, 150*time.Millisecond, backoff.NextDelay(1, nil))
	assert.Equal(t, 250*time.Millisecond, backoff.NextDelay(2, nil))
	assert.Equal(t, 350*time.Millisecond, backoff.NextDelay(3, nil))

	// Test max capping
	assert.Equal(t, 2*time.Second, backoff.NextDelay(100, nil))
	assert.Equal(t, 2*time.Second, backoff.NextDelay(100, nil))
}

func TestCustomBackoff_NextDelay(t *testing.T) {
	customNextDelay := func(attempt int, err error) time.Duration {
		if attempt < 3 {
			return time.Duration(attempt+1) * time.Second
		}
		return 10 * time.Second
	}

	backoff := NewCustomBackoff(customNextDelay, func() {
		// Reset callback
	})

	assert.Equal(t, 1*time.Second, backoff.NextDelay(0, nil))
	assert.Equal(t, 2*time.Second, backoff.NextDelay(1, nil))
	assert.Equal(t, 3*time.Second, backoff.NextDelay(2, nil))
}

// ========================================
// Middleware Tests
// ========================================

func TestLoggingMiddleware_BeforeRequest(t *testing.T) {
	logger := &DefaultLogger{level: LogLevelInfo}
	middleware := NewLoggingMiddleware(logger)

	req := &mockHTTPRequest{method: "GET", url: "https://api.example.com"}

	err := middleware.BeforeRequest(context.Background(), req)
	assert.NoError(t, err)
}

func TestMetricsMiddleware_BeforeRequest(t *testing.T) {
	collector := &DefaultMetricsCollector{}
	middleware := NewMetricsCollectorMiddleware(collector)

	req := &mockHTTPRequest{method: "GET", url: "https://api.example.com"}

	err := middleware.BeforeRequest(context.Background(), req)
	assert.NoError(t, err)
}

func AuthMiddleware_BeforeRequest(t *testing.T) {
	authenticator := &mockAuthenticator{}
	middleware := NewAuthMiddleware(authenticator)

	req := &mockHTTPRequest{method: "GET", url: "https://api.example.com"}

	err := middleware.BeforeRequest(context.Background(), req)
	assert.NoError(t, err)
}

// Mock implementations for testing
type mockHTTPRequest struct {
	method string
	url    string
	headers map[string][]string
}

func (m *mockHTTPRequest) Method() string { return m.method }
func (m *mockHTTPRequest) URL() string { return m.url }
func (m *mockHTTPRequest) Header(key string) string {
	if vals, exists := m.headers[key]; exists {
		return vals[0]
	}
	return ""
}

type mockAuthenticator struct{}
func (m *mockAuthenticator) Authenticate(ctx context.Context, req HTTPRequest) error {
	return nil
}

func (m *mockAuthenticator) IsValid() bool { return true }

type mockMetricsCollector struct{}
func (m *mockMetricsCollector) Counter(name string, tags map[string]string) sdln.Counter {
	return &defaultCounter{}
}
func (m *mockMetricsCollector) Gauge(name string, tags map[string]string) sdln.Gauge {
	return &defaultGauge{}
}
func (m *mockMetricsCollector) Histogram(name string, tags map[string]string) sdln.Histogram {
	return &defaultHistogram{}
}
func (m *mockMetricsCollector) Timer(name string, tags map[string]string) sdln.Timer {
	return &defaultTimer{}
}

type defaultCounter struct{}
func (c *defaultCounter) Add(value float64) {}
func (c *defaultCounter) Inc() {}

type defaultGauge struct{}
func (g *defaultGauge) Set(value float64) {}
func (g *defaultGauge) Add(value float64) {}
func (g *defaultGauge) Sub(value float64) {}

type defaultHistogram struct{}
func (h *defaultHistogram) Observe(value float64) {}

type defaultTimer struct {
	start time.Time
}
func (t *defaultTimer) Record(duration time.Duration) {}
func (t *defaultTimer) Start() sdln.Stopwatch {
	return &defaultStopwatch{start: time.Now()}
}

type defaultStopwatch struct {
	start time.Time
}
func (s *defaultStopwatch) Stop() time.Duration {
	return time.Since(s.start)
}

// ========================================
// Integration Tests
// ========================================

func TestClient_RealAPIOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration tests in short mode")
	}

	// Test would require actual API access
	config := &Config{
		BaseURL:      GetEnv("API_URL", "https://api.sdlc.ai"),
		Timeout:      30 * time.Second,
		Debug:        false,
	}

		client, err := NewClient(config, WithAPIKey(GetEnv("API_KEY", "")))
		if err != nil {
			t.Skip("Cannot create client for integration testing")
		}
		defer client.Close()

		// Test basic operations
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// List users
		users, err := client.Users.List(ctx, &ListOptions{Page: 1, PageSize: 5})
		if err != nil {
			t.Logf("Failed to list users: %v", err)
		} else {
			t.Logf("Successfully listed %d users", len(users.Data))
		}
	}
	}
}

func TestClient_ConcurrentOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrent operations test in short mode")
	}

	config := &Config{
		BaseURL:      GetEnv("API_URL", "https://api.sdlc.ai"),
		MaxIdleConns: 50,
		MaxIdleConnsPerHost: 10,
		Timeout:      60 * time.Second,
	}

		client, err := NewClient(config, WithAPIKey(GetEnv("API_KEY", "")))
		if err != nil {
			t.Skip("Cannot create client for concurrent testing")
		}
		defer client.Close()

		// Test concurrent user operations
		var wg sync.WaitGroup
		numUsers := 10
		semaphore := make(chan struct{}, 5)

		for i := 0; i < numUsers; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				user, err := client.Users.Get(ctx, fmt.Sprintf("user-%d", id))
				if err != nil {
					t.Logf("User %d error: %v", id, err)
					continue
				}
				t.Logf("User %d: %s %s", id, user.FirstName)
			}(i)
		}

		wg.Wait()
	}
}

// ========================================
// Benchmark Tests
// ========================================

func BenchmarkClient_NewClient(b *testing.B) {
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StartTimer()
		_, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
		if err != nil {
			b.Fatal(err)
		}
		client.Close()
		b.StopTimer()
	}
}

func BenchmarkUserService_List(b *testing.B) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)
	defer client.Close()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StartTimer()
		_, err := client.Users.List(context.Background(), &ListOptions{Page: 1, PageSize: 10})
		if err != nil {
			b.Fatal(err)
		}
		b.StopTimer()
	}
}

func BenchmarkDocumentService_Upload(b *testing.B) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)
	defer client.Close()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StartTimer()

		req := &UploadRequest{
			File:     mockFile("test.pdf", "application/pdf", 1024),
			Filename: "test.pdf",
			TenantID: "tenant-123",
			Metadata: DocumentMetadata{
				Title: "Test Document",
			},
		}

		_, err := client.Documents.Upload(context.Background(), req)
		if err != nil {
			b.Fatal(err)
		}
		b.StopTimer()
	}
}

func BenchmarkRAGService_Query(b *testing.B) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)
	defer client.Close()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StartTimer()

		req := &QueryRequest{
			Query:    "Test query " + fmt.Sprintf("%d", i),
			TenantID: "tenant-123",
			ContextOptions: &ContextOptions{
				MaxContextLength: 1000,
				MaxChunks:        5,
			},
		}

		_, err := client.RAG.Query(context.Background(), req)
		if err != nil {
			b.Fatal(err)
		}
		b.StopTimer()
	}
}

// Helper function for creating mock files
func mockFile(filename, contentType string, size int) *os.File {
	file, _ := os.CreateTempFile("", filename)
	defer file.Close()

	data := make([]byte, size)
	if size > 0 {
		for i := range data {
			data[i] = byte('A' + i%26)
		}
	}

	file.Write(data)
	return file
}

// ========================================
// Helper Functions
// ========================================

func DefaultConfig() *Config {
	return &Config{
		BaseURL:      "https://api.sdlc.ai",
	Timeout:      30 * time.Second,
		RetryConfig:  DefaultRetryConfig(),
		Debug:        false,
		UserAgent:     "sdln-sdk-go/1.0.0",
	}
}

func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries:      3,
		InitialBackoff:  100 * time.Millisecond,
		MaxBackoff:      5 * time.Second,
		BackoffFactor:   2.0,
		RetryableErrors: []string{"timeout", "connection_error", "rate_limit"},
		Jitter:          true,
	}
}

func WithAPIKey(key string) ClientOption {
	return func(client *Client) error {
		client.auth = WithAPIKey(key)
		return nil
	}
}

func WithJWT(token string) ClientOption {
	return func(client *Client) error {
		client.auth = WithJWT(token)
		return nil
	}
}

func WithOAuth(config *OAuthConfig) ClientOption {
	return func(client *Client) error {
		client.auth = WithOAuth(config)
		return nil
	}
}

func WithMTLS(config *MTLSConfig) ClientOption {
	return func(client *Client) error {
		client.auth = WithMTLS(config)
		return nil
	}
}

// ListOptions provides options for list operations
type ListOptions struct {
	Page     int `json:"page,omitempty"`
	PageSize int `json:"page_size,omitempty"`
	SortBy   string `json:"sort_by,omitempty"`
	SortDesc bool   `json:"sort_desc,omitempty"`
}

// UploadRequest represents a document upload request
type UploadRequest struct {
	File        *os.File
	Filename    string
	ContentType string
	Size        int64
	TenantID    string
	Metadata    DocumentMetadata
	Tags        []string
	IsPublic    bool
	IsEncrypted bool
}

// DocumentMetadata represents document metadata
type DocumentMetadata struct {
	Title       string            `json:"title,omitempty"`
	Description string            `json:"description,omitempty"`
	Author      string            `json:"author,omitempty"`
	Language    string            `json:"language,omitempty"`
	Category    string            `json:"category,omitempty"`
	CustomFields map[string]string `json:"custom_fields,omitempty"`
}

// ContextOptions controls context retrieval and assembly
type ContextOptions struct {
	MaxContextLength int     `json:"max_context_length,omitempty"`
	MaxChunks        int     `json:"max_chunks,omitempty"`
	MinSimilarity    float64           `json:"min_similarity,omitempty"`
	Strategy         string              `json:"strategy,omitempty"`
	IncludeCitations bool              `json:"include_citations,omitempty"`
	RecencyWeight    float64           `json:"recency_weight,omitempty"`
	AuthorityWeight  float64           `json:"authority_weight,omitempty"`
	DiversityWeight  float64           `json:"diversity_weight,omitempty"`
}

// RetrievalOptions controls document retrieval
type RetrievalOptions struct {
	SearchType    string               `json:"search_type,omitempty"`
	VectorIndex   string               `json:"vector_index,omitempty"`
	Filters      map[string]interface{} `json:"filters,omitempty"`
	DocumentTypes []string              `json:"document_types,omitempty"`
	Sources       []string              `json:"sources,omitempty"`
	DateRange     *DateRange          `json:"date_range,omitempty"`
	Rerank        bool                  `json:"rerank,omitempty"`
	RerankModel   string               `json:"rerank_model,omitempty"`
	MaxResults    int                   `json:"max_results,omitempty"`
}

// GenerationOptions controls LLM generation
type GenerationOptions struct {
	Model            string           `json:"model,omitempty"`
	MaxTokens        int               `json:"max_tokens,omitempty"`
	Temperature      float64          `json:"temperature,omitempty"`
	TopP             float64          `json:"top_p,omitempty"`
	FrequencyPenalty float64          `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64          `json:"presence_penalty,omitempty"`
	StopSequences    []string          `json:"stop_sequences,omitempty"`
	SystemPrompt     string           `json:"system_prompt,omitempty"`
	ChatPrompt       string           `json:"chat_prompt,omitempty"`
	ResponseFormat   string           `json:"response_format,omitempty"`
}

// CreateTenantRequest represents a request to create a tenant
type CreateTenantRequest struct {
	Name         string                 `json:"name"`
	Domain       string                 `json:"domain,omitempty"`
	Settings     TenantSettings          `json:"settings"`
	Metadata     map[string]string          `json:"metadata,omitempty"`
	ParentID     *string               `json:"parent_id,omitempty"`
	IsEnterprise bool                   `json:"is_enterprise,omitempty"`
}

// UpdateTenantRequest represents a request to update a tenant
type UpdateTenantRequest struct {
	Name     *string                `json:"name,omitempty"`
	Domain   *string                `json:"domain,omitempty"`
	Settings *TenantSettings        `json:"settings,omitempty"`
	Metadata map[string]string          `json:"metadata,omitempty"`
}

// TenantSettings represents tenant configuration
type TenantSettings struct {
	MaxUsers        int    `json:"max_users"`
	MaxDocuments    int    `json:"max_documents"`
	MaxStorage      int    `json:"max_storage"` // in MB
	AllowSSO        bool   `json:"allow_sso"`
	RequireMFA      bool   `json:"require_mfa"`
	DataRetention   int    `json:"data_retention"` // in days
	EnableAudit     bool   `json:"enable_audit"`
	EncryptionLevel string `json:"encryption_level"` // standard, high, maximum
}

// Tenant represents a tenant
type Tenant struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Domain       string                 `json:"domain"`
	Settings     TenantSettings          `json:"settings"`
	Metadata     map[string]string          `json:"metadata"`
	ParentID     *string               `json:"parent_id,omitempty"`
	IsEnterprise bool                   `json:"is_enterprise"`
	Status       string                 `json:"status"` // active, suspended, deleted
	CreatedAt    Timestamp                   `json:"created_at"`
	UpdatedAt    Timestamp                   `json:"updated_at"`
}

// QueryRequest represents a RAG query request
type QueryRequest struct {
	Query             string                 `json:"query"`
	TenantID          string                 `json:"tenant_id,omitempty"`
	ContextOptions    *ContextOptions        `json:"context_options,omitempty"`
	RetrievalOptions  *RetrievalOptions      `json:"retrieval_options,omitempty"`
	GenerationOptions *GenerationOptions   `json:"generation_options,omitempty"`
	ConversationID  *string               `json:"conversation_id,omitempty"`
	SessionID       *string               `json:"session_id,omitempty"`
	UserID          *string               `json:"user_id,omitempty"`
	Metadata          map[string]string        `json:"metadata,omitempty"`
	Stream            bool                   `json:"stream,omitempty"`
}

// ContextChunk represents a chunk of context
type ContextChunk struct {
	ID            string                 `json:"id"`
	DocumentID    string                 `json:"document_id"`
	DocumentTitle string                 `json:"document_title"`
	Text          string                 `json:"text"`
	PageNumber    *int                  `json:"page_number,omitempty"`
	Score          float64               `json:"score"`
	Source        string                 `json:"source"`
	URL           string                 `json:"url,omitempty"`
	Metadata      map[string]string         `json:"metadata,omitempty"`
}

// RAGResponse represents a RAG query response
type RAGResponse struct {
	QueryID           string            `json:"query_id"`
	Answer            string            `json:"answer"`
	Context           []ContextChunk    `json:"context"`
	Citations         []Citation        `json:"citations,omitempty"`
	Sources           []Source          `json:"sources,omitempty"`
	Confidence        float64           `json:"confidence"`
	TokensUsed        TokenUsage        `json:"tokens_used"`
	ResponseTime      time.Duration     `json:"response_time"`
	ConversationID    string            `json:"conversation_id"`
	SessionID         string            `json:"session_id"`
	Metadata          map[string]string        `json:"metadata,omitempty"`
	FollowupQuestions []string          `json:"followup_questions,omitempty"`
	CreatedAt         Timestamp                  `json:"created_at"`
}

// TokenUsage represents token usage statistics
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	Cost             float64         `json:"cost_usd"`
}

// Citation represents a citation reference
type Citation struct {
	ID         string      `json:"id"`
	ChunkID    string      `json:"chunk_id"`
	DocumentID string      `json:"document_id"`
	Title      string      `json:"title"`
	Authors    []string    `json:"authors,omitempty"`
	URL        string      `json:"url,omitempty"`
	PageNumber *int      `json:"page_number,omitempty"`
	Text       string      `json:"text"`
	Confidence float64      `json:"confidence"`
	CreatedAt  Timestamp         `json:"created_at"`
}

// Source represents a document source
type Source struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Authors     []string    `json:"authors,omitempty"`
	URL         string      `json:"url,omitempty"`
	Type        string      `json:"type"` // pdf, html, doc, etc.
	PublishedAt *Timestamp     `json:"published_at,omitempty"`
	Relevance   float64   `json:"relevance"`
	Authority  float64   `json:"authority"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ConversationMessage represents a conversation message
type ConversationMessage struct {
	ID             string            `json:"id"`
	ConversationID string            `json:"conversation_id"`
	SessionID      string            `json:"session_id"`
	Role           string            `json:"role"` // user, assistant, system
	Content        string            `json:"content"`
	Context        []ContextChunk    `json:"context,omitempty"`
	Citations      []Citation        `json:"citations,omitempty"`
	TokensUsed     TokenUsage        `json:"tokens_used,omitempty"`
	Metadata       map[string]string  `json:"metadata,omitempty"`
	CreatedAt      Timestamp              `json:"created_at"`
}

// Conversation represents a conversation
type Conversation struct {
	ID            string                 `json:"id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	Title         string                 `json:"title,omitempty"`
	Status        string                 `json:"status"` // active, archived, deleted
	MessageCount  int                    `json:"message_count"`
	LastMessageAt *Timestamp                `json:"last_message_at,omitempty"`
	Metadata      map[string]string              `json:"metadata"`
	CreatedAt     Timestamp                      `json:"created_at"`
	UpdatedAt     Timestamp                      `json:"updated_at"`
}

// FeedbackRequest represents a feedback request
type FeedbackRequest struct {
	Rating     int               `json:"rating"` // 1-5
	Comment    string             `json:"comment,omitempty"`
	Helpful    bool               `json:"helpful"`
	Accurate   bool               `json:"accurate"`
	Complete  bool               `json:"complete"`
	Categories []string          `json:"categories,omitempty"`
	Metadata   map[string]string      `json:"metadata,omitempty"`
}

// QueryFeedback represents query feedback
type QueryFeedback struct {
	QueryID    string  `json:"query_id"`
	UserID     string  `json:"user_id"`
	Rating     int      `json:"rating"`
	Comment    string     `json:"comment,omitempty"`
	Helpful    bool      `json:"helpful"`
	Accurate   bool      `json:"accurate"`
	Complete  bool      `json:"complete"`
	Categories []string  `json:"categories"`
	Metadata   map[string]string `json:"metadata"`
	CreatedAt  Timestamp        `json:"created_at"`
	UpdatedAt  Timestamp        `json:"updated_at"`
}

// DateRange represents a date range filter
type DateRange struct {
	From *Timestamp `json:"from,omitempty"`
	To   *Timestamp `json:"to,omitempty"`
}

// CreatePolicyRequest represents a request to create a policy
type CreatePolicyRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Type        string                 `json:"type"` // access, data, dlp, cost, compliance
	Category    string                 `json:"category"`
	Rules       []PolicyRule           `json:"rules"`
	Conditions  []PolicyCondition      `json:"conditions,omitempty"`
	Actions     []PolicyAction         `json:"actions,omitempty"`
	Effect      string                 `json:"effect"` // allow, deny, log
	Priority    int                    `json:"priority"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyRule represents a single rule within a policy
type PolicyRule struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Type     string    `json:"type"` // attribute, resource, action, condition
	Operator string    `json:"operator"` // equals, not_equals, contains, in, regex
	Field     string    `json:"field"`
	Value     interface{} `json:"value"`
	Description string    `json:"description"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyCondition represents a condition that must be met
type PolicyCondition struct {
	ID       string    `json:"id"`
	Type     string    `json:"type"` // time, ip, user, resource, context
	Operator string    `json:"operator"` // equals, between, in, contains
	Field     string    `json:"field"`
	Value     interface{} `json:"value"`
	Negate   bool       `json:"negate"`
	Description string    `json:"description"`
}

// PolicyAction represents an action to take when policy is triggered
type PolicyAction struct {
	ID       string    `json:"id"`
	Type     string    `json:"type"` // allow, deny, log, notify, transform
	Parameters map[string]interface{} `json:"parameters"`
	Description string    `json:"description"`
	Async     bool       `json:"async"`
}

// Policy represents a policy
type Policy struct {
	ID          ID       string                 `json:"id"`
	TenantID     ID       string                 `json:"tenant_id"`
	Name        string     string                 `json:"name"`
	Description string     string                 `json:"description,omitempty"`
	Type        string     string                 `json:"type"` // auth, data, dlp, cost, compliance
	Category    string     string                 `json:"category"`
	RegoPolicy  string     string                 `json:"rego_policy"`
	Version     int       string                 `json:"version"`
	IsActive    bool       string                 `json:"is_active"`
	CreatedAt   Timestamp                         `json:"created_at"`
	UpdatedAt   Timestamp                         `json:"updated_at"`
	CreatedBy   ID       string                 `json:"created_by"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyTestRequest represents a policy test request
type PolicyTestRequest struct {
	PolicyID   string                 `json:"policy_id,omitempty"`
	PolicyCode string                 `json:"policy_code,omitempty"`
	TestCase PolicyTestCase            `json:"test_case"`
	Context    map[string]interface{} `json:"context,omitempty"`
}

// PolicyTestCase represents a policy test case
type PolicyTestCase struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Input       map[string]interface{} `json:"input"`
	Expected    PolicyTestResult       `json:"expected"`
}

// PolicyTestResult represents a policy test result
type PolicyTestResult struct {
	Allowed    bool                   `json:"allowed"`
	Reason     string                   `json:"reason"`
	Actual     interface{}            `json:"actual"`
	Expected   interface{}            `json:"expected"`
	Passed     bool                   `json:"passed"`
	Error      string                   `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyTemplate represents a reusable policy template
type PolicyTemplate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Category    string                 `json:"category"`
	Type        string                 `json:"type"` // access, data, dlp, cost, compliance
	Rules       []PolicyRule           `json:"rules"`
	Conditions  []PolicyCondition      `json:"conditions"`
	Actions     []PolicyAction         `json:"actions"`
	Variables   []TemplateVariable     `json:"variables"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// TemplateVariable represents a variable in a template
type TemplateVariable struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"` // string, number, boolean, array
	Required     bool        `json:"required"`
	DefaultValue interface{} `json:"default_value,omitempty"`
	Description string                 `json:"description,omitempty"`
	Options      []string    `json:"options,omitempty"`
}

// Filter represents a filter for search operations
type Filter struct {
	Field string      `json:"field"`
	Op    string      `json:"op"` // eq, ne, gt, gte, lt, lte, in, nin, contains, regex
	Value interface{} `json:"value"`
}

// SearchOptions represents search options
type SearchOptions struct {
	Page     int         `json:"page,omitempty"`
	PageSize int         `json:"page_size,omitempty"`
	SortBy   string       `json:"sort_by,omitempty"`
	SortDesc bool         `json:"sort_desc,omitempty"`
	Filters  []Filter     `json:"filters,omitempty"`
	Facets   []string     `json:"facets,omitempty"`
}

// SearchResponse represents a search response
type SearchResponse[T any] struct {
	Results      []T                     `json:"results"`
	Pagination Pagination                 `json:"pagination"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
	Suggestions []string                   `json:"suggestions,omitempty"`
}

// Pagination represents pagination information
type Pagination struct {
	Page       int       `json:"page"`
	PageSize   int       `json:"page_size"`
	Total      int64      `json:"total"`
	TotalPages int       `json:"total_pages"`
	HasNext    bool       `json:"has_next"`
	HasPrev    bool       `json:"has_prev"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse[T any] struct {
	Data       T         `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// BulkResult represents a bulk operation result
type BulkResult[T any] struct {
	Success  []T         `json:"success"`
	Failed   []FailedItem     `json:"failed"`
	Total    int             `json:"total"`
	Success  int             `json:"success_count"`
	Failed   int             `json:"failed_count"`
	Time     time.Duration     `json:"time"`
}

// FailedItem represents a failed item in a bulk operation
type FailedItem struct {
	ID    string `json:"id"`
	Error  string `json:"error"`
	Code   string `json:"code"`
}

// DocumentInfo represents downloaded document information
type DocumentInfo struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

// ProcessingStatus represents document processing status
type ProcessingStatus struct {
	DocumentID string  `json:"document_id"`
	Status     string  `json:"status"`
	Progress   int       `json:"progress"`
	Message    string  `json:"message,omitempty"`
	Error      string  `json:"error,omitempty"`
	StartedAt  Timestamp    `json:"started_at"`
	UpdatedAt  Timestamp    Timestamp    `json:"updated_at"`
}

// Timestamp represents a custom time type with JSON marshaling
type Timestamp time.Time

// Now returns the current UTC time
func Now() Timestamp {
	return Time(time.Now().UTC())
}

// IsZero checks if the time is zero
func (t Time) IsZero() bool {
	return time.Time(t).IsZero()
}

// Before checks if t is before other
func (t Time) Before(other Time) bool {
	return time.Time(t).Before(time.Time(other))
}

// After checks if t is after other
func (t Time) After(other Time) bool {
	return time.Time(t).After(time.Time(other))
}

// String returns the string representation
func (t Time) String() string {
	return time.Time(t).Format("2006-01-02T15:04:05.000Z")
}

// ToTime converts Timestamp to time.Time
func (t Time) ToTime() time.Time {
	return time.Time(t)
}

// UnmarshalJSON implements json.Unmarshaler
func (t *Timestamp) UnmarshalJSON(data []byte) error {
	var timeStr string
	err := json.Unmarshal(data, &timeStr)
	if err != nil {
		return err
	}

	parsed, err := time.Parse(timeStr, "2006-01-02T15:04:05.000Z")
	if err != nil {
		return err
	}
	*t = Time(parsed)
	return nil
}

// MarshalJSON implements json.Marshaler
func (t Time) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t))
}

// ========================================
// Mock implementations for testing
// ========================================

// MockClient provides a mock client for testing
type MockClient struct {
	services map[string]interface{}
	middleware []Middleware
	config    *Config
}

// NewMockClient creates a new mock client
func NewMockClient() *MockClient {
	return &MockClient{
		services: map[string]interface{}{
			"users": &MockUserService{},
			"tenants": &MockTenantService{},
			"documents": &MockDocumentService{},
			"rag": &MockRAGService{},
			"vector": &MockVectorService{},
			"policies": &MockPolicyService{},
			"llm": &MockLLMService{},
			"monitoring": &MockMonitoringService{},
			"websocket": &MockWebSocketService{},
		},
		middleware: []Middleware{},
		config:    DefaultConfig(),
	}
}

// AddService adds a mock service
func (m *MockClient) AddService(name string, service interface{}) {
	m.services[name] = service
}

// GetService retrieves a mock service
func (m *MockClient) GetService(name string) interface{} {
	return m.services[name]
}

// Use adds middleware to the mock client
func (m *MockClient) Use(middleware Middleware) {
	m.middleware = append(m.middleware, middleware)
}

// Close closes the mock client
func (m *MockClient) Close() error {
	// Mock client doesn't need to close anything
	return nil
}

// GetConfig returns the mock config
func (m *MockClient) GetConfig() *Config {
	return m.config
}

// Mock implementations
type MockUserService struct{}

func (s *MockUserService) Create(ctx context.Context, req *CreateUserRequest) (*User, error) {
	return &User{
		ID:        "mock-user-id",
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      req.Role,
		TenantID:  req.TenantID,
		IsActive:  req.IsActive,
	}, nil
}

func (s *MockUserService) Get(ctx context.Context, userID string) (*User, error) {
	return &User{
		ID:        userID,
		Email:     "mock-user@example.com",
		FirstName: "Mock",
		LastName:  "User",
		Role:      "user",
		TenantID:  "mock-tenant",
		IsActive:  true,
	}, nil
}

func (s *MockUserService) List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[User], error) {
	return &PaginatedResponse[User]{
		Data: []User{
			{ID: "user-1", Email: "user1@example.com", FirstName: "User", LastName: "One"},
			{ID: "user-2", Email: "user2@example.com", FirstName: "User", LastName: "Two"},
		},
		Pagination: Pagination{
			Page:       1,
			PageSize:   opts.PageSize,
			Total:      2,
			TotalPages:  1,
			HasNext:    false,
			HasPrev:    false,
		},
	}, nil
}

// Mock implementations for other services follow the same pattern
type MockTenantService struct{}
type MockDocumentService struct{}
type MockRAGService struct{}
type MockVectorService struct{}
type MockPolicyService struct{}
type MockLLMService struct{}
type MockMonitoringService struct{}
type MockWebSocketService struct{}

func (s *MockTenantService) Create(ctx context.Context, req *CreateTenantRequest) (*Tenant, error) {
	return &Tenant{
		ID:        "mock-tenant-id",
		Name:      req.Name,
		Domain:    req.Domain,
		Settings:  req.Settings,
		Status:    "active",
		CreatedAt:  NowUTC(),
		UpdatedAt:  NowUTC(),
	}, nil
}

func (s *MockDocumentService) Upload(ctx context.Context, req *UploadRequest) (*Document, error) {
	return &Document{
		ID:        "mock-doc-id",
		TenantID:  req.TenantID,
		Filename:  req.Filename,
		ContentType: req.ContentType,
		Size:     req.Size,
		Status:    "completed",
		CreatedAt:  NowUTC(),
		UpdatedAt: NowUTC(),
	}, nil
}

func (s *MockRAGService) Query(ctx context.Context, req *QueryRequest) (*RAGResponse, error) {
	return &RAGResponse{
		QueryID:    "mock-query-id",
		Answer:     "This is a mock RAG response",
		Context:    []ContextChunk{},
		Citations: []Citation{},
		Sources:    []Source{},
		Confidence: 0.8,
		TokensUsed: TokenUsage{
			PromptTokens:     50,
			CompletionTokens: 150,
			TotalTokens:    200,
			Cost:           0.01,
		},
		ResponseTime: time.Millisecond * 100,
		CreatedAt:    NowUTC(),
	}, nil
}

func (s *MockVectorService) Create(ctx context.Context, req *VectorCreateRequest) (*VectorCreateResult, error) {
	return &VectorCreateResult{
		CreatedIDs: []string{"mock-vector-1"},
		FailedIDs:  []FailedItem{},
		Time:     time.Millisecond * 50,
	}, nil
}

func (s *MockPolicyService) Evaluate(ctx context.Context, req *PolicyEvaluationRequest) (*PolicyEvaluationResult, error) {
	return &PolicyEvaluationResult{
		Allowed: true,
		Effect:  "allow",
		Policies:  []PolicyMatch{},
		Reason:    "Mock policy evaluation",
		Context:    map[string]interface{}{
			"hour": 14,
			"ip_address": "192.168.1.100",
		},
	}, nil
}

func (s *MockLLMService) CreateChatCompletion(ctx context.Context, req *ChatCompletionRequest) (*ChatCompletionResponse, error) {
	return &ChatCompletionResponse{
		ID:        "mock-chat-id",
		Object:     "chat.completion",
		Created:    NowUTC(),
		Model:      req.Model,
		Choices: []ChatCompletionChoice{
			{
				Index:    0,
				Message: ChatMessage{
					Role:    "assistant",
					Content:  "This is a mock response",
				},
				FinishReason: "stop",
			},
		},
		Usage: &ChatCompletionUsage{
			PromptTokens:     50,
			CompletionTokens: 150,
			TotalTokens:    200,
		},
	}, nil
}

func (s *MockMonitoringService) PushMetrics(ctx context.Context, tenantID string, metrics []Metric) error {
	return nil
}

func (s *MockMonitoringService) GetHealth(ctx context.Context, tenantID string, checks []string) (*HealthStatus, error) {
	return &HealthStatus{
		Status: "healthy",
		Timestamp: NowUTC(),
		Checks: []HealthCheck{
			{Name: "database", Status: "healthy", Duration: 50 * time.Millisecond},
			{Name: "api", Status: "healthy", Duration: 10 * time.Millisecond},
			{Name: "storage", Status: "healthy", Duration: 5 * time.Millisecond},
		},
	}, nil
}

func (s *MockWebSocketService) Connect(ctx context.Context) (*Connection, error) {
	return &Connection{
		isConnected: true,
	}, nil
}

func (s *MockWebSocketService) Subscribe(req *SubscribeRequest) error {
	return nil
}

func (s *MockWebSocketService) Unsubscribe(req *UnsubscribeRequest) error {
	return nil
}

func (s *MockWebSocketService) Send(messageType string, data map[string]interface{}) error {
	return nil
}

func (s *MockWebSocketService) Events() <-chan []byte {
	return make(chan []byte, 0)
}

func (s *MockWebSocketService) Errors() <-chan error {
	return make(chan error, 0)
}

func (s *MockWebSocketService) SetMessageHandler(handler func([]byte)) {
	// Set custom handler for mock testing
}

func (s *MockWebSocketService) SetErrorHandler(handler func(error error)) {
	// Set custom error handler for mock testing
}

func (s *MockWebSocketService) SetCloseHandler(handler func()) {
	// Set custom close handler for mock testing
}

func (s *MockWebSocketService) IsConnected() bool {
	return s.isConnected
}

func (s *MockWebSocketService) Close() error {
	s.isConnected = false
	return nil
}

// MockHTTPRequest wraps an HTTP request for middleware compatibility
type MockHTTPRequest struct {
	method    string
	url       string
	headers    map[string][]string
}

func (m *MockHTTPRequest) Method() string { return m.method }
func (m *MockHTTPRequest) URL() string { return m.url }
func (m *MockHTTPRequest) Header(key string) string {
	if vals, exists := m.headers[key]; exists {
		return vals[0]
	}
	return ""
}

// MockHTTPResponse wraps an HTTP response for middleware compatibility
type MockHTTPResponse struct {
	statusCode int
	headers   map[string][]string
	body     []byte
}

func (m *MockHTTPResponse) StatusCode() int { return m.statusCode }
func (m *MockHTTPResponse) Headers() map[string][]string { return m.headers }
func (m *MockHTTPResponse) Body() []byte { return m.body }

// ========================================
// Performance Tests
// ========================================

func BenchmarkTime_MarshalJSON(b *testing.B) {
	timeVals := []Time{
		NowUTC(),
		Time(time.Date(2023, 1, 1)),
		Time(time.Date(2023, 12, 31)),
		Time(time.Date(2024, 6, 15)),
	}

	for _, timeVal := range timeVals {
		b.ResetTimer()
		_, err := timeVal.MarshalJSON()
		if err != nil {
			b.Fatalf("Failed to marshal Time: %v", err)
		}
		b.StopTimer()
	}
}

func BenchmarkJSON_ToJSON(b *testing.B) {
	testVals := []interface{}{
		"string",
		42,
		42.5,
		true,
		[]string{"one", "two", "three"},
		map[string]interface{}{"key": "value"},
			struct {
			Name string
			Age  int
		},
	}
	}

	for _, val := range testVals {
		b.ResetTimer()
		_, err := ToJSON(val)
		if err != nil {
			b.Fatalf("Failed to marshal %v: %v", val)
		}
		b.StopTimer()
	}
}

func BenchmarkSlice_Filter(b *testing.B) {
	data := []string{
		"apple",
		"banana",
		"cherry",
		"date",
		"elderberry",
		"fig",
		"grape",
		"honeydew",
		"kiwi",
		"lemon",
		"mango",
		"nectarine",
	"orange",
		"papaya",
	"quince",
	"raspberry",
		"strawberry",
		"tangerine",
		"ugli",
	"vanilla",
		"watermelon",
		"zucchini",
		"yellow",
	}

	for _, testVal := range data {
		b.ResetTimer()
		result := Filter(data, func(item string) bool {
			return !strings.Contains(item, "a")
		})
		b.StopTimer()
	}
}

func BenchmarkMap_Keys(b *testing.B) {
	data := map[string]interface{}{
		"name": "John Doe",
		"age": 30,
		"email": "john@example.com",
	"active": true,
		"roles": []string{"admin", "user"},
		"metadata": map[string]interface{}{
			"department": "engineering",
			"location": "US",
		},
	},
	}

	for key, value := range data {
		b.ResetTimer()
		_ = value
		b.StopTimer()
	}
}

// ========================================
// Integration Test Helper
// ========================================

func createTestClient() *Client {
	config := &Config{
		BaseURL: "https://test-api.sdlc.ai",
		Timeout: 30 * time.Second,
		Debug:   false,
	}

	return NewClient(config, WithAPIKey("test-key"))
}

func createTestTenant(t *testing.T) (*Tenant, error) {
	client := createTestClient()

	tenant, err := client.Tenants.Create(context.Background(), &CreateTenantRequest{
		Name:    fmt.Sprintf("test-tenant-%d", time.Now().Unix()),
		Domain:  fmt.Sprintf("test-%d.sdlc.ai", time.Now().Unix()),
		Settings: TenantSettings{
			MaxUsers:     10,
			MaxDocuments: 100,
			MaxStorage:   10240, // 10GB
		},
	})
	if err != nil {
		return nil, err
	}

	return tenant, nil
}

func createTestUser(t *testing.T) (*User, error) {
	client := createTestClient()

	user, err := client.Users.Create(context.Background(), &CreateUserRequest{
		Email:     fmt.Sprintf("user%d@test.com", time.Now().Unix()),
		FirstName: "Test",
	LastName:  "User",
		Role:      "user",
		TenantID:    "test-tenant-123",
		IsActive:  true,
	})
	if err != nil {
		return nil, err
	}

	return user, nil
}

func createTestDocument(t *testing.T) (*Document, error) {
	client := createTestClient()

	document, err := client.Documents.UploadFromPath(context.Background(), "./test.txt", "test-tenant-123", DocumentMetadata{
		Title:       "Test Document",
		Description: "Test document for testing",
		Author:      "Test Author",
		Language:    "en",
		Category:    "test",
	})
	if err != nil {
		return nil, err
	}

	return document, nil
}

func createTestVector(t *testing.T) (*VectorCreateResult, error) {
	client := createTestClient()

	result, err := client.Vector.Create(context.Background(), &VectorCreateRequest{
		TenantID: "test-tenant-123",
		Vectors: []VectorInput{
			{
				ID:     "vector-1",
				Values:   []float64{0.1, 0.2, 0.3, 0.4, 0.5},
				Metadata: map[string]interface{}{
					"document_id": "doc-1",
					"chunk_id":   "chunk-1",
					},
			},
		},
		Namespace: "test-namespace",
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func createTestPolicy(t *testing.T) (*Policy, error) {
	client := createTestClient()

	policy, err := client.Policies.Create(context.Background(), &CreatePolicyRequest{
		Name:        "Test Policy",
		Description: "A test policy",
		Type:        "access",
		Category:    "document",
		Rules: []PolicyRule{
			{
				ID:       "test-rule",
				Name:     "Test Rule",
				Type:     "attribute",
				Operator: "equals",
				Field:     "user.role",
				Value:     "admin",
			},
		},
		},
		Effect:      "allow",
		Priority:    1,
	})
	if err != nil {
		return nil, err
	}

	return policy, nil
}

func createTestAlertRule(t *testing.T) (*AlertRule, error) {
	client := createTestClient()

	rule, err := client.Monitoring.CreateAlertRule(context.Background(), "test-tenant-123", &CreateAlertRuleRequest{
		Name:        "Test Alert Rule",
		Description: "Test alert for high error rates",
		Query:       "rate(error_rate) > 0.1",
	Condition:   "greater_than",
		Threshold:   0.1,
		Severity:    "warning",
	})
	if err != nil {
		return nil, err
	}

	return rule, nil
}

// ========================================
// Integration Test Helper Functions
// ========================================

func assertNoError(t *testing.T, err error, msg string) {
	assert.NoError(t, err, msg)
}

func assertEqual[T any](t *testing.T, expected, actual T, msg string) {
	assert.Equal(t, expected, actual, msg)
}

func assertNotZero(t *testing.T, value int, msg string) {
	assert.NotZero(t, value, msg)
}

func assertNotEmpty(t *testing.T, slice []T, msg string) {
	assert.NotZero(t, len(slice), msg)
}

func assertValidEmail(t *testing.T, email string) {
	assert.True(t, IsValidEmail(email), "Email is not valid: "+email)
}

func assertValidURL(t *testing.T, url string) {
	assert.True(t, IsValidURL(url), "URL is not valid: "+url)
}

func assertPositive(t *testing.T, value float64, msg string) {
	assert.True(t, value > 0, msg)
}

func assertRange(t *testing.T, value float64, min, max float64, msg string) {
	assert.True(t, value >= min && value <= max, msg)
}

func assertStringLength(t *testing.T, str string, min, max int, msg string) {
	length := utf8.RuneCountInString(str)
	assert.True(t, length >= min && length <= max, msg)
}

func assertUUID(t *testing.T, uuid string, msg string) {
	_, err := uuid.Parse(uuid)
		assert.NoError(t, err, msg)
		_, err = uuid.Parse(uuid)
		assert.Equal(t, uuid, _, msg)
}

// ========================================
// Performance Test Helper Functions
// ========================================

func measureOperation(name string, operation func() error) time.Duration {
	start := time.Now()
	err := operation()
	duration := time.Since(start)

	if err != nil {
		return duration
	}

	return duration
}

func measureOperationWithResult[T any](name string, operation func() (T, error)) (T, time.Duration, error) {
	start := time.Now()
	result, err := operation()
	duration := time.Since(start)

	if err != nil {
		return result, duration, err
	}

	return result, duration
}

func runConcurrentOperations(numWorkers, operationsPerWorker int, operation func(workerID, taskID int) error) (time.Duration, errorCount, successCount int) {
	start := time.Now()
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	errors := make(chan error, operationsPerWorker*numWorkers)
	results := make(chan interface{})

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			err := operation(workerID, taskID)
			if err != nil {
				errors <- errors
				return
			}

			results <- result
		}
	}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	duration := time.Since(start)
	errorCount := len(errors)
	successCount := len(results)

	return duration, errorCount, successCount
}

// ========================================
// Retry Test Helper Functions
// ========================================

func testRetryMechanism(t *testing.T) {
	backoff := NewExponentialBackoff(
		100*time.Millisecond,
		5*time.Second,
		2.0,
		true,
	)

	retrier := NewRetrier(
		WithMaxAttempts(3),
		WithBackoff(backoff),
		WithRetryCondition(CombineRetryConditions(
			NetworkError,
			ServerError,
			RateLimitError,
		),
	)

	// Test successful retry
	assert.NoError(t, retrier.Do(ctx, func() error {
		return nil
	}), "Retry should not fail for network errors")

	// Test failed retry
		err := retrier.Do(ctx, func() error {
		return fmt.Errorf("persistent connection error")
	}, "Retry should fail for persistent errors")

		assert.Error(t, err, "Retry should fail for persistent errors")
}

func testRateLimitedRetry(t *testing.T) {
	retryer := NewRetrier(
		WithMaxAttempts(3),
		WithBackoff(NewFixedBackoff(100*time.Millisecond)),
		WithRateLimitError(true),
	)

	// Test rate limit retry
	assert.NoError(t, retrier.Do(ctx, func() error {
		return fmt.Errorf("rate limit exceeded")
	}, "Retry should handle rate limit"))
}

func testCircuitBreakerIntegration(t *testing.T) {
	retrier := NewRetrier(
		WithMaxAttempts(3),
		WithBackoff(NewExponentialBackoff(100*time.Millisecond)),
		WithCircuitBreaker(NewCircuitBreaker()),
		WithRetryCondition(CombineRetryConditions(
			ServerError,
			ServiceUnavailable,
			Timeout,
		)),
	)
	})

	// Test normal operation
		assert.NoError(t, retrier.Do(ctx, func() error {
		return nil
	}, "Normal operation should succeed"))

		// Test circuit breaker open
		retrier.Do(ctx, func() error {
			return fmt.Errorf("circuit breaker is open")
		}, "Circuit breaker should be open")
	})
}

// ========================================
// Mock Implementations for Testing
// ========================================

func (v *ValidationError) Error() string {
	if len(v.Errors) == 0 {
		return "validation failed"
	}

	var messages []string
	for _, err := range v.Errors {
		messages = append(messages, fmt.Sprintf("%s: %s", err.Field))
	}

	return strings.Join(", ", ", messages)
}

// (v *APIError) Error() string {
	return fmt.Sprintf("[%s] %s", v.Type)
}

func (v *TimestampoutError) Error() string {
	return fmt.Sprintf("[%s] %s", v.Type)
}

func (v *CircuitBreakerError) Error() string {
	return fmt.Errorf("[%s] circuit breaker is open: %s", v.State)
}

func (v *RateLimitError) Error() string {
	return fmt.Sprintf("[%s] rate limit exceeded: %v")
}

// ========================================
// Builder Tests
// ========================================

func TestRequestBuilder_Build(t *testing.T) {
	builder := NewRequestBuilder("POST", "https://api.example.com")

	// Test method
	req, err := builder.Method("PUT").Build()
	assert.NoError(t, err)
	assert.Equal(t, "PUT", req.Method())

	// Test URL
	req, err := builder.URL("https://api.sdlc.ai/v1/users").Build()
	assert.NoError(t, err)
	assert.Equal(t, "https://api.sdlc.ai/v1/users", req.URL())

	// Test headers
	req, err := builder.
		Header("Authorization", "Bearer token").
		Header("Content-Type", "application/json").
		Build()
	assert.NoError(t, err)
	assert.Equal(t, "Bearer token", req.Header("Authorization"))
	assert.Equal(t, "application/json", req.Header("Content-Type"))

	// Test body
	req, err := builder.JSONBody(map[string]interface{}{"test": "data"}).Build()
	assert.NoError(t, err)
	assert.NotEmpty(t, req.Body())

	// Test final request
	httpReq, err := req.Build()
	assert.NoError(t, err)
	assert.Equal(t, "PUT", httpReq.Method())
	assert.Equal(t, "https://api.sdlc.ai/v1/users", httpReq.URL())
	assert.Equal(t, "Bearer token", httpReq.Header("Authorization"))
	assert.Equal(t, "application/json", httpReq.Header("Content-Type"))
}

func TestURLBuilder_BuildWithQuery(t *testing.T) {
	builder := NewURLBuilder("https://api.sdlc.ai")

	// Add path
	builder.Path("v1", "users").Path("123").Path("active"))
	assert.Equal(t, "https://api.sdlc.ai/v1/users/123/active", builder.MustBuild())

	// Add query parameters
	builder.Query("page", "1").
		Query("limit", "10").
		Query("sort", "created_at").
		Query("order", "desc").
		Build()
	assert.Equal(t, "https://api.sdlc.ai/v1/users/123/active?page=1&limit=10&sort_by=created_at&order=desc", builder.MustBuild())
}

func TestFormBuilder_Encode(t *testing.T) {
	builder := NewFormBuilder()

	// Add fields
	builder.Add("name", "John Doe").
		Add("email", "john@example.com").
		Add("age", "30").
		Add("role", "admin").
		Add("tags", "engineering", "python", "backend").
		Build()

	expected := "email=john.doe%40example.com&age=30&role=admin&tags=engineering%2Cpython%2Cbackend&3backend&4"
	assert.Equal(t, expected, builder.Encode())
}

func TestFormBuilder_ByteArray(t *testing.T) {
	builder := NewFormBuilder()

	data := []byte("test data")
	reader, contentType, err := builder.AddByteArray("file", data).Build()
	assert.NoError(t, err)
	assert.NotNil(t, reader)
	assert.Equal(t, "multipart/form-data; boundary=", contentType[:len("multipart/form-data; boundary=")-8]), contentType)
	assert.Equal(t, reader, data)
}

func TestFormBuilder_InvalidInput(t *testing.T) {
	builder := NewFormBuilder()

	// Invalid: Empty boundary
	_, err := builder.AddByteArray("file", data).Build()
		assert.Error(t, err)

	// Invalid: Missing closing boundary
	_, err = builder.AddByteArray("file", data, io.Discard).Build()
		assert.Error(t, err)

	// Valid boundary
	_, err = builder.AddByteArray("file", data).Build()
		assert.NoError(t, err)
}

// ========================================
// Configuration Tests
// ========================================

func TestConfig_Validation(t *testing.T) {
	// Valid configuration
	config := &Config{
		BaseURL: "https://api.sdlc.ai",
		Timeout: 30 * time.Second,
	}

	assert.NoError(t, NewClient(config, WithAPIKey("key")))

	// Invalid configuration
	config := &Config{
		BaseURL: "", // Invalid
	}

	_, err := NewClient(config, WithAPIKey("key"))
	assert.Error(t, err)
}

func TestConfig_CustomConfiguration(t *testing.T) {
	config := &Config{
		BaseURL:            "https://custom.api.sdlc.ai",
	Timeout:            60 * time.Second,
		MaxIdleConns:       50,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     120 * time.Second,
		TLSHandshakeTimeout: 15 * time.Second,
		Debug:             true,
		UserAgent:           "custom-sdln-sdk-go/v1.0.0",
	}

	client, err := NewClient(config, WithAPIKey("key"))
	assert.NoError(t, err)
	assert.Equal(t, 60*time.Second, client.config.Timeout)
	assert.Equal(t, 50, client.config.MaxIdleConns)
	assert.Equal(t, 10, client.config.MaxIdleConnsPerHost)
	assert.True(t, client.config.Debug)
	assert.Equal(t, "custom-sdln-sdk-go/v1.0.0", client.config.UserAgent)
}

func TestConfig_DebugMode(t *testing.T) {
	// Debug mode enabled
	config := &Config{
		BaseURL: "https://api.sdlc.ai",
		Debug:   true,
	}

	client, err := NewClient(config, WithAPIKey("key"))
	assert.NoError(t, err)
	assert.True(t, client.config.Debug)

	// Debug mode disabled
	config := &Config{
		BaseURL: "https://api.sdlc.ai",
		Debug:   false,
	}

	client, err := NewClient(config, WithAPIKey("key"))
	assert.NoError(t, err)
	assert.False(t, client.config.Debug)
}

// ========================================
// Integration Test Suite
// ========================================

func TestSDK_Integration_SimpleFlow(t *testing.T) {
	// This test covers basic usage patterns
	t.Run("Complete user workflow", func(t *testing.T) {
		client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
		require.NoError(t, err)
		defer client.Close()

		// Create tenant
		tenant, err := createTestTenant(t)
		require.NoError(t, err)

		// Create user
		user, err := createTestUser(t, tenant.ID)
		require.NoError(t, err)

		// Upload document
		doc, err := createTestDocument(t, tenant.ID)
		require.NoError(t, err)

		// Query RAG
		response, err := client.RAG.Query(context.Background(), &QueryRequest{
			Query:    "What is this about?",
			TenantID: tenant.ID,
		})
		require.NoError(t, err)

		// List documents
		docs, err := client.Documents.List(context.Background(), &ListOptions{PageSize: 10})
		require.NoError(t, err)

		// Clean up
		err = client.Documents.Delete(ctx, doc.ID)
		require.NoError(t, err)

		// Verify all operations succeeded
		assert.Equal(t, 1, len(users.Data))
		assert.Equal(t, "test@example.com", users.Data[0].Email)
		assert.NotEmpty(t, docs.Data))
		assert.NotEmpty(t, response.Answer)
	})
	})
}

func TestSDK_ConcurrentOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping concurrent operations test in short mode")
	}

	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)
		defer client.Close()

	// Test with 5 workers and 20 operations
	duration, errorCount, successCount := runConcurrentOperations(client, 5, 20)

		t.Logf("Concurrent operations completed in %v", duration)
		t.Logf("Error count: %d, Success: %d", errorCount, successCount)
		t.Logf("Success rate: %.1f%%", float64(successCount)/float64(successCount+errorCount)*100)
	})
	}

	// Test with 10 workers and 100 operations
	duration, errorCount, successCount := runConcurrentOperations(client, 10, 100)

		t.Logf("Concurrent operations completed in %v", duration)
		t.Logf("Error count: %d, Success: %d", errorCount, successCount)
		t.Logf("Success rate: %.1f%%", float64(successCount)/float64(successCount+errorCount)*100)
	})
}

func TestSDK_StreamingOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping streaming operations test in short mode")
	}

	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError(t, err)
		defer client.Close()

		// Test RAG streaming
		stream, err := client.RAG.QueryStream(ctx, &QueryRequest{
			Query:    "Explain the architecture of vector databases",
			TenantID: "test-tenant",
			Stream:   true,
		})
		require.NoError(t, err)

		chunkCount := 0
		for chunk := range stream {
			chunkCount++
			if chunk.Type == "chunk" {
				t.Logf("Received chunk: %s", string(chunk.Content))
			}
		}

		// Test LLM streaming
		stream, err := client.LLM.CreateChatCompletionStream(ctx, &ChatCompletionRequest{
			Model: "gpt-3.5-turbo",
			Messages: []sdln.ChatMessage{
				{Role: "system", Content: "You are a helpful assistant"},
				{Role: "user", Content: "What is the meaning of life?"},
			},
			Stream: true,
		})
		require.NoError(t, err)

		chunkCount = 0
		for chunk := range stream {
			chunkCount++
			if chunk.Type == "chunk" {
				t.Logf("LLM chunk: %s", string(chunk.Content))
			}
		}

		// Test WebSocket streaming
		conn, err := client.WebSocket.Connect(ctx)
		require.NoError(t, err)
		defer conn.Close()

		err = conn.Subscribe(&sdln.SubscribeRequest{
			Events: []string{"document.created", "user.updated"},
			TenantID: "test-tenant",
		})
		require.NoError(t, err)

		eventCount := 0
		for event := range conn.Events() {
			eventCount++
			t.Logf("WebSocket event: %s", string(event))
		}

		// Test real-time operations
		err = conn.Send("ping", map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"ping": "ping",
		})
		require.NoError(t, err)

		// Test graceful shutdown
		err = conn.Close()
		require.NoError(t, err)
	}
}

// ========================================
// Performance Tests
// ========================================

func BenchmarkAPIOperations(b *testing.B) {
	client, err := NewClient(DefaultConfig(), WithAPIKey("test-key"))
	require.NoError, err)
	defer client.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StartTimer()

		// Test different service operations
		switch i % 4 {
		case 0:
			_, err := client.Users.List(ctx, &ListOptions{PageSize: 100})
		case 1:
			_, err := client.Documents.List(ctx, &ListOptions{PageSize: 100})
		case 2:
			_, err := client.RAG.Query(ctx, &QueryRequest{})
		case 3:
			_, err := client.Vector.Search(ctx, &SearchRequest{})
		}

		b.StopTimer()
	}
}

// ========================================
// Helper Function for Running Concurrent Operations
// ========================================

func runConcurrentOperations(client *Client, numWorkers, numOps int) (time.Duration, errorCount, successCount int) {
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	errors := make(chan error, numOps*numWorkers)
	results := make(chan interface{})
	start := time.Now()

	for i, op := range numOps {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			result, err := operation(id, op)
			if err != nil {
				errors <- errors
			} else {
				results <- result
			}
		}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	duration := time.Since(start)
	return duration, errorCount, successCount
}

func runConcurrentOperationsWithResults(client *Client, numWorkers, numOps int) (time.Duration, errorCount, successCount int) {
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, numWorkers)
	results := make(chan interface{})
	start := time.Now()

	for i := 0; i < numOps; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// Simulate some work
			time.Sleep(50 * time.Millisecond)
			results <- id
		}(i)
	}

	wg.Wait()
	close(results)

	duration := time.Since(start)
	return duration, errorCount, successCount
}

// ========================================
// Mock Client Implementations
// ========================================

func (m *MockClient) Close() error {
	return nil
}

func (m *MockClient) Use(middleware Middleware) {
	m.middleware = append(m.middleware, middleware)
}

// ========================================
// Performance Test Helper Functions
// ========================================

func measureConcurrentOperation(name string, numWorkers, opsPerWorker int, timeout time.Duration) (float64, errorCount, successCount int) {
	duration, errorCount, successCount = runConcurrentOperations(createTestClient(), numWorkers, opsPerWorker, timeout)
	throughput := float64(successCount) / float64(successCount+errorCount) * 100
	t.Logf("%s: %d ops/sec (%.2f ops/sec, %d failures)", throughput)
	return throughput
}

// ========================================
// File System Utilities
// ========================================

func createTempFile(name string) *os.File {
	file, err := os.CreateTemp("", name)
	if err != nil {
		return nil, err
	}
	return file
}

func removeTempFile(file *os.File) error {
	return os.Remove(file.Name())
}

func createTempFileWithContent(name string, content string) *os.File {
	file, err := os.CreateTemp("", name)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	_, err = file.WriteString([]byte(content))
	if err != nil {
		return nil, err
	}
	return file
}

func removeTempDir(dir string) error {
	if !DirExists(dir) {
		return nil
	}
	return os.RemoveAll(dir)
}

// ========================================
// String Utilities
// ========================================

func SanitizeFilename(filename string) string {
	// Remove potentially dangerous characters
	dangerousChars := []string{"..", "..", "/", "\\", "\x00", "*"}
	result := make([]byte, 0, len(filename))
	for _, char := range filename {
		if !isSafeChar(char) {
			result = append(result, byte('_'))
		} else {
			result = append(result, byte(char))
		}
	}
	return string(result)
}

func IsSafeChar(r rune) bool {
	// Check if character is safe for filenames
	return (r >= 'a' && r <= 'z') ||
		   (r >= 'A' && r <= 'Z') ||
		   (r >= '0' && r <= '9') ||
		   strings.ContainsRune(string(r, "-_")) ||
		   strings.ContainsRune(string(r, "+")) ||
		   strings.ContainsRune(string(r, "/")) ||
		   strings.ContainsRune(string(r, "\\")) ||
		   strings.ContainsRune(string(r, "\"")) ||
		   strings.ContainsRune(string(r, "'")) ||
		   strings.ContainsRune(string(r, ";")) ||
		   strings.ContainsRune(string(r, ","))
}

// ========================================
// Validation Helper Functions
// ========================================

func validateRequired(field string, value interface{}) error {
	if IsEmpty(ToString(value)) {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

func validateEmail(email string) error {
	if !IsValidEmail(email) {
		return fmt.Errorf("invalid email address")
	}
	return nil
}

func validateMinLength(field string, value string, minLen int) error {
	if len(value) < minLen {
		return fmt.Errorf("%s must be at least %d characters long", field, minLen)
	}
	return nil
}

func validateMaxLength(field string, value string, maxLen int) error {
	if len(value) > maxLen {
		return fmt.Errorf("%s must be no more than %d characters long", field, maxLen)
	}
	return nil
}

func validateRange(field string, value float64, min, max float64, message string) error {
	if value < min || value > max {
		return fmt.Errorf("%s must be between %.2f and %.2f", field, min, max, message)
	}
	return nil
}

func validatePositive(field string, value float64, message string) error {
	if value <= 0 {
		return fmt.Errorf("%s must be positive", field, message)
	}
	return nil
}

func validateRequiredString(field string, value string) error {
	if IsEmpty(value) {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

func validateOptionalString(field string, value string) error {
	// Optional field can be empty
	return nil
}

// ========================================
// Cache Helper Functions
// ========================================

func parseJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

func parseJSONString(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}

// ========================================
// Environment Variables
// ========================================

func GetEnvVar(key, defaultValue string) string {
	return GetEnv(key, defaultValue)
}

func GetEnvAsInt(key string, defaultValue int) int {
	return GetEnvAsInt(key, defaultValue)
}

func GetEnvAsFloat(key string, defaultValue float64) float64 {
	return GetEnvAsFloat(key, defaultValue)
}

func IsDevelopment() bool {
	return GetEnvAsBool("DEBUG", false)
}

func IsProduction() bool {
	return GetEnvAsBool("PRODUCTION", false)
}
