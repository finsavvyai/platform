package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestVectorService_CreateVector(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		input         *Vector
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful vector creation",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "test-vector-id",
					"namespace":  "test-namespace",
					"values":     []float64{0.1, 0.2, 0.3},
					"metadata":   map[string]interface{}{"test": "metadata"},
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("POST", "/api/v1/vectors", response)
			},
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.1, 0.2, 0.3},
				Metadata:  map[string]interface{}{"test": "metadata"},
			},
			expectedError: false,
		},
		{
			name: "empty vector values",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{},
				Metadata:  map[string]interface{}{"test": "metadata"},
			},
			expectedError: true,
			errorMsg:      "vector values cannot be empty",
		},
		{
			name: "nil vector values",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    nil,
				Metadata:  map[string]interface{}{"test": "metadata"},
			},
			expectedError: true,
			errorMsg:      "vector values cannot be empty",
		},
		{
			name: "invalid vector length",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid vector length",
						"code":    400,
					},
				}
				server.SetResponse("POST", "/api/v1/vectors", errorResp)
			},
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.1},
				Metadata:  map[string]interface{}{"test": "metadata"},
			},
			expectedError: true,
			errorMsg:      "invalid vector length",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.CreateVector(TestContext(), tt.input)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID == "" {
					t.Fatal("Expected vector ID to be set")
				}
				if len(result.Values) == 0 {
					t.Fatal("Expected vector values to be set")
				}
			}
		})
	}
}

func TestVectorService_GetVector(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		vectorID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful get",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "test-vector-id",
					"namespace":  "test-namespace",
					"values":     []float64{0.1, 0.2, 0.3},
					"metadata":   map[string]interface{}{"test": "metadata"},
					"created_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("GET", "/api/v1/vectors/test-vector-id", response)
			},
			vectorID:      "test-vector-id",
			expectedError: false,
		},
		{
			name:          "empty vector ID",
			vectorID:      "",
			expectedError: true,
			errorMsg:      "vector ID cannot be empty",
		},
		{
			name: "vector not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "vector not found",
						"code":    404,
					},
				}
				server.SetResponse("GET", "/api/v1/vectors/nonexistent", errorResp)
			},
			vectorID:      "nonexistent",
			expectedError: true,
			errorMsg:      "vector not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.GetVector(TestContext(), tt.vectorID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.vectorID {
					t.Fatalf("Expected vector ID %q, got %q", tt.vectorID, result.ID)
				}
			}
		})
	}
}

func TestVectorService_UpdateVector(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		vectorID      string
		input         *Vector
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful update",
			setupMock: func() {
				response := map[string]interface{}{
					"id":         "test-vector-id",
					"namespace":  "test-namespace",
					"values":     []float64{0.4, 0.5, 0.6},
					"metadata":   map[string]interface{}{"updated": "metadata"},
					"updated_at": time.Now().Format(time.RFC3339),
				}
				server.SetResponse("PUT", "/api/v1/vectors/test-vector-id", response)
			},
			vectorID: "test-vector-id",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.4, 0.5, 0.6},
				Metadata:  map[string]interface{}{"updated": "metadata"},
			},
			expectedError: false,
		},
		{
			name:          "empty vector ID",
			vectorID:      "",
			input:         GenerateTestVector(),
			expectedError: true,
			errorMsg:      "vector ID cannot be empty",
		},
		{
			name:          "nil input",
			vectorID:      "test-vector-id",
			input:         nil,
			expectedError: true,
			errorMsg:      "vector input cannot be nil",
		},
		{
			name: "conflict error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "vector conflict",
						"code":    409,
					},
				}
				server.SetResponse("PUT", "/api/v1/vectors/conflict-vector", errorResp)
			},
			vectorID:      "conflict-vector",
			input:         GenerateTestVector(),
			expectedError: true,
			errorMsg:      "vector conflict",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.UpdateVector(TestContext(), tt.vectorID, tt.input)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.ID != tt.vectorID {
					t.Fatalf("Expected vector ID %q, got %q", tt.vectorID, result.ID)
				}
			}
		})
	}
}

