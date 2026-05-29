// integration_test.go - Integration Tests for SDLN Services
package sdln

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// IntegrationTestSuite tests service-to-service interactions
type IntegrationTestSuite struct {
	suite.Suite
	server      *httptest.Server
	client      *Client
	testData    *TestData
	cleanupFunc func()
}

// TestData holds test data for integration tests
type TestData struct {
	Tenant    *Tenant
	User      *User
	Documents []*Document
	Policies  []*Policy
	VectorIDs []string
}

// SetupSuite runs once before all integration tests
func (suite *IntegrationTestSuite) SetupSuite() {
	// Setup test server
	suite.setupTestServer()

	// Setup client
	suite.setupClient()

	// Setup test data
	suite.setupTestData()

	suite.T().Log("Integration test suite setup complete")
}

// TearDownSuite runs once after all integration tests
func (suite *IntegrationTestSuite) TearDownSuite() {
	// Cleanup resources
	if suite.cleanupFunc != nil {
		suite.cleanupFunc()
	}

	if suite.server != nil {
		suite.server.Close()
	}

	suite.T().Log("Integration test suite teardown complete")
}

// setupTestServer creates a mock HTTP server for testing
func (suite *IntegrationTestSuite) setupTestServer() {
	mux := http.NewServeMux()

	// Register handlers for all API endpoints
	mux.HandleFunc("/api/v1/auth/login", suite.handleLogin)
	mux.HandleFunc("/api/v1/tenants/", suite.handleTenants)
	mux.HandleFunc("/api/v1/users/", suite.handleUsers)
	mux.HandleFunc("/api/v1/documents/", suite.handleDocuments)
	mux.HandleFunc("/api/v1/vectors/", suite.handleVectors)
	mux.HandleFunc("/api/v1/policies/", suite.handlePolicies)
	mux.HandleFunc("/api/v1/llm/completions", suite.handleLLMCompletions)
	mux.HandleFunc("/api/v1/monitoring/metrics", suite.handleMetrics)
	mux.HandleFunc("/api/v1/monitoring/health", suite.handleHealth)

	suite.server = httptest.NewServer(mux)
}

// setupClient initializes the test client
func (suite *IntegrationTestSuite) setupClient() {
	config := &Config{
		APIBaseURL: suite.server.URL,
		APIKey:     "test-api-key-12345",
		Timeout:    30 * time.Second,
	}

	var err error
	suite.client, err = NewClient(config.APIBaseURL, config.APIKey)
	require.NoError(suite.T(), err)

	suite.client.SetTimeout(config.Timeout)
}

// setupTestData creates test data
func (suite *IntegrationTestSuite) setupTestData() {
	suite.testData = &TestData{
		Tenant: &Tenant{
			ID:          uuid.New().String(),
			Name:        "Test Tenant",
			Description: "Integration test tenant",
			CreatedAt:   time.Now(),
		},
		User: &User{
			ID:        uuid.New().String(),
			Email:     "test@example.com",
			Name:      "Test User",
			TenantID:  uuid.New().String(),
			CreatedAt: time.Now(),
		},
	}

	// Create test documents
	for i := 0; i < 5; i++ {
		doc := &Document{
			ID:        uuid.New().String(),
			Title:     fmt.Sprintf("Test Document %d", i),
			Content:   fmt.Sprintf("This is test document number %d with sample content", i),
			TenantID:  suite.testData.Tenant.ID,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		suite.testData.Documents = append(suite.testData.Documents, doc)
	}

	// Create test policies
	for i := 0; i < 3; i++ {
		policy := &Policy{
			ID:          uuid.New().String(),
			Name:        fmt.Sprintf("Test Policy %d", i),
			Description: fmt.Sprintf("Test policy number %d", i),
			TenantID:    suite.testData.Tenant.ID,
			Rules: []PolicyRule{
				{
					Effect:   "allow",
					Action:   []string{"read", "write"},
					Resource: []string{"documents"},
				},
			},
			CreatedAt: time.Now(),
		}
		suite.testData.Policies = append(suite.testData.Policies, policy)
	}
}

// TestAuthenticationFlow tests the complete authentication flow
func (suite *IntegrationTestSuite) TestAuthenticationFlow() {
	ctx := context.Background()

	// Test login
	loginReq := map[string]string{
		"email":    "test@example.com",
		"password": "test-password",
	}

	token, err := suite.client.Auth().Login(ctx, loginReq["email"], loginReq["password"])
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), token)

	// Set auth token on client
	suite.client.SetAuthToken(token)

	// Verify token is valid
	valid, err := suite.client.ValidateToken()
	require.NoError(suite.T(), err)
	require.True(suite.T(), valid)

	// Test token refresh
	newToken, err := suite.client.Auth().RefreshToken(ctx, token)
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), newToken)
	require.NotEqual(suite.T(), token, newToken)

	// Test logout
	err = suite.client.Auth().Logout(ctx, newToken)
	require.NoError(suite.T(), err)
}

