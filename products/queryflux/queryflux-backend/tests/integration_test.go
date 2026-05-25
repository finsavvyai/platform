package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/queryflux/backend/internal/domain"
)

func TestIntegration_EndToEnd_SchemaIntrospection(t *testing.T) {
	server := setupIntegrationServer()
	token := getTestToken()

	reqBody := domain.SchemaRequest{DatabaseID: "db-integration-test"}
	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/api/v1/schema", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var response domain.Schema
	unwrapData(t, w.Body.Bytes(), &response)

	if len(response.Tables) != 1 {
		t.Errorf("Expected 1 table, got %d", len(response.Tables))
	}

	if response.Tables[0].Name != "users" {
		t.Errorf("Expected table name 'users', got %q", response.Tables[0].Name)
	}

	if len(response.Tables[0].Columns) != 3 {
		t.Errorf("Expected 3 columns, got %d", len(response.Tables[0].Columns))
	}
}

func TestIntegration_EndToEnd_HealthCheck(t *testing.T) {
	server := setupIntegrationServer()

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var data map[string]interface{}
	unwrapData(t, w.Body.Bytes(), &data)

	if data["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got %v", data["status"])
	}

	if _, ok := data["time"]; !ok {
		t.Error("Expected timestamp in health check response")
	}
}