func TestVectorService_DeleteVector(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		vectorID      string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful deletion",
			setupMock: func() {
				response := map[string]interface{}{
					"success": true,
					"message": "vector deleted",
				}
				server.SetResponse("DELETE", "/api/v1/vectors/test-vector-id", response)
			},
			vectorID:      "test-vector-id",
			expectedError: false,
		},
		{
			name:          "empty vector ID",
			vectorID:      "",
			expectedError: true,
			errorMsg:      "vector ID cannot be empty",
		},
		{
			name: "vector not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "vector not found",
						"code":    404,
					},
				}
				server.SetResponse("DELETE", "/api/v1/vectors/nonexistent", errorResp)
			},
			vectorID:      "nonexistent",
			expectedError: true,
			errorMsg:      "vector not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.Vector.DeleteVector(TestContext(), tt.vectorID)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestVectorService_SearchVectors(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		query         []float64
		params        *SearchParams
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful search",
			setupMock: func() {
				results := []SearchResult{
					{
						VectorID: "vec1",
						Score:    0.95,
						Vector: &Vector{
							ID:        "vec1",
							Namespace: "test-namespace",
							Values:    []float64{0.1, 0.2, 0.3},
						},
					},
					{
						VectorID: "vec2",
						Score:    0.87,
						Vector: &Vector{
							ID:        "vec2",
							Namespace: "test-namespace",
							Values:    []float64{0.4, 0.5, 0.6},
						},
					},
				}
				server.SetResponse("POST", "/api/v1/vectors/search", results)
			},
			query: []float64{0.1, 0.2, 0.3},
			params: &SearchParams{
				Namespace:      "test-namespace",
				TopK:           10,
				ScoreThreshold: 0.5,
			},
			expectedError: false,
		},
		{
			name:          "empty query vector",
			query:         []float64{},
			expectedError: true,
			errorMsg:      "query vector cannot be empty",
		},
		{
			name:          "nil query vector",
			query:         nil,
			expectedError: true,
			errorMsg:      "query vector cannot be empty",
		},
		{
			name: "invalid namespace",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "namespace not found",
						"code":    404,
					},
				}
				server.SetResponse("POST", "/api/v1/vectors/search", errorResp)
			},
			query: []float64{0.1, 0.2, 0.3},
			params: &SearchParams{
				Namespace: "nonexistent-namespace",
				TopK:      10,
			},
			expectedError: true,
			errorMsg:      "namespace not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.SearchVectors(TestContext(), tt.query, tt.params)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if len(result.Results) == 0 {
					t.Fatal("Expected search results")
				}
			}
		})
	}
}

func TestVectorService_ListVectors(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		params        *ListParams
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list",
			setupMock: func() {
				results := VectorListResponse{
					Vectors: []*Vector{
						{
							ID:        "vec1",
							Namespace: "test-namespace",
							Values:    []float64{0.1, 0.2, 0.3},
						},
						{
							ID:        "vec2",
							Namespace: "test-namespace",
							Values:    []float64{0.4, 0.5, 0.6},
						},
					},
					Total: 2,
				}
				server.SetResponse("GET", "/api/v1/vectors", results)
			},
			params: &ListParams{
				Namespace: "test-namespace",
				Limit:     10,
				Offset:    0,
			},
			expectedError: false,
		},
		{
			name: "empty results",
			setupMock: func() {
				results := VectorListResponse{
					Vectors: []*Vector{},
					Total:   0,
				}
				server.SetResponse("GET", "/api/v1/vectors", results)
			},
			params: &ListParams{
				Namespace: "empty-namespace",
				Limit:     10,
			},
			expectedError: false,
		},
		{
			name: "invalid pagination",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "invalid pagination parameters",
						"code":    400,
					},
				}
				server.SetResponse("GET", "/api/v1/vectors", errorResp)
			},
			params: &ListParams{
				Namespace: "test-namespace",
				Limit:     -1,
				Offset:    -1,
			},
			expectedError: true,
			errorMsg:      "invalid pagination parameters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.ListVectors(TestContext(), tt.params)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if result.Total < 0 {
					t.Fatal("Expected non-negative total count")
				}
			}
		})
	}
}

