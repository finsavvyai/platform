package adapter

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/config"
	"github.com/queryflux/backend/pkg/logger"
)

// unwrapAPIData extracts the Data field from an APIResponse and unmarshals it.
func unwrapAPIData(t *testing.T, body []byte, target interface{}) {
	t.Helper()
	var resp domain.APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("failed to unmarshal APIResponse: %v", err)
	}
	data, err := json.Marshal(resp.Data)
	if err != nil {
		t.Fatalf("failed to re-marshal data: %v", err)
	}
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatalf("failed to unmarshal data into target: %v", err)
	}
}

type mockDB struct {
	executeQueryFunc  func(query string) (*domain.QueryResponse, error)
	getSchemaFunc     func() (*domain.Schema, error)
	validateQueryFunc func(query string) error
}

func (m *mockDB) ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error) {
	if m.executeQueryFunc != nil {
		return m.executeQueryFunc(query)
	}
	return &domain.QueryResponse{SQL: query, Rows: []map[string]interface{}{}}, nil
}

func (m *mockDB) GetSchema(ctx context.Context) (*domain.Schema, error) {
	if m.getSchemaFunc != nil {
		return m.getSchemaFunc()
	}
	return &domain.Schema{Tables: []domain.Table{}}, nil
}

func (m *mockDB) ValidateQuery(ctx context.Context, query string) error {
	if m.validateQueryFunc != nil {
		return m.validateQueryFunc(query)
	}
	return nil
}

func (m *mockDB) Close() error                      { return nil }
func (m *mockDB) Ping(ctx context.Context) error     { return nil }

func setupTestServer() (*HTTPServer, *mockDB) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Port:           "8080",
		Environment:    "test",
		JWTSecret:      "test-secret-for-testing",
		AllowedOrigins: "http://localhost:5173",
	}

	db := &mockDB{}
	log := logger.New("error")

	queryService := service.NewQueryService(db, log)
	schemaService := service.NewSchemaService(db, log)
	jwtService := service.NewJWTService(cfg.JWTSecret)
	authService := service.NewAuthService(nil, jwtService)
	authMiddleware := NewAuthMiddleware(jwtService)

	server := NewHTTPServer(cfg, queryService, schemaService, authService, authMiddleware, log)

	return server, db
}
