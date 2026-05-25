package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/queryflux/backend/internal/domain"
)

func TestIntegration_EndToEnd_QueryExecution(t *testing.T) {
	server := setupIntegrationServer()
	token := getTestToken()

	reqBody := domain.QueryRequest{
		DatabaseID: "db-integration-test",
		SQL:        "SELECT * FROM users WHERE id = 1",
		DryRun:     false,
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response domain.QueryResponse
	unwrapData(t, w.Body.Bytes(), &response)

	if len(response.Rows) != 1 {
		t.Errorf("Expected 1 row, got %d", len(response.Rows))
	}

	if response.ExecutionMs <= 0 {
		t.Errorf("Expected positive execution time, got %f", response.ExecutionMs)
	}

	if response.SQL != reqBody.SQL {
		t.Errorf("Expected SQL %q, got %q", reqBody.SQL, response.SQL)
	}
}

func TestIntegration_EndToEnd_DryRunQuery(t *testing.T) {
	server := setupIntegrationServer()
	token := getTestToken()

	reqBody := domain.QueryRequest{
		DatabaseID: "db-integration-test",
		SQL:        "SELECT * FROM users",
		DryRun:     true,
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var response domain.QueryResponse
	unwrapData(t, w.Body.Bytes(), &response)

	if response.Rows != nil {
		t.Error("Expected nil rows for dry run query")
	}

	if response.SQL != reqBody.SQL {
		t.Errorf("Expected SQL %q, got %q", reqBody.SQL, response.SQL)
	}
}
