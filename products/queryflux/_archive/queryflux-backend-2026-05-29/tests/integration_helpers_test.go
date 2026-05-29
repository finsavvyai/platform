package tests

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/queryflux/backend/internal/adapter"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/config"
	"github.com/queryflux/backend/pkg/logger"
)

func unwrapData(t *testing.T, body []byte, target interface{}) {
	t.Helper()
	var resp domain.APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("failed to unmarshal APIResponse: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatalf("failed to unmarshal data: %v", err)
	}
}

type mockIntegrationDB struct{}

func (m *mockIntegrationDB) ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error) {
	return &domain.QueryResponse{
		Rows: []map[string]interface{}{
			{"id": 1, "email": "test@example.com", "name": "Test User"},
		},
		ExecutionMs: 2.5,
		SQL:         query,
	}, nil
}

func (m *mockIntegrationDB) GetSchema(ctx context.Context) (*domain.Schema, error) {
	return &domain.Schema{
		Tables: []domain.Table{
			{
				Name: "users",
				Columns: []domain.Column{
					{Name: "id", Type: "integer", Nullable: false, PrimaryKey: true},
					{Name: "email", Type: "varchar", Nullable: false},
					{Name: "name", Type: "varchar", Nullable: true},
				},
			},
		},
	}, nil
}

func (m *mockIntegrationDB) ValidateQuery(ctx context.Context, query string) error {
	return nil
}

func (m *mockIntegrationDB) Close() error              { return nil }
func (m *mockIntegrationDB) Ping(ctx context.Context) error { return nil }

func setupIntegrationServer() *adapter.HTTPServer {
	cfg := &config.Config{
		Port:           "8080",
		Environment:    "test",
		JWTSecret:      "test-secret-integration",
		AllowedOrigins: "http://localhost:5173",
	}

	db := &mockIntegrationDB{}
	log := logger.New("error")

	queryService := service.NewQueryService(db, log)
	schemaService := service.NewSchemaService(db, log)
	jwtService := service.NewJWTService(cfg.JWTSecret)
	authService := service.NewAuthService(nil, jwtService)
	authMiddleware := adapter.NewAuthMiddleware(jwtService)

	return adapter.NewHTTPServer(cfg, queryService, schemaService, authService, authMiddleware, log)
}

func getTestToken() string {
	jwtService := service.NewJWTService("test-secret-integration")
	token, _ := jwtService.GenerateAccessToken("test-user", "test@example.com")
	return token
}