// TestDocumentWorkflow tests complete document lifecycle
func (suite *IntegrationTestSuite) TestDocumentWorkflow() {
	ctx := context.Background()
	docService := suite.client.Documents()

	// Create document
	doc := &Document{
		Title:    "Integration Test Document",
		Content:  "This document tests the complete workflow",
		TenantID: suite.testData.Tenant.ID,
		Tags:     []string{"test", "integration", "workflow"},
		Metadata: map[string]interface{}{"author": "test-suite"},
	}

	createdDoc, err := docService.Create(ctx, doc)
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), createdDoc.ID)

	// Get document
	retrievedDoc, err := docService.Get(ctx, createdDoc.ID)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), createdDoc.ID, retrievedDoc.ID)
	require.Equal(suite.T(), doc.Title, retrievedDoc.Title)

	// Update document
	retrievedDoc.Title = "Updated Integration Test Document"
	retrievedDoc.Content = "Updated content for workflow testing"

	updatedDoc, err := docService.Update(ctx, retrievedDoc)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), retrievedDoc.Title, updatedDoc.Title)

	// Search documents
	filter := &DocumentFilter{
		TenantID: suite.testData.Tenant.ID,
		Query:    "integration",
		Tags:     []string{"test"},
		Limit:    10,
		Offset:   0,
	}

	docs, total, err := docService.List(ctx, filter)
	require.NoError(suite.T(), err)
	require.GreaterOrEqual(suite.T(), len(docs), 1)
	require.GreaterOrEqual(suite.T(), total, int64(1))

	// Delete document
	err = docService.Delete(ctx, createdDoc.ID)
	require.NoError(suite.T(), err)

	// Verify deletion
	_, err = docService.Get(ctx, createdDoc.ID)
	require.Error(suite.T(), err)
	require.True(suite.T(), errors.Is(err, ErrDocumentNotFound))
}

// TestRAGWorkflow tests the complete RAG (Retrieval-Augmented Generation) workflow
func (suite *IntegrationTestSuite) TestRAGWorkflow() {
	ctx := context.Background()

	// Step 1: Create and index documents
	docIDs := []string{}
	for i := 0; i < 3; i++ {
		doc := &Document{
			Title:    fmt.Sprintf("RAG Test Document %d", i),
			Content:  fmt.Sprintf("This is document %d about artificial intelligence and machine learning fundamentals", i),
			TenantID: suite.testData.Tenant.ID,
			Metadata: map[string]interface{}{"category": "AI", "index": i},
		}

		createdDoc, err := suite.client.Documents().Create(ctx, doc)
		require.NoError(suite.T(), err)
		docIDs = append(docIDs, createdDoc.ID)

		// Index for vector search
		err = suite.client.Vectors().IndexDocument(ctx, createdDoc)
		require.NoError(suite.T(), err)
	}

	// Step 2: Generate embedding for query
	queryText := "What is artificial intelligence?"
	embedding, err := suite.client.Vectors().GenerateEmbedding(ctx, queryText)
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), embedding.Values)

	// Step 3: Search for relevant documents
	query := &VectorQuery{
		Vector:    embedding.Values,
		TopK:      3,
		TenantID:  suite.testData.Tenant.ID,
		Threshold: 0.5,
	}

	results, err := suite.client.Vectors().Search(ctx, query)
	require.NoError(suite.T(), err)
	require.GreaterOrEqual(suite.T(), len(results), 1)

	// Step 4: Build RAG context
	context := &RAGContext{
		Query:     queryText,
		Documents: make([]*Document, len(results)),
		Scores:    make([]float32, len(results)),
	}

	for i, result := range results {
		doc, err := suite.client.Documents().Get(ctx, result.DocumentID)
		require.NoError(suite.T(), err)
		context.Documents[i] = doc
		context.Scores[i] = result.Score
	}

	// Step 5: Generate completion with RAG context
	messages := []Message{
		{Role: "system", Content: "You are a helpful assistant. Use the provided context to answer questions."},
		{Role: "user", Content: fmt.Sprintf("Context: %s\n\nQuestion: %s", context.FormatContext(), queryText)},
	}

	req := &CompletionRequest{
		Model:       "gpt-4",
		Messages:    messages,
		MaxTokens:   500,
		Temperature: 0.7,
	}

	resp, err := suite.client.LLM().GenerateCompletion(ctx, req)
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), resp.Content)

	// Step 6: Cleanup
	for _, docID := range docIDs {
		suite.client.Vectors().DeleteFromIndex(ctx, docID)
		suite.client.Documents().Delete(ctx, docID)
	}
}

