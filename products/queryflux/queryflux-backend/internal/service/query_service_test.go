package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/pkg/logger"
)

func TestQueryService_Execute_Success(t *testing.T) {
	mockDB := &testMockDB{
		executeQueryFunc: func(ctx context.Context, query string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{
				Rows:        []map[string]interface{}{{"id": 1, "name": "test"}},
				ExecutionMs: 10.5,
				SQL:         query,
			}, nil
		},
	}

	log := logger.New("info")
	svc := NewQueryService(mockDB, log)

	req := domain.QueryRequest{
		DatabaseID: "db-1",
		SQL:        "SELECT * FROM users",
		DryRun:     false,
	}

	result, err := svc.Execute(context.Background(), req)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("Expected result, got nil")
	}
	if len(result.Rows) != 1 {
		t.Errorf("Expected 1 row, got %d", len(result.Rows))
	}
	if result.ExecutionMs != 10.5 {
		t.Errorf("Expected execution time 10.5ms, got %.2f", result.ExecutionMs)
	}
	if result.SQL != req.SQL {
		t.Errorf("Expected SQL %q, got %q", req.SQL, result.SQL)
	}
}

func TestQueryService_Execute_DryRun(t *testing.T) {
	mockDB := &testMockDB{
		validateQueryFunc: func(ctx context.Context, query string) error {
			if query == "INVALID SQL" {
				return errors.New("syntax error")
			}
			return nil
		},
	}

	log := logger.New("info")
	svc := NewQueryService(mockDB, log)

	t.Run("ValidQuery", func(t *testing.T) {
		req := domain.QueryRequest{DatabaseID: "db-1", SQL: "SELECT * FROM users", DryRun: true}
		result, err := svc.Execute(context.Background(), req)

		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if result.Rows != nil {
			t.Error("Expected no rows in dry run mode")
		}
		if result.SQL != req.SQL {
			t.Errorf("Expected SQL %q, got %q", req.SQL, result.SQL)
		}
	})

	t.Run("InvalidQuery", func(t *testing.T) {
		req := domain.QueryRequest{DatabaseID: "db-1", SQL: "INVALID SQL", DryRun: true}
		result, err := svc.Execute(context.Background(), req)

		if err == nil {
			t.Fatal("Expected error, got nil")
		}
		if result.Error == "" {
			t.Error("Expected error message in result")
		}
	})
}

func TestQueryService_Execute_Error(t *testing.T) {
	mockDB := &testMockDB{
		executeQueryFunc: func(ctx context.Context, query string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{SQL: query, Error: "database connection failed"},
				errors.New("database connection failed")
		},
	}

	log := logger.New("info")
	svc := NewQueryService(mockDB, log)

	req := domain.QueryRequest{DatabaseID: "db-1", SQL: "SELECT * FROM users"}
	result, err := svc.Execute(context.Background(), req)

	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	if result.Error == "" {
		t.Error("Expected error message in result")
	}
}

func TestQueryService_Execute_EmptyResult(t *testing.T) {
	mockDB := &testMockDB{
		executeQueryFunc: func(ctx context.Context, query string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{
				Rows: []map[string]interface{}{}, ExecutionMs: 5.0, SQL: query,
			}, nil
		},
	}

	log := logger.New("info")
	svc := NewQueryService(mockDB, log)

	req := domain.QueryRequest{DatabaseID: "db-1", SQL: "SELECT * FROM users WHERE id = 9999"}
	result, err := svc.Execute(context.Background(), req)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(result.Rows) != 0 {
		t.Errorf("Expected 0 rows, got %d", len(result.Rows))
	}
}
