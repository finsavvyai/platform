package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// SQLxCostTracker tracks usage and costs for LLM providers using sqlx.
type SQLxCostTracker struct {
	db *sqlx.DB
}

// UsageRecord represents a usage record
type UsageRecord struct {
	ID               int       `db:"id" json:"id"`
	TenantID         string    `db:"tenant_id" json:"tenant_id"`
	UserID           string    `db:"user_id" json:"user_id"`
	Provider         string    `db:"provider" json:"provider"`
	Model            string    `db:"model" json:"model"`
	PromptTokens     int       `db:"prompt_tokens" json:"prompt_tokens"`
	CompletionTokens int       `db:"completion_tokens" json:"completion_tokens"`
	TotalTokens      int       `db:"total_tokens" json:"total_tokens"`
	Cost             float64   `db:"cost" json:"cost"`
	Timestamp        time.Time `db:"timestamp" json:"timestamp"`
}

// Budget represents a tenant's budget
type Budget struct {
	ID        int       `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Limit     float64   `db:"limit" json:"limit"`
	Used      float64   `db:"used" json:"used"`
	Period    string    `db:"period" json:"period"` // monthly, daily, yearly
	StartDate time.Time `db:"start_date" json:"start_date"`
	EndDate   time.Time `db:"end_date" json:"end_date"`
	Active    bool      `db:"active" json:"active"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// UsageSummary represents a summary of usage
type UsageSummary struct {
	TenantID     string  `db:"tenant_id" json:"tenant_id"`
	UserID       string  `db:"user_id" json:"user_id"`
	Provider     string  `db:"provider" json:"provider"`
	Model        string  `db:"model" json:"model"`
	TotalTokens  int     `db:"total_tokens" json:"total_tokens"`
	TotalCost    float64 `db:"total_cost" json:"total_cost"`
	RequestCount int     `db:"request_count" json:"request_count"`
	Period       string  `db:"period" json:"period"`
}

// NewCostTracker creates a new cost tracker instance (SQLx-backed).
func NewCostTracker(databaseURL string) (*SQLxCostTracker, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(300 * time.Second)

	ct := &SQLxCostTracker{
		db: db,
	}

	// Create tables if they don't exist
	if err := ct.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return ct, nil
}

// RecordUsage records a usage record
func (ct *SQLxCostTracker) RecordUsage(ctx context.Context, record *UsageRecord) error {
	query := `
		INSERT INTO usage_records
		(tenant_id, user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := ct.db.ExecContext(ctx, query,
		record.TenantID,
		record.UserID,
		record.Provider,
		record.Model,
		record.PromptTokens,
		record.CompletionTokens,
		record.TotalTokens,
		record.Cost,
		record.Timestamp,
	)

	if err != nil {
		return fmt.Errorf("failed to record usage: %w", err)
	}

	// Update budget usage
	return ct.updateBudgetUsage(ctx, record.TenantID, record.Cost)
}

// GetUsage retrieves usage statistics
func (ct *SQLxCostTracker) GetUsage(ctx context.Context, tenantID, period string) (*UsageSummary, error) {
	query := `
		SELECT
			tenant_id,
			user_id,
			provider,
			model,
			SUM(total_tokens) as total_tokens,
			SUM(cost) as total_cost,
			COUNT(*) as request_count,
			$1 as period
		FROM usage_records
		WHERE tenant_id = $2
			AND timestamp >= $3
		GROUP BY tenant_id, user_id, provider, model
	`

	// Calculate start date based on period
	var startDate time.Time
	now := time.Now()
	switch period {
	case "daily":
		startDate = now.Truncate(24 * time.Hour)
	case "weekly":
		startDate = now.AddDate(0, 0, -7)
	case "monthly":
		startDate = now.Truncate(24*time.Hour).AddDate(0, -1, 0)
	default:
		startDate = now.Truncate(24 * time.Hour)
	}

	var summary UsageSummary
	err := ct.db.GetContext(ctx, &summary, query, period, tenantID, startDate)
	if err != nil {
		if err == sql.ErrNoRows {
			return &UsageSummary{
				TenantID:     tenantID,
				Period:       period,
				TotalTokens:  0,
				TotalCost:    0,
				RequestCount: 0,
			}, nil
		}
		return nil, fmt.Errorf("failed to get usage: %w", err)
	}

	return &summary, nil
}

// GetBudget retrieves the budget for a tenant
func (ct *SQLxCostTracker) GetBudget(ctx context.Context, tenantID string) (*Budget, error) {
	query := `
		SELECT id, tenant_id, limit, used, period, start_date, end_date, active, created_at, updated_at
		FROM budgets
		WHERE tenant_id = $1 AND active = true
	`

	var budget Budget
	err := ct.db.GetContext(ctx, &budget, query, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Create default budget
			return ct.createDefaultBudget(ctx, tenantID)
		}
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	return &budget, nil
}
