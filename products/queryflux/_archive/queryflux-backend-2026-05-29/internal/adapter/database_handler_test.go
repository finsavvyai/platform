package adapter

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/logger"
	"github.com/stretchr/testify/assert"
)

func setupDBHandlerRouter(db *mockDB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	jwtSvc := service.NewJWTService("test-secret-dbh")
	authMW := NewAuthMiddleware(jwtSvc)
	log := logger.New("error")

	qs := service.NewQueryService(db, log)
	ss := service.NewSchemaService(db, log)
	handler := NewDatabaseHandler(qs, ss)

	api := router.Group("/api/v1")
	api.Use(authMW.Authenticate())
	handler.RegisterRoutes(api)
	return router
}

func dbhToken() string {
	jwtSvc := service.NewJWTService("test-secret-dbh")
	t, _ := jwtSvc.GenerateAccessToken("user-1", "u@test.com")
	return t
}

func TestDatabaseHandler_ExecuteQuery(t *testing.T) {
	db := &mockDB{
		executeQueryFunc: func(query string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{
				Rows:        []map[string]interface{}{{"id": 1}},
				ExecutionMs: 5.0,
				SQL:         query,
			}, nil
		},
	}
	router := setupDBHandlerRouter(db)

	body, _ := json.Marshal(map[string]string{
		"connectionId": "conn-1", "sql": "SELECT 1",
	})
	req, _ := http.NewRequest("POST", "/api/v1/database/query", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var result map[string]interface{}
	unwrapAPIData(t, w.Body.Bytes(), &result)
	assert.Equal(t, float64(1), result["rowCount"])
	assert.Equal(t, float64(5.0), result["executionTime"])
}

func TestDatabaseHandler_ExecuteQuery_BadJSON(t *testing.T) {
	router := setupDBHandlerRouter(&mockDB{})

	req, _ := http.NewRequest("POST", "/api/v1/database/query", bytes.NewBufferString("bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDatabaseHandler_GetSchema(t *testing.T) {
	db := &mockDB{
		getSchemaFunc: func() (*domain.Schema, error) {
			return &domain.Schema{
				Tables: []domain.Table{
					{Name: "users", Columns: []domain.Column{{Name: "id", Type: "int"}}},
				},
			}, nil
		},
	}
	router := setupDBHandlerRouter(db)

	body, _ := json.Marshal(map[string]string{"connectionId": "conn-1"})
	req, _ := http.NewRequest("POST", "/api/v1/database/schema", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var result map[string]interface{}
	unwrapAPIData(t, w.Body.Bytes(), &result)
	databases := result["databases"].([]interface{})
	assert.Len(t, databases, 1)
	db0 := databases[0].(map[string]interface{})
	schemas := db0["schemas"].([]interface{})
	s0 := schemas[0].(map[string]interface{})
	tables := s0["tables"].([]interface{})
	assert.Len(t, tables, 1)
}

func TestDatabaseHandler_GetSchema_BadJSON(t *testing.T) {
	router := setupDBHandlerRouter(&mockDB{})

	req, _ := http.NewRequest("POST", "/api/v1/database/schema", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDatabaseHandler_ExecuteQuery_ServiceError(t *testing.T) {
	db := &mockDB{
		executeQueryFunc: func(query string) (*domain.QueryResponse, error) {
			return nil, errors.New("query failed")
		},
	}
	router := setupDBHandlerRouter(db)

	body, _ := json.Marshal(map[string]string{
		"connectionId": "conn-1", "sql": "SELECT 1",
	})
	req, _ := http.NewRequest("POST", "/api/v1/database/query", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestDatabaseHandler_GetSchema_ServiceError(t *testing.T) {
	db := &mockDB{
		getSchemaFunc: func() (*domain.Schema, error) {
			return nil, errors.New("schema failed")
		},
	}
	router := setupDBHandlerRouter(db)

	body, _ := json.Marshal(map[string]string{"connectionId": "conn-1"})
	req, _ := http.NewRequest("POST", "/api/v1/database/schema", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestDatabaseHandler_TestConnect_BadJSON(t *testing.T) {
	router := setupDBHandlerRouter(&mockDB{})

	req, _ := http.NewRequest("POST", "/api/v1/database/connect", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDatabaseHandler_ExecuteQuery_EmptyRows(t *testing.T) {
	db := &mockDB{
		executeQueryFunc: func(query string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{
				Rows:        []map[string]interface{}{},
				ExecutionMs: 1.0,
				SQL:         query,
			}, nil
		},
	}
	router := setupDBHandlerRouter(db)

	body, _ := json.Marshal(map[string]string{
		"connectionId": "conn-1", "sql": "SELECT 1 WHERE false",
	})
	req, _ := http.NewRequest("POST", "/api/v1/database/query", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dbhToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var result map[string]interface{}
	unwrapAPIData(t, w.Body.Bytes(), &result)
	assert.Equal(t, float64(0), result["rowCount"])
}