// TestPolicyEnforcement tests policy evaluation and enforcement
func (suite *IntegrationTestSuite) TestPolicyEnforcement() {
	ctx := context.Background()
	policyService := suite.client.Policies()

	// Create test policy
	policy := &Policy{
		Name:        "Document Access Policy",
		Description: "Controls document access based on department",
		TenantID:    suite.testData.Tenant.ID,
		Rules: []PolicyRule{
			{
				Effect:   "allow",
				Action:   []string{"read"},
				Resource: []string{"documents"},
				Condition: map[string]interface{}{
					"department": map[string]interface{}{
						"eq": "engineering",
					},
				},
			},
			{
				Effect:   "deny",
				Action:   []string{"delete"},
				Resource: []string{"documents"},
				Condition: map[string]interface{}{
					"role": map[string]interface{}{
						"ne": "admin",
					},
				},
			},
		},
		CreatedAt: time.Now(),
	}

	createdPolicy, err := policyService.Create(ctx, policy)
	require.NoError(suite.T(), err)

	// Test policy evaluation scenarios
	testCases := []struct {
		name     string
		request  *PolicyEvaluationRequest
		expected bool
	}{
		{
			name: "Engineering user can read documents",
			request: &PolicyEvaluationRequest{
				UserID:   "user-eng-123",
				Action:   "read",
				Resource: "documents/doc-456",
				Context: map[string]interface{}{
					"department": "engineering",
					"role":       "developer",
				},
				TenantID: suite.testData.Tenant.ID,
			},
			expected: true,
		},
		{
			name: "Marketing user cannot read documents",
			request: &PolicyEvaluationRequest{
				UserID:   "user-mkt-789",
				Action:   "read",
				Resource: "documents/doc-456",
				Context: map[string]interface{}{
					"department": "marketing",
					"role":       "analyst",
				},
				TenantID: suite.testData.Tenant.ID,
			},
			expected: false,
		},
		{
			name: "Non-admin user cannot delete documents",
			request: &PolicyEvaluationRequest{
				UserID:   "user-eng-123",
				Action:   "delete",
				Resource: "documents/doc-456",
				Context: map[string]interface{}{
					"department": "engineering",
					"role":       "developer",
				},
				TenantID: suite.testData.Tenant.ID,
			},
			expected: false,
		},
		{
			name: "Admin user can delete documents",
			request: &PolicyEvaluationRequest{
				UserID:   "user-admin-001",
				Action:   "delete",
				Resource: "documents/doc-456",
				Context: map[string]interface{}{
					"department": "engineering",
					"role":       "admin",
				},
				TenantID: suite.testData.Tenant.ID,
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			result, err := policyService.Evaluate(ctx, tc.request)
			require.NoError(suite.T(), err)
			require.NotNil(suite.T(), result)
			require.Equal(suite.T(), tc.expected, result.Allowed)
			require.Equal(suite.T(), createdPolicy.ID, result.PolicyID)
		})
	}
}

