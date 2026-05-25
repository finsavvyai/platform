// sdln_comprehensive_test.go - Comprehensive Unit Tests for SDLN Services
package sdln

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// MockService is a mock implementation of SDLN services
type MockService struct {
	mock.Mock
}

// TestSDLNSuite is the comprehensive test suite for SDLN
type TestSDLNSuite struct {
	suite.Suite
	mockService *MockService
	config      *Config
	ctx         context.Context
}

// SetupSuite runs once before all tests
func (suite *TestSDLNSuite) SetupSuite() {
	suite.ctx = context.Background()
	suite.mockService = new(MockService)
	suite.config = &Config{
		APIBaseURL: "https://api.test.sdln.ai",
		APIKey:     "test-key",
		Timeout:    30 * time.Second,
	}
}

// TestClientInitialization tests client creation and configuration
func (suite *TestSDLNSuite) TestClientInitialization() {
	tests := []struct {
		name        string
		config      *Config
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid configuration",
			config: &Config{
				APIBaseURL: "https://api.sdln.ai",
				APIKey:     "valid-key",
				Timeout:    30 * time.Second,
			},
			expectError: false,
		},
		{
			name: "empty API key",
			config: &Config{
				APIBaseURL: "https://api.sdln.ai",
				APIKey:     "",
				Timeout:    30 * time.Second,
			},
			expectError: true,
			errorMsg:    "API key is required",
		},
		{
			name: "invalid URL",
			config: &Config{
				APIBaseURL: "invalid-url",
				APIKey:     "valid-key",
				Timeout:    30 * time.Second,
			},
			expectError: true,
			errorMsg:    "invalid API base URL",
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			client, err := NewClient(suite.config.APIBaseURL, suite.config.APIKey)

			if tt.expectError {
				suite.Error(err)
				suite.Contains(err.Error(), tt.errorMsg)
				suite.Nil(client)
			} else {
				suite.NoError(err)
				suite.NotNil(client)
			}
		})
	}
}

// TestAuthentication tests JWT authentication
func (suite *TestSDLNSuite) TestAuthentication() {
	tests := []struct {
		name          string
		token         string
		expectedValid bool
		expectError   bool
	}{
		{
			name:          "valid JWT token",
			token:         generateValidJWT(),
			expectedValid: true,
			expectError:   false,
		},
		{
			name:          "invalid JWT token",
			token:         "invalid.token.here",
			expectedValid: false,
			expectError:   true,
		},
		{
			name:          "expired JWT token",
			token:         generateExpiredJWT(),
			expectedValid: false,
			expectError:   true,
		},
		{
			name:          "empty token",
			token:         "",
			expectedValid: false,
			expectError:   true,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			client := NewTestClient(suite.config)

			if tt.token != "" {
				client.SetAuthToken(tt.token)
			}

			valid, err := client.ValidateToken()

			if tt.expectError {
				suite.Error(err)
				suite.False(valid)
			} else {
				suite.NoError(err)
				suite.Equal(tt.expectedValid, valid)
			}
		})
	}
}

