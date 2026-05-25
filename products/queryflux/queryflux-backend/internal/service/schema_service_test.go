package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/pkg/logger"
)

func TestSchemaService_GetSchema_Success(t *testing.T) {
	expectedSchema := &domain.Schema{
		Tables: []domain.Table{
			{
				Name: "users",
				Columns: []domain.Column{
					{Name: "id", Type: "integer", Nullable: false, PrimaryKey: true},
					{Name: "email", Type: "varchar", Nullable: false, PrimaryKey: false},
				},
				Indexes: []domain.Index{
					{Name: "users_pkey", Columns: []string{"id"}, Unique: true},
				},
			},
		},
	}

	mockDB := &testMockDB{
		getSchemaFunc: func(ctx context.Context) (*domain.Schema, error) {
			return expectedSchema, nil
		},
	}

	log := logger.New("info")
	svc := NewSchemaService(mockDB, log)
	req := domain.SchemaRequest{DatabaseID: "db-1"}

	result, err := svc.GetSchema(context.Background(), req, "")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result == nil {
		t.Fatal("Expected schema, got nil")
	}
	if len(result.Tables) != 1 {
		t.Errorf("Expected 1 table, got %d", len(result.Tables))
	}
	if result.Tables[0].Name != "users" {
		t.Errorf("Expected table name 'users', got %q", result.Tables[0].Name)
	}
	if len(result.Tables[0].Columns) != 2 {
		t.Errorf("Expected 2 columns, got %d", len(result.Tables[0].Columns))
	}
}

func TestSchemaService_GetSchema_Error(t *testing.T) {
	mockDB := &testMockDB{
		getSchemaFunc: func(ctx context.Context) (*domain.Schema, error) {
			return nil, errors.New("database connection failed")
		},
	}

	log := logger.New("info")
	svc := NewSchemaService(mockDB, log)
	req := domain.SchemaRequest{DatabaseID: "db-1"}

	result, err := svc.GetSchema(context.Background(), req, "")

	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	if result != nil {
		t.Errorf("Expected nil result, got %v", result)
	}
}

func TestSchemaService_GetSchema_EmptyDatabase(t *testing.T) {
	mockDB := &testMockDB{
		getSchemaFunc: func(ctx context.Context) (*domain.Schema, error) {
			return &domain.Schema{Tables: []domain.Table{}}, nil
		},
	}

	log := logger.New("info")
	svc := NewSchemaService(mockDB, log)
	req := domain.SchemaRequest{DatabaseID: "db-empty"}

	result, err := svc.GetSchema(context.Background(), req, "")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(result.Tables) != 0 {
		t.Errorf("Expected 0 tables, got %d", len(result.Tables))
	}
}

func TestSchemaService_GetSchema_MultipleTablesWithIndexes(t *testing.T) {
	expectedSchema := &domain.Schema{
		Tables: []domain.Table{
			{
				Name:    "users",
				Columns: []domain.Column{{Name: "id", Type: "integer", Nullable: false, PrimaryKey: true}},
				Indexes: []domain.Index{{Name: "users_pkey", Columns: []string{"id"}, Unique: true}},
			},
			{
				Name: "orders",
				Columns: []domain.Column{
					{Name: "id", Type: "integer", Nullable: false, PrimaryKey: true},
					{Name: "user_id", Type: "integer", Nullable: false, PrimaryKey: false},
				},
				Indexes: []domain.Index{
					{Name: "orders_pkey", Columns: []string{"id"}, Unique: true},
					{Name: "idx_orders_user_id", Columns: []string{"user_id"}, Unique: false},
				},
			},
		},
	}

	mockDB := &testMockDB{
		getSchemaFunc: func(ctx context.Context) (*domain.Schema, error) {
			return expectedSchema, nil
		},
	}

	log := logger.New("info")
	svc := NewSchemaService(mockDB, log)
	req := domain.SchemaRequest{DatabaseID: "db-1"}

	result, err := svc.GetSchema(context.Background(), req, "")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(result.Tables) != 2 {
		t.Errorf("Expected 2 tables, got %d", len(result.Tables))
	}
	ordersTable := result.Tables[1]
	if len(ordersTable.Indexes) != 2 {
		t.Errorf("Expected 2 indexes on orders table, got %d", len(ordersTable.Indexes))
	}
}