// TestMultiTenantIsolation tests tenant isolation
func (suite *IntegrationTestSuite) TestMultiTenantIsolation() {
	ctx := context.Background()

	// Create two tenants
	tenant1 := &Tenant{
		ID:          uuid.New().String(),
		Name:        "Tenant 1",
		Description: "First test tenant",
	}
	tenant2 := &Tenant{
		ID:          uuid.New().String(),
		Name:        "Tenant 2",
		Description: "Second test tenant",
	}

	// Create documents for each tenant
	doc1 := &Document{
		Title:    "Tenant 1 Document",
		Content:  "Confidential data for tenant 1",
		TenantID: tenant1.ID,
	}
	doc2 := &Document{
		Title:    "Tenant 2 Document",
		Content:  "Confidential data for tenant 2",
		TenantID: tenant2.ID,
	}

	// Create documents with respective tenant contexts
	client1 := suite.client
	client1.SetTenantID(tenant1.ID)

	client2 := suite.client
	client2.SetTenantID(tenant2.ID)

	createdDoc1, err := client1.Documents().Create(ctx, doc1)
	require.NoError(suite.T(), err)

	createdDoc2, err := client2.Documents().Create(ctx, doc2)
	require.NoError(suite.T(), err)

	// Test isolation: Tenant 1 cannot access Tenant 2's documents
	_, err = client1.Documents().Get(ctx, createdDoc2.ID)
	require.Error(suite.T(), err)
	require.True(suite.T(), errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrDocumentNotFound))

	// Test isolation: Tenant 2 cannot access Tenant 1's documents
	_, err = client2.Documents().Get(ctx, createdDoc1.ID)
	require.Error(suite.T(), err)
	require.True(suite.T(), errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrDocumentNotFound))

	// Test each tenant can access their own documents
	retrievedDoc1, err := client1.Documents().Get(ctx, createdDoc1.ID)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), createdDoc1.ID, retrievedDoc1.ID)

	retrievedDoc2, err := client2.Documents().Get(ctx, createdDoc2.ID)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), createdDoc2.ID, retrievedDoc2.ID)

	// Cleanup
	client1.Documents().Delete(ctx, createdDoc1.ID)
	client2.Documents().Delete(ctx, createdDoc2.ID)
}

// TestStreamingOperations tests streaming functionality
func (suite *IntegrationTestSuite) TestStreamingOperations() {
	ctx := context.Background()

	// Test streaming document upload
	doc := &Document{
		Title:    "Large Document for Streaming",
		Content:  strings.Repeat("This is a large document content. ", 1000),
		TenantID: suite.testData.Tenant.ID,
	}

	stream, err := suite.client.Documents().CreateStream(ctx, doc)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), stream)

	// Read streaming response
	createdDoc, err := stream.ReadDocument()
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), createdDoc.ID)

	// Test streaming LLM completion
	req := &CompletionRequest{
		Model: "gpt-4",
		Messages: []Message{
			{Role: "user", Content: "Write a short story about AI"},
		},
		Stream:    true,
		MaxTokens: 200,
	}

	llmStream, err := suite.client.LLM().GenerateStreamingCompletion(ctx, req)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), llmStream)

	// Collect streaming chunks
	var chunks []string
	for chunk := range llmStream {
		if chunk.Content != "" {
			chunks = append(chunks, chunk.Content)
		}
		if chunk.FinishReason == "stop" {
			break
		}
	}

	require.Greater(suite.T(), len(chunks), 0)

	// Cleanup
	suite.client.Documents().Delete(ctx, createdDoc.ID)
}

// TestErrorHandlingAndRecovery tests error scenarios and recovery
func (suite *IntegrationTestSuite) TestErrorHandlingAndRecovery() {
	ctx := context.Background()

	// Test retry mechanism with temporary failures
	doc := &Document{
		Title:    "Retry Test Document",
		Content:  "Testing retry functionality",
		TenantID: suite.testData.Tenant.ID,
	}

	// Configure client for retry
	suite.client.SetRetryConfig(3, 100*time.Millisecond, 2.0)

	createdDoc, err := suite.client.Documents().Create(ctx, doc)
	require.NoError(suite.T(), err)
	require.NotEmpty(suite.T(), createdDoc.ID)

	// Test timeout handling
	timeoutCtx, cancel := context.WithTimeout(ctx, 1*time.Millisecond)
	defer cancel()

	// This should timeout
	_, err = suite.client.Documents().Get(timeoutCtx, createdDoc.ID)
	require.Error(suite.T(), err)
	require.True(suite.T(), errors.Is(err, context.DeadlineExceeded))

	// Test recovery - normal operations should still work
	retrievedDoc, err := suite.client.Documents().Get(ctx, createdDoc.ID)
	require.NoError(suite.T(), err)
	require.Equal(suite.T(), createdDoc.ID, retrievedDoc.ID)

	// Cleanup
	suite.client.Documents().Delete(ctx, createdDoc.ID)
}