// TestDocumentService tests document CRUD operations
func (suite *TestSDLNSuite) TestDocumentService() {
	client := NewTestClient(suite.config)
	docService := client.Documents()

	suite.Run("CreateDocument", func() {
		doc := &Document{
			ID:          uuid.New().String(),
			Title:       "Test Document",
			Content:     "This is test content",
			TenantID:    "test-tenant",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		// Test successful creation
		createdDoc, err := docService.Create(suite.ctx, doc)
		suite.NoError(err)
		suite.NotNil(createdDoc)
		suite.Equal(doc.Title, createdDoc.Title)
		suite.Equal(doc.Content, createdDoc.Content)
		suite.NotEmpty(createdDoc.ID)
	})

	suite.Run("GetDocument", func() {
		docID := uuid.New().String()

		// Test successful retrieval
		doc, err := docService.Get(suite.ctx, docID)
		suite.NoError(err)
		suite.NotNil(doc)
		suite.Equal(docID, doc.ID)

		// Test not found
		_, err = docService.Get(suite.ctx, "non-existent-id")
		suite.Error(err)
		suite.True(errors.Is(err, ErrDocumentNotFound))
	})

	suite.Run("UpdateDocument", func() {
		doc := &Document{
			ID:      uuid.New().String(),
			Title:   "Updated Title",
			Content: "Updated content",
		}

		// Test successful update
		updatedDoc, err := docService.Update(suite.ctx, doc)
		suite.NoError(err)
		suite.NotNil(updatedDoc)
		suite.Equal(doc.Title, updatedDoc.Title)
		suite.Equal(doc.Content, updatedDoc.Content)
	})

	suite.Run("DeleteDocument", func() {
		docID := uuid.New().String()

		// Test successful deletion
		err := docService.Delete(suite.ctx, docID)
		suite.NoError(err)

		// Verify deletion
		_, err = docService.Get(suite.ctx, docID)
		suite.Error(err)
		suite.True(errors.Is(err, ErrDocumentNotFound))
	})

	suite.Run("ListDocuments", func() {
		filter := &DocumentFilter{
			TenantID:  "test-tenant",
			Limit:     10,
			Offset:    0,
			SortBy:    "created_at",
			SortOrder: "desc",
		}

		// Test successful listing
		docs, total, err := docService.List(suite.ctx, filter)
		suite.NoError(err)
		suite.NotNil(docs)
		suite.GreaterOrEqual(total, int64(0))
	})
}

// TestVectorService tests vector search and embedding operations
func (suite *TestSDLNSuite) TestVectorService() {
	client := NewTestClient(suite.config)
	vectorService := client.Vectors()

	suite.Run("GenerateEmbedding", func() {
		text := "This is a test text for embedding generation"

		// Test successful embedding generation
		embedding, err := vectorService.GenerateEmbedding(suite.ctx, text)
		suite.NoError(err)
		suite.NotNil(embedding)
		suite.Greater(len(embedding.Values), 0)
		suite.NotEmpty(embedding.Model)
	})

	suite.Run("SearchVectors", func() {
		query := &VectorQuery{
			Vector:    []float32{0.1, 0.2, 0.3, 0.4, 0.5},
			TopK:      5,
			TenantID:  "test-tenant",
			Threshold: 0.7,
		}

		// Test successful vector search
		results, err := vectorService.Search(suite.ctx, query)
		suite.NoError(err)
		suite.NotNil(results)
		suite.LessOrEqual(len(results), query.TopK)

		for _, result := range results {
			suite.GreaterOrEqual(result.Score, query.Threshold)
			suite.NotEmpty(result.DocumentID)
		}
	})

	suite.Run("IndexDocument", func() {
		doc := &Document{
			ID:      uuid.New().String(),
			Title:   "Test Document for Indexing",
			Content: "Content to be indexed for vector search",
		}

		// Test successful indexing
		err := vectorService.IndexDocument(suite.ctx, doc)
		suite.NoError(err)
	})

	suite.Run("DeleteFromIndex", func() {
		docID := uuid.New().String()

		// Test successful deletion from index
		err := vectorService.DeleteFromIndex(suite.ctx, docID)
		suite.NoError(err)
	})
}

// TestLLMService tests LLM integration
func (suite *TestSDLNSuite) TestLLMService() {
	client := NewTestClient(suite.config)
	llmService := client.LLM()

	suite.Run("GenerateCompletion", func() {
		req := &CompletionRequest{
			Model: "gpt-4",
			Messages: []Message{
				{Role: "system", Content: "You are a helpful assistant."},
				{Role: "user", Content: "Hello, how are you?"},
			},
			MaxTokens:   100,
			Temperature: 0.7,
		}

		// Test successful completion generation
		resp, err := llmService.GenerateCompletion(suite.ctx, req)
		suite.NoError(err)
		suite.NotNil(resp)
		suite.NotEmpty(resp.Content)
		suite.Greater(resp.Usage.TotalTokens, 0)
	})

	suite.Run("GenerateStreamingCompletion", func() {
		req := &CompletionRequest{
			Model: "gpt-4",
			Messages: []Message{
				{Role: "user", Content: "Count from 1 to 5"},
			},
			Stream: true,
		}

		// Test streaming completion
		stream, err := llmService.GenerateStreamingCompletion(suite.ctx, req)
		suite.NoError(err)
		suite.NotNil(stream)

		// Collect streaming chunks
		var chunks []string
		for chunk := range stream {
			chunks = append(chunks, chunk.Content)
			if chunk.FinishReason == "stop" {
				break
			}
		}

		suite.Greater(len(chunks), 0)
	})

	suite.Run("GenerateEmbedding", func() {
		text := "Test text for embedding"

		// Test embedding generation
		embedding, err := llmService.GenerateEmbedding(suite.ctx, text, "text-embedding-ada-002")
		suite.NoError(err)
		suite.NotNil(embedding)
		suite.Greater(len(embedding), 0)
	})
}

// TestPolicyService tests policy management
func (suite *TestSDLNSuite) TestPolicyService() {
	client := NewTestClient(suite.config)
	policyService := client.Policies()

	suite.Run("CreatePolicy", func() {
		policy := &Policy{
			ID:          uuid.New().String(),
			Name:        "Test Policy",
			Description: "A test policy for validation",
			TenantID:    "test-tenant",
			Rules: []PolicyRule{
				{
					Effect:    "allow",
					Action:    ["read"],
					Resource:  ["documents"],
					Condition: map[string]interface{}{"department": "engineering"},
				},
			},
			CreatedAt: time.Now(),
		}

		// Test successful policy creation
		createdPolicy, err := policyService.Create(suite.ctx, policy)
		suite.NoError(err)
		suite.NotNil(createdPolicy)
		suite.Equal(policy.Name, createdPolicy.Name)
		suite.NotEmpty(createdPolicy.ID)
	})

	suite.Run("EvaluatePolicy", func() {
		req := &PolicyEvaluationRequest{
			UserID:    "user-123",
			Action:    "read",
			Resource:  "documents/doc-456",
			Context:   map[string]interface{}{"department": "engineering"},
			TenantID:  "test-tenant",
		}

		// Test policy evaluation
		result, err := policyService.Evaluate(suite.ctx, req)
		suite.NoError(err)
		suite.NotNil(result)
		suite.NotNil(result.Allowed)
		suite.NotEmpty(result.PolicyID)
	})
}

// TestMonitoringService tests monitoring and metrics
func (suite *TestSDLNSuite) TestMonitoringService() {
	client := NewTestClient(suite.config)
	monitoring := client.Monitoring()

	suite.Run("GetMetrics", func() {
		// Test metrics retrieval
		metrics, err := monitoring.GetMetrics(suite.ctx, &MetricsQuery{
			StartTime: time.Now().Add(-1 * time.Hour),
			EndTime:   time.Now(),
			TenantID:  "test-tenant",
		})
		suite.NoError(err)
		suite.NotNil(metrics)
		suite.NotEmpty(metrics.Requests)
		suite.NotEmpty(metrics.Errors)
		suite.NotEmpty(metrics.Latency)
	})

	suite.Run("GetHealthStatus", func() {
		// Test health status
		status, err := monitoring.GetHealthStatus(suite.ctx)
		suite.NoError(err)
		suite.NotNil(status)
		suite.True(status.Healthy)
		suite.NotEmpty(status.Services)
	})

	suite.Run("CreateAlert", func() {
		alert := &Alert{
			ID:          uuid.New().String(),
			Name:        "Test Alert",
			Description: "A test alert for monitoring",
			Severity:    "warning",
			Condition:   "error_rate > 0.05",
			Enabled:     true,
			CreatedAt:   time.Now(),
		}

		// Test alert creation
		createdAlert, err := monitoring.CreateAlert(suite.ctx, alert)
		suite.NoError(err)
		suite.NotNil(createdAlert)
		suite.Equal(alert.Name, createdAlert.Name)
	})
}

// TestErrorHandling tests various error scenarios
func (suite *TestSDLNSuite) TestErrorHandling() {
	client := NewTestClient(suite.config)

	suite.Run("NetworkError", func() {
		// Create client with invalid URL to simulate network error
		invalidClient := NewTestClient(&Config{
			APIBaseURL: "http://invalid-url-that-does-not-exist.com",
			APIKey:     "test-key",
			Timeout:    1 * time.Second,
		})

		_, err := invalidClient.Documents().Get(suite.ctx, "test-id")
		suite.Error(err)
		suite.True(errors.Is(err, ErrNetworkError) || errors.Is(err, context.DeadlineExceeded))
	})

	suite.Run("UnauthorizedError", func() {
		// Create client with invalid API key
		unauthClient := NewTestClient(&Config{
			APIBaseURL: suite.config.APIBaseURL,
			APIKey:     "invalid-api-key",
			Timeout:    suite.config.Timeout,
		})

		_, err := unauthClient.Documents().Get(suite.ctx, "test-id")
		suite.Error(err)
		suite.True(errors.Is(err, ErrUnauthorized))
	})

	suite.Run("RateLimitError", func() {
		// Simulate rate limit by making many requests
		client := NewTestClient(suite.config)

		for i := 0; i < 100; i++ {
			_, err := client.Documents().Get(suite.ctx, uuid.New().String())
			if err != nil && errors.Is(err, ErrRateLimited) {
				// Rate limit hit
				suite.Error(err)
				suite.True(errors.Is(err, ErrRateLimited))
				break
			}
		}
	})

	suite.Run("ValidationError", func() {
		// Test with invalid document data
		doc := &Document{
			ID:    "", // Empty ID should cause validation error
			Title: strings.Repeat("a", 1001), // Title too long
		}

		_, err := client.Documents().Create(suite.ctx, doc)
		suite.Error(err)
		suite.True(errors.Is(err, ErrValidation))
	})
}

// TestConcurrency tests concurrent operations
func (suite *TestSDLNSuite) TestConcurrency() {
	client := NewTestClient(suite.config)
	docService := client.Documents()

	suite.Run("ConcurrentDocumentOperations", func() {
		const numGoroutines = 10
		const numOperations = 5

		errChan := make(chan error, numGoroutines)

		// Start multiple goroutines performing document operations
		for i := 0; i < numGoroutines; i++ {
			go func(id int) {
				for j := 0; j < numOperations; j++ {
					doc := &Document{
						ID:      fmt.Sprintf("doc-%d-%d", id, j),
						Title:   fmt.Sprintf("Document %d-%d", id, j),
						Content: fmt.Sprintf("Content for document %d-%d", id, j),
					}

					// Create
					created, err := docService.Create(suite.ctx, doc)
					if err != nil {
						errChan <- err
						return
					}

					// Get
					_, err = docService.Get(suite.ctx, created.ID)
					if err != nil {
						errChan <- err
						return
					}

					// Update
					created.Title = fmt.Sprintf("Updated %d-%d", id, j)
					_, err = docService.Update(suite.ctx, created)
					if err != nil {
						errChan <- err
						return
					}

					// Delete
					err = docService.Delete(suite.ctx, created.ID)
					if err != nil {
						errChan <- err
						return
					}
				}
				errChan <- nil
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			err := <-errChan
			suite.NoError(err)
		}
	})
}

// TestPerformance benchmarks critical operations
func (suite *TestSDLNSuite) TestPerformance() {
	client := NewTestClient(suite.config)

	suite.Run("DocumentCreationPerformance", func() {
		const numDocs = 100
		start := time.Now()

		for i := 0; i < numDocs; i++ {
			doc := &Document{
				ID:      uuid.New().String(),
				Title:   fmt.Sprintf("Performance Test Doc %d", i),
				Content: fmt.Sprintf("Content %d", i),
			}

			_, err := client.Documents().Create(suite.ctx, doc)
			suite.NoError(err)
		}

		duration := time.Since(start)
		avgDuration := duration / numDocs

		// Assert average creation time is under 100ms
		suite.Less(avgDuration, 100*time.Millisecond)
		suite.Printf("Created %d documents in %v (avg: %v)", numDocs, duration, avgDuration)
	})

	suite.Run("VectorSearchPerformance", func() {
		const numSearches = 50
		query := &VectorQuery{
			Vector:    make([]float32, 1536), // Typical embedding size
			TopK:      10,
			Threshold: 0.7,
		}

		start := time.Now()

		for i := 0; i < numSearches; i++ {
			_, err := client.Vectors().Search(suite.ctx, query)
			suite.NoError(err)
		}

		duration := time.Since(start)
		avgDuration := duration / numSearches

		// Assert average search time is under 50ms
		suite.Less(avgDuration, 50*time.Millisecond)
		suite.Printf("Performed %d searches in %v (avg: %v)", numSearches, duration, avgDuration)
	})
}

// Helper functions

// NewTestClient creates a test client with mock capabilities
func NewTestClient(config *Config) *Client {
	client := &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
	return client
}

// generateValidJWT creates a valid JWT token for testing
func generateValidJWT() string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   "user-123",
		"iss":   "sdln-auth",
		"aud":   "sdln-api",
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
		"scope": "read write",
	})

	tokenString, _ := token.SignedString([]byte("test-secret"))
	return tokenString
}