func TestVectorService_BulkCreateVectors(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		vectors       []*Vector
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful bulk create",
			setupMock: func() {
				results := BulkCreateResponse{
					Success: []string{"vec1", "vec2"},
					Failed:  []BulkError{},
				}
				server.SetResponse("POST", "/api/v1/vectors/bulk", results)
			},
			vectors: []*Vector{
				{
					Namespace: "test-namespace",
					Values:    []float64{0.1, 0.2, 0.3},
				},
				{
					Namespace: "test-namespace",
					Values:    []float64{0.4, 0.5, 0.6},
				},
			},
			expectedError: false,
		},
		{
			name:          "empty vectors list",
			vectors:       []*Vector{},
			expectedError: true,
			errorMsg:      "vectors list cannot be empty",
		},
		{
			name:          "nil vectors",
			vectors:       nil,
			expectedError: true,
			errorMsg:      "vectors list cannot be empty",
		},
		{
			name: "partial failure",
			setupMock: func() {
				results := BulkCreateResponse{
					Success: []string{"vec1"},
					Failed: []BulkError{
						{
							Index:   1,
							Message: "invalid vector values",
						},
					},
				}
				server.SetResponse("POST", "/api/v1/vectors/bulk", results)
			},
			vectors: []*Vector{
				{
					Namespace: "test-namespace",
					Values:    []float64{0.1, 0.2, 0.3},
				},
				{
					Namespace: "test-namespace",
					Values:    []float64{}, // Invalid empty vector
				},
			},
			expectedError: false, // Bulk operations don't return error for partial failures
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.BulkCreateVectors(TestContext(), tt.vectors)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
				if len(result.Success)+len(result.Failed) != len(tt.vectors) {
					t.Fatalf("Expected total results to match input count")
				}
			}
		})
	}
}

func TestVectorService_DeleteNamespace(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		namespace     string
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful deletion",
			setupMock: func() {
				response := map[string]interface{}{
					"success": true,
					"deleted": 42,
				}
				server.SetResponse("DELETE", "/api/v1/vectors/namespace/test-namespace", response)
			},
			namespace:     "test-namespace",
			expectedError: false,
		},
		{
			name:          "empty namespace",
			namespace:     "",
			expectedError: true,
			errorMsg:      "namespace cannot be empty",
		},
		{
			name: "namespace not found",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "namespace not found",
						"code":    404,
					},
				}
				server.SetResponse("DELETE", "/api/v1/vectors/namespace/nonexistent", errorResp)
			},
			namespace:     "nonexistent",
			expectedError: true,
			errorMsg:      "namespace not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			err := client.Vector.DeleteNamespace(TestContext(), tt.namespace)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestVectorService_ListNamespaces(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	tests := []struct {
		name          string
		setupMock     func()
		expectedError bool
		errorMsg      string
	}{
		{
			name: "successful list",
			setupMock: func() {
				namespaces := []string{"ns1", "ns2", "ns3"}
				server.SetResponse("GET", "/api/v1/vectors/namespaces", namespaces)
			},
			expectedError: false,
		},
		{
			name: "empty list",
			setupMock: func() {
				namespaces := []string{}
				server.SetResponse("GET", "/api/v1/vectors/namespaces", namespaces)
			},
			expectedError: false,
		},
		{
			name: "server error",
			setupMock: func() {
				errorResp := map[string]interface{}{
					"error": map[string]interface{}{
						"message": "internal server error",
						"code":    500,
					},
				}
				server.SetResponse("GET", "/api/v1/vectors/namespaces", errorResp)
			},
			expectedError: true,
			errorMsg:      "internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMock != nil {
				tt.setupMock()
			}

			result, err := client.Vector.ListNamespaces(TestContext())

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result == nil {
					t.Fatal("Expected non-nil result")
				}
			}
		})
	}
}