// TestConcurrentOperations tests concurrent access and operations
func (suite *IntegrationTestSuite) TestConcurrentOperations() {
	ctx := context.Background()
	const numWorkers = 10
	const numOperations = 5

	errChan := make(chan error, numWorkers)
	results := make(chan []*Document, numWorkers)

	// Start workers performing document operations concurrently
	for i := 0; i < numWorkers; i++ {
		go func(workerID int) {
			var docs []*Document

			for j := 0; j < numOperations; j++ {
				doc := &Document{
					Title:    fmt.Sprintf("Worker %d Doc %d", workerID, j),
					Content:  fmt.Sprintf("Content from worker %d, operation %d", workerID, j),
					TenantID: suite.testData.Tenant.ID,
				}

				// Create
				created, err := suite.client.Documents().Create(ctx, doc)
				if err != nil {
					errChan <- err
					return
				}
				docs = append(docs, created)

				// Read
				_, err = suite.client.Documents().Get(ctx, created.ID)
				if err != nil {
					errChan <- err
					return
				}

				// Update
				created.Title = fmt.Sprintf("Updated Worker %d Doc %d", workerID, j)
				_, err = suite.client.Documents().Update(ctx, created)
				if err != nil {
					errChan <- err
					return
				}
			}

			results <- docs
			errChan <- nil
		}(i)
	}

	// Wait for all workers to complete
	var allDocs []*Document
	for i := 0; i < numWorkers; i++ {
		err := <-errChan
		require.NoError(suite.T(), err)

		docs := <-results
		allDocs = append(allDocs, docs...)
	}

	// Verify all documents were created successfully
	require.Equal(suite.T(), numWorkers*numOperations, len(allDocs))

	// Cleanup all documents
	for _, doc := range allDocs {
		err := suite.client.Documents().Delete(ctx, doc.ID)
		require.NoError(suite.T(), err)
	}
}

// HTTP Handlers for mock server

