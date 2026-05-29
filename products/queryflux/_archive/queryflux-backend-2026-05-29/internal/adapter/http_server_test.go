package adapter

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/stretchr/testify/assert"
)

func testToken() string {
	svc := service.NewJWTService("test-secret-for-testing")
	t, _ := svc.GenerateAccessToken("user-123", "test@example.com")
	return t
}

func TestHealthCheck(t *testing.T) {
	server, _ := setupTestServer()

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var data map[string]interface{}
	unwrapAPIData(t, w.Body.Bytes(), &data)
	assert.Equal(t, "healthy", data["status"])
}

func TestExecuteQuery_Success(t *testing.T) {
	server, db := setupTestServer()
	db.executeQueryFunc = func(query string) (*domain.QueryResponse, error) {
		return &domain.QueryResponse{
			Rows: []map[string]interface{}{{"id": 1}}, ExecutionMs: 5.0, SQL: query,
		}, nil
	}

	body, _ := json.Marshal(domain.QueryRequest{DatabaseID: "db-1", SQL: "SELECT 1"})
	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.QueryResponse
	unwrapAPIData(t, w.Body.Bytes(), &resp)
	assert.Len(t, resp.Rows, 1)
}

func TestExecuteQuery_InvalidJSON(t *testing.T) {
	server, _ := setupTestServer()

	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBufferString("bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExecuteQuery_MissingDatabaseID(t *testing.T) {
	server, _ := setupTestServer()

	body, _ := json.Marshal(map[string]string{"sql": "SELECT 1"})
	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExecuteQuery_ServiceError(t *testing.T) {
	server, db := setupTestServer()
	db.executeQueryFunc = func(_ string) (*domain.QueryResponse, error) {
		return nil, errors.New("execution failed")
	}

	body, _ := json.Marshal(domain.QueryRequest{DatabaseID: "db-1", SQL: "SELECT 1"})
	req, _ := http.NewRequest("POST", "/api/v1/query/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestGetSchema_Success(t *testing.T) {
	server, db := setupTestServer()
	db.getSchemaFunc = func() (*domain.Schema, error) {
		return &domain.Schema{
			Tables: []domain.Table{{Name: "users", Columns: []domain.Column{{Name: "id", Type: "int"}}}},
		}, nil
	}

	body, _ := json.Marshal(domain.SchemaRequest{DatabaseID: "db-1"})
	req, _ := http.NewRequest("POST", "/api/v1/schema", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp domain.Schema
	unwrapAPIData(t, w.Body.Bytes(), &resp)
	assert.Len(t, resp.Tables, 1)
}

func TestGetSchema_InvalidJSON(t *testing.T) {
	server, _ := setupTestServer()

	req, _ := http.NewRequest("POST", "/api/v1/schema", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetSchema_ServiceError(t *testing.T) {
	server, db := setupTestServer()
	db.getSchemaFunc = func() (*domain.Schema, error) {
		return nil, errors.New("schema failed")
	}

	body, _ := json.Marshal(domain.SchemaRequest{DatabaseID: "db-1"})
	req, _ := http.NewRequest("POST", "/api/v1/schema", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testToken())
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestWithOptionFunctions(t *testing.T) {
	server, _ := setupTestServer()
	assert.Nil(t, server.connectionHandler)

	connH := &ConnectionHandler{}
	dbH := &DatabaseHandler{}
	sqH := &SavedQueryHandler{}

	WithConnectionHandler(connH)(server)
	WithDatabaseHandler(dbH)(server)
	WithSavedQueryHandler(sqH)(server)

	assert.Equal(t, connH, server.connectionHandler)
	assert.Equal(t, dbH, server.databaseHandler)
	assert.Equal(t, sqH, server.savedQueryHandler)
}