// generateExpiredJWT creates an expired JWT token for testing
func generateExpiredJWT() string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   "user-123",
		"iss":   "sdln-auth",
		"aud":   "sdln-api",
		"exp":   time.Now().Add(-1 * time.Hour).Unix(),
		"iat":   time.Now().Add(-2 * time.Hour).Unix(),
		"scope": "read write",
	})

	tokenString, _ := token.SignedString([]byte("test-secret"))
	return tokenString
}

// TestSDLNSuiteRunner runs the test suite
func TestSDLNSuiteRunner(t *testing.T) {
	suite.Run(t, new(TestSDLNSuite))
}

// Benchmark tests
func BenchmarkDocumentCreate(b *testing.B) {
	config := &Config{
		APIBaseURL: "https://api.test.sdln.ai",
		APIKey:     "test-key",
		Timeout:    30 * time.Second,
	}
	client := NewTestClient(config)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		doc := &Document{
			ID:      uuid.New().String(),
			Title:   fmt.Sprintf("Benchmark Doc %d", i),
			Content: fmt.Sprintf("Content %d", i),
		}

		_, err := client.Documents().Create(ctx, doc)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVectorSearch(b *testing.B) {
	config := &Config{
		APIBaseURL: "https://api.test.sdln.ai",
		APIKey:     "test-key",
		Timeout:    30 * time.Second,
	}
	client := NewTestClient(config)
	ctx := context.Background()

	query := &VectorQuery{
		Vector:    make([]float32, 1536),
		TopK:      10,
		Threshold: 0.7,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := client.Vectors().Search(ctx, query)
		if err != nil {
			b.Fatal(err)
		}
	}
}
