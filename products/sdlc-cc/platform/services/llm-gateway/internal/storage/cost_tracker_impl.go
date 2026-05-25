package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// PostgreSQLCostTracker implements the CostTracker interface
type PostgreSQLCostTracker struct {
	db   *sqlx.DB
	gate QueryGate
}

// NewPostgreSQLCostTracker creates a new PostgreSQL cost tracker (no query gate).
func NewPostgreSQLCostTracker(databaseURL string) (*PostgreSQLCostTracker, error) {
	return NewPostgreSQLCostTrackerWithGate(databaseURL, NoopGate{})
}

// NewPostgreSQLCostTrackerWithGate creates a cost tracker with an optional query gate.
// The gate is invoked before each DB operation; if it returns an error, the query is not run.
func NewPostgreSQLCostTrackerWithGate(databaseURL string, gate QueryGate) (*PostgreSQLCostTracker, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(300 * time.Second)

	tracker := &PostgreSQLCostTracker{db: db, gate: gate}
	if err := tracker.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}
	return tracker, nil
}

func (ct *PostgreSQLCostTracker) allow(ctx context.Context, op, query string, args []interface{}) error {
	if ct.gate == nil {
		return nil
	}
	return ct.gate.AllowQuery(ctx, op, query, args)
}

// createTables creates the necessary database tables
func (ct *PostgreSQLCostTracker) createTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS cost_records (
			id VARCHAR(255) PRIMARY KEY,
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL,
			provider VARCHAR(100) NOT NULL,
			model VARCHAR(100) NOT NULL,
			prompt_tokens INTEGER NOT NULL DEFAULT 0,
			output_tokens INTEGER NOT NULL DEFAULT 0,
			total_tokens INTEGER NOT NULL DEFAULT 0,
			cost DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			request_id VARCHAR(255),
			metadata TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS budgets (
			id VARCHAR(255) PRIMARY KEY,
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255),
			monthly_limit DECIMAL(12,4) NOT NULL DEFAULT 100.0000,
			daily_limit DECIMAL(12,4) NOT NULL DEFAULT 10.0000,
			alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.00,
			current_spend DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			period VARCHAR(20) NOT NULL DEFAULT 'monthly',
			reset_date TIMESTAMP WITH TIME ZONE,
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(tenant_id, COALESCE(user_id, ''))
		)`,
	}

	// Create indexes
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_cost_records_tenant ON cost_records(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_cost_records_user ON cost_records(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_cost_records_timestamp ON cost_records(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON budgets(tenant_id)`,
	}

	for _, schema := range schemas {
		if _, err := ct.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	for _, index := range indexes {
		if _, err := ct.db.Exec(index); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

// RecordCost records a cost transaction
func (ct *PostgreSQLCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	query := `
		INSERT INTO cost_records
		(id, tenant_id, user_id, provider, model, prompt_tokens, output_tokens, total_tokens, cost, currency, timestamp, request_id, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	args := []interface{}{
		cost.ID, cost.TenantID, cost.UserID, cost.Provider, cost.Model,
		cost.PromptTokens, cost.OutputTokens, cost.TotalTokens,
		cost.Cost, cost.Currency, cost.Timestamp, cost.RequestID, cost.Metadata,
	}
	if err := ct.allow(ctx, "RecordCost", query, args); err != nil {
		return err
	}
	_, err := ct.db.ExecContext(ctx, query, args...)

	if err != nil {
		return fmt.Errorf("failed to record cost: %w", err)
	}

	// Update budget usage
	return ct.updateBudgetUsage(ctx, cost.TenantID, cost.UserID, cost.Cost)
}

// Close closes the database connection
func (ct *PostgreSQLCostTracker) Close() error {
	if ct.db != nil {
		return ct.db.Close()
	}
	return nil
}
