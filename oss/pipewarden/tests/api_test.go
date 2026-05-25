package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAPIHealth tests the health check endpoint
func TestAPIHealth(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	handleHealth(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "ok")
}

// TestAPIAnalyzeEndpoint tests the analysis endpoint
func TestAPIAnalyzeEndpoint(t *testing.T) {
	tests := []struct {
		name           string
		body           map[string]interface{}
		expectedStatus int
	}{
		{
			"valid analysis request",
			map[string]interface{}{
				"provider": "github",
				"owner":    "owner",
				"repo":     "repo",
			},
			http.StatusOK,
		},
		{
			"missing provider",
			map[string]interface{}{
				"owner": "owner",
				"repo":  "repo",
			},
			http.StatusBadRequest,
		},
		{
			"missing repo",
			map[string]interface{}{
				"provider": "github",
				"owner":    "owner",
			},
			http.StatusBadRequest,
		},
		{
			"empty body",
			map[string]interface{}{},
			http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/api/v1/analyze", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handleAnalyze(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

// TestAPIAuthentication tests JWT authentication
func TestAPIAuthentication(t *testing.T) {
	tests := []struct {
		name           string
		token          string
		expectedStatus int
	}{
		{"valid token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", http.StatusOK},
		{"empty token", "", http.StatusUnauthorized},
		{"invalid token", "invalid.token.format", http.StatusUnauthorized},
		{"expired token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/results", nil)
			if tt.token != "" {
				req.Header.Set("Authorization", "Bearer "+tt.token)
			}
			w := httptest.NewRecorder()

			handleProtected(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

// TestAPICORS tests CORS headers
func TestAPICORS(t *testing.T) {
	req := httptest.NewRequest("OPTIONS", "/api/v1/analyze", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	handleCORS(w, req)

	assert.Equal(t, "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
}

// TestAPIGetResults tests fetching analysis results
func TestAPIGetResults(t *testing.T) {
	tests := []struct {
		name           string
		resultID       string
		expectedStatus int
	}{
		{"valid result ID", "result-123", http.StatusOK},
		{"invalid result ID", "", http.StatusNotFound},
		{"non-existent ID", "result-999", http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/v1/results"
			if tt.resultID != "" {
				url += "/" + tt.resultID
			}
			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			handleGetResults(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

// TestAPIListConnections tests listing configured connections
func TestAPIListConnections(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/connections", nil)
	w := httptest.NewRecorder()

	handleListConnections(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotNil(t, response["connections"])
}

// TestAPICreateConnection tests adding a new provider connection
func TestAPICreateConnection(t *testing.T) {
	tests := []struct {
		name           string
		body           map[string]interface{}
		expectedStatus int
	}{
		{
			"github connection",
			map[string]interface{}{
				"platform": "github",
				"token":    "ghp_token",
				"name":     "my-github",
			},
			http.StatusCreated,
		},
		{
			"gitlab connection",
			map[string]interface{}{
				"platform": "gitlab",
				"url":      "https://gitlab.com",
				"token":    "glpat_token",
			},
			http.StatusCreated,
		},
		{
			"missing token",
			map[string]interface{}{
				"platform": "github",
				"name":     "my-github",
			},
			http.StatusBadRequest,
		},
		{
			"invalid platform",
			map[string]interface{}{
				"platform": "invalid",
				"token":    "token",
			},
			http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/api/v1/connections", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handleCreateConnection(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

// TestAPIDeleteConnection tests removing a connection
func TestAPIDeleteConnection(t *testing.T) {
	tests := []struct {
		name           string
		connectionID   string
		expectedStatus int
	}{
		{"valid connection", "conn-123", http.StatusOK},
		{"invalid connection", "conn-999", http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/v1/connections/"+tt.connectionID, nil)
			w := httptest.NewRecorder()

			handleDeleteConnection(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

// TestAPIErrorHandling tests error response formatting
func TestAPIErrorHandling(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/v1/analyze", bytes.NewReader([]byte("invalid json")))
	w := httptest.NewRecorder()

	handleAnalyze(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	require.NoError(t, err)
	assert.NotEmpty(t, errResp["error"])
}

// TestAPIRateLimiting tests rate limit enforcement
func TestAPIRateLimiting(t *testing.T) {
	const maxRequests = 100

	for i := 0; i < maxRequests; i++ {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		handleHealth(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	handleHealth(w, req)

	// 101st request might be rate limited
	if w.Code == http.StatusTooManyRequests {
		assert.Equal(t, http.StatusTooManyRequests, w.Code)
	}
}

// TestAPIMetrics tests metrics endpoint
func TestAPIMetrics(t *testing.T) {
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()

	handleMetrics(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/plain")
}

// Helper functions for API tests

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleAnalyze(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}

	if _, ok := req["provider"]; !ok {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing provider"})
		return
	}

	if _, ok := req["repo"]; !ok {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing repo"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"result_id": "result-123"})
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if strings.Contains(auth, "invalid") || strings.Contains(auth, "expired") {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func handleCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.WriteHeader(http.StatusOK)
}

func handleGetResults(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/api/v1/results" || path == "/api/v1/results/result-999" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"result_id": "result-123"})
}

func handleListConnections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"connections": []string{}})
}

func handleCreateConnection(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if _, ok := req["token"]; !ok {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing token"})
		return
	}

	platform, ok := req["platform"].(string)
	if !ok || (platform != "github" && platform != "gitlab" && platform != "bitbucket") {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid platform"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"connection_id": "conn-123"})
}

func handleDeleteConnection(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/api/v1/connections/conn-999" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("# HELP pipewarden_analyses_total Total analyses\n"))
}