func TestVectorService_MathematicalFunctions(t *testing.T) {
	t.Run("CosineSimilarity", func(t *testing.T) {
		v1 := []float64{1.0, 0.0, 0.0}
		v2 := []float64{0.0, 1.0, 0.0}

		similarity := CosineSimilarity(v1, v2)
		expected := 0.0

		if math.Abs(similarity-expected) > 1e-10 {
			t.Fatalf("Expected cosine similarity %f, got %f", expected, similarity)
		}

		// Test identical vectors
		similarity = CosineSimilarity(v1, v1)
		expected = 1.0

		if math.Abs(similarity-expected) > 1e-10 {
			t.Fatalf("Expected cosine similarity %f, got %f", expected, similarity)
		}
	})

	t.Run("EuclideanDistance", func(t *testing.T) {
		v1 := []float64{1.0, 2.0, 3.0}
		v2 := []float64{4.0, 5.0, 6.0}

		distance := EuclideanDistance(v1, v2)
		expected := math.Sqrt(27.0) // sqrt(3^2 + 3^2 + 3^2)

		if math.Abs(distance-expected) > 1e-10 {
			t.Fatalf("Expected euclidean distance %f, got %f", expected, distance)
		}

		// Test identical vectors
		distance = EuclideanDistance(v1, v1)
		expected = 0.0

		if math.Abs(distance-expected) > 1e-10 {
			t.Fatalf("Expected euclidean distance %f, got %f", expected, distance)
		}
	})

	t.Run("DotProduct", func(t *testing.T) {
		v1 := []float64{1.0, 2.0, 3.0}
		v2 := []float64{4.0, 5.0, 6.0}

		product := DotProduct(v1, v2)
		expected := 32.0 // 1*4 + 2*5 + 3*6

		if math.Abs(product-expected) > 1e-10 {
			t.Fatalf("Expected dot product %f, got %f", expected, product)
		}
	})
}

func TestVectorService_ContextCancellation(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel the context immediately
	cancel()

	_, err := client.Vector.GetVector(ctx, "test-id")
	if err == nil {
		t.Fatal("Expected context cancellation error")
	}
	if !strings.Contains(err.Error(), "context canceled") {
		t.Fatalf("Expected context cancellation error, got %v", err)
	}
}

func TestVectorService_HTTPErrorHandling(t *testing.T) {
	client, mockHTTP := CreateTestClient(t)

	tests := []struct {
		name      string
		response  *http.Response
		errorMsg  string
		setupFunc func()
	}{
		{
			name:     "500 internal server error",
			response: CreateTestErrorResponse(500, "internal server error"),
			errorMsg: "internal server error",
		},
		{
			name:     "502 bad gateway",
			response: CreateTestErrorResponse(502, "bad gateway"),
			errorMsg: "bad gateway",
		},
		{
			name:     "503 service unavailable",
			response: CreateTestErrorResponse(503, "service unavailable"),
			errorMsg: "service unavailable",
		},
		{
			name: "network timeout",
			setupFunc: func() {
				mockHTTP.SetError("https://api.test.com/api/v1/vectors/test-id",
					context.DeadlineExceeded)
			},
			errorMsg: "timeout",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupFunc != nil {
				tt.setupFunc()
			} else {
				mockHTTP.SetResponse("https://api.test.com/api/v1/vectors/test-id", tt.response)
			}

			_, err := client.Vector.GetVector(TestContext(), "test-id")

			if err == nil {
				t.Fatal("Expected error but got none")
			}
			if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
				t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
			}
		})
	}
}