func (suite *IntegrationTestSuite) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]string{
		"access_token":  "mock-access-token",
		"refresh_token": "mock-refresh-token",
		"token_type":    "Bearer",
		"expires_in":    "3600",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (suite *IntegrationTestSuite) handleDocuments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var doc Document
		if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		doc.ID = uuid.New().String()
		doc.CreatedAt = time.Now()
		doc.UpdatedAt = time.Now()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(doc)

	case http.MethodGet:
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/documents/")
		if path != "" {
			// Get single document
			doc := &Document{
				ID:        path,
				Title:     "Test Document",
				Content:   "Test content",
				TenantID:  suite.testData.Tenant.ID,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(doc)
		} else {
			// List documents
			docs := []*Document{}
			for _, d := range suite.testData.Documents {
				docs = append(docs, d)
			}
			response := map[string]interface{}{
				"documents": docs,
				"total":     len(docs),
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}

	case http.MethodPut:
		var doc Document
		if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		doc.UpdatedAt = time.Now()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(doc)

	case http.MethodDelete:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (suite *IntegrationTestSuite) handleVectors(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		if strings.Contains(r.URL.Path, "embeddings") {
			// Generate embedding
			request := struct {
				Text  string `json:"text"`
				Model string `json:"model"`
			}{}
			json.NewDecoder(r.Body).Decode(&request)

			embedding := &Embedding{
				Values: make([]float32, 1536),
				Model:  request.Model,
				Usage:  &Usage{TotalTokens: len(request.Text) / 4},
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(embedding)
		} else if strings.Contains(r.URL.Path, "search") {
			// Vector search
			var query VectorQuery
			json.NewDecoder(r.Body).Decode(&query)

			results := []*VectorSearchResult{}
			for i := 0; i < query.TopK; i++ {
				result := &VectorSearchResult{
					DocumentID: uuid.New().String(),
					Score:      0.9 - float32(i)*0.1,
				}
				results = append(results, result)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(results)
		}

	case http.MethodDelete:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (suite *IntegrationTestSuite) handlePolicies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		if strings.Contains(r.URL.Path, "evaluate") {
			// Policy evaluation
			var req PolicyEvaluationRequest
			json.NewDecoder(r.Body).Decode(&req)

			result := &PolicyEvaluationResult{
				Allowed:   true,
				PolicyID:  suite.testData.Policies[0].ID,
				Reason:    "Access granted by policy",
				Timestamp: time.Now(),
			}

			// Apply some logic based on the request
			if req.Action == "delete" && req.Context["role"] != "admin" {
				result.Allowed = false
				result.Reason = "Delete access requires admin role"
			}
			if req.Context["department"] != "engineering" {
				result.Allowed = false
				result.Reason = "Access restricted to engineering department"
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(result)
		} else {
			// Create policy
			var policy Policy
			json.NewDecoder(r.Body).Decode(&policy)
			policy.ID = uuid.New().String()
			policy.CreatedAt = time.Now()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(policy)
		}
	}
}

func (suite *IntegrationTestSuite) handleLLMCompletions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CompletionRequest
	json.NewDecoder(r.Body).Decode(&req)

	if req.Stream {
		// Streaming response
		flusher, _ := w.(http.Flusher)
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		chunks := []string{"This ", "is ", "a ", "streaming ", "response ", "from ", "the ", "LLM."}
		for _, chunk := range chunks {
			data := map[string]interface{}{
				"id":      uuid.New().String(),
				"object":  "chat.completion.chunk",
				"created": time.Now().Unix(),
				"choices": []map[string]interface{}{
					{
						"index": 0,
						"delta": map[string]string{"content": chunk},
					},
				},
			}

			fmt.Fprintf(w, "data: %s\n\n", toJSON(data))
			flusher.Flush()
			time.Sleep(10 * time.Millisecond)
		}

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	} else {
		// Non-streaming response
		response := &CompletionResponse{
			ID:      uuid.New().String(),
			Object:  "chat.completion",
			Created: time.Now().Unix(),
			Model:   req.Model,
			Choices: []Choice{
				{
					Index:        0,
					Message:      Message{Role: "assistant", Content: "This is a test response from the LLM."},
					FinishReason: "stop",
				},
			},
			Usage: &Usage{
				PromptTokens:     20,
				CompletionTokens: 15,
				TotalTokens:      35,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

func (suite *IntegrationTestSuite) handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := &Metrics{
		Requests: map[string]int64{
			"total":   1000,
			"success": 950,
			"error":   50,
		},
		Errors: map[string]int64{
			"validation_error": 20,
			"auth_error":       15,
			"server_error":     15,
		},
		Latency: map[string]time.Duration{
			"p50": 50 * time.Millisecond,
			"p95": 150 * time.Millisecond,
			"p99": 300 * time.Millisecond,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (suite *IntegrationTestSuite) handleHealth(w http.ResponseWriter, r *http.Request) {
	health := &HealthStatus{
		Healthy: true,
		Version: "1.0.0",
		Uptime:  time.Since(time.Now().Add(-1 * time.Hour)),
		Services: map[string]bool{
			"database": true,
			"redis":    true,
			"llm":      true,
			"vector":   true,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func (suite *IntegrationTestSuite) handleTenants(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suite.testData.Tenant)
}

func (suite *IntegrationTestSuite) handleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suite.testData.User)
}

// Helper function
func toJSON(v interface{}) string {
	data, _ := json.Marshal(v)
	return string(data)
}

// TestIntegrationSuiteRunner runs the integration test suite
func TestIntegrationSuiteRunner(t *testing.T) {
	// Skip integration tests if not enabled
	if os.Getenv("SKIP_INTEGRATION_TESTS") == "true" {
		t.Skip("Skipping integration tests")
	}

	suite.Run(t, new(IntegrationTestSuite))
}