func TestVectorService_StreamingSearch(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	response := map[string]interface{}{
		"streaming": true,
		"results": []SearchResult{
			{
				VectorID: "vec1",
				Score:    0.95,
				Vector: &Vector{
					ID:        "vec1",
					Namespace: "test-namespace",
					Values:    []float64{0.1, 0.2, 0.3},
				},
			},
		},
	}
	server.SetResponse("POST", "/api/v1/vectors/stream-search", response)

	ctx := TestContext()
	query := []float64{0.1, 0.2, 0.3}
	params := &SearchParams{
		Namespace: "test-namespace",
		TopK:      10,
	}

	resultChan, err := client.Vector.StreamingSearch(ctx, query, params)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if resultChan == nil {
		t.Fatal("Expected non-nil result channel")
	}

	// Test channel reception
	select {
	case result, ok := <-resultChan:
		if !ok {
			t.Fatal("Channel closed unexpectedly")
		}
		if len(result.Results) == 0 {
			t.Fatal("Expected search results")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Timeout waiting for streaming results")
	}
}

func TestVectorService_Validation(t *testing.T) {
	client, _ := CreateTestClient(t)

	tests := []struct {
		name      string
		input     *Vector
		setupFunc func()
		expectErr bool
		errMsg    string
	}{
		{
			name: "valid vector",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.1, 0.2, 0.3},
				Metadata:  map[string]interface{}{"test": "metadata"},
			},
			expectErr: false,
		},
		{
			name: "empty namespace",
			input: &Vector{
				Namespace: "",
				Values:    []float64{0.1, 0.2, 0.3},
			},
			expectErr: true,
			errMsg:    "namespace cannot be empty",
		},
		{
			name: "invalid vector values",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{},
			},
			expectErr: true,
			errMsg:    "vector values cannot be empty",
		},
		{
			name: "NaN in vector values",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.1, math.NaN(), 0.3},
			},
			expectErr: true,
			errMsg:    "vector values cannot contain NaN",
		},
		{
			name: "Inf in vector values",
			input: &Vector{
				Namespace: "test-namespace",
				Values:    []float64{0.1, math.Inf(1), 0.3},
			},
			expectErr: true,
			errMsg:    "vector values cannot contain Inf",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupFunc != nil {
				tt.setupFunc()
			}

			_, err := client.Vector.CreateVector(TestContext(), tt.input)

			if tt.expectErr {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			}
		})
	}
}

func TestVectorService_JsonSerialization(t *testing.T) {
	vector := &Vector{
		ID:        "test-vector",
		Namespace: "test-namespace",
		Values:    []float64{0.1, 0.2, 0.3},
		Metadata: map[string]interface{}{
			"string": "value",
			"number": 42,
			"bool":   true,
			"array":  []string{"a", "b", "c"},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	data, err := json.Marshal(vector)
	if err != nil {
		t.Fatalf("Failed to marshal vector: %v", err)
	}

	var decoded Vector
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("Failed to unmarshal vector: %v", err)
	}

	if decoded.ID != vector.ID {
		t.Fatalf("Expected ID %q, got %q", vector.ID, decoded.ID)
	}
	if decoded.Namespace != vector.Namespace {
		t.Fatalf("Expected namespace %q, got %q", vector.Namespace, decoded.Namespace)
	}
	if len(decoded.Values) != len(vector.Values) {
		t.Fatalf("Expected %d values, got %d", len(vector.Values), len(decoded.Values))
	}
}

func TestVectorService_ConcurrentOperations(t *testing.T) {
	client, server := CreateTestClientWithServer(t)
	defer server.Close()

	// Setup mock responses
	for i := 0; i < 10; i++ {
		response := map[string]interface{}{
			"id":        fmt.Sprintf("vector-%d", i),
			"namespace": "test-namespace",
			"values":    []float64{float64(i), float64(i + 1), float64(i + 2)},
		}
		server.SetResponse("GET", fmt.Sprintf("/api/v1/vectors/vector-%d", i), response)
	}

	// Test concurrent reads
	const numGoroutines = 10
	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines)
	results := make(chan *Vector, numGoroutines)

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			vector, err := client.Vector.GetVector(TestContext(), fmt.Sprintf("vector-%d", id))
			if err != nil {
				errors <- err
				return
			}
			results <- vector
		}(i)
	}

	wg.Wait()
	close(errors)
	close(results)

	// Check for errors
	for err := range errors {
		t.Errorf("Concurrent operation failed: %v", err)
	}

	// Check results
	resultCount := 0
	for range results {
		resultCount++
	}

	if resultCount != numGoroutines {
		t.Errorf("Expected %d results, got %d", numGoroutines, resultCount)
	}
}
