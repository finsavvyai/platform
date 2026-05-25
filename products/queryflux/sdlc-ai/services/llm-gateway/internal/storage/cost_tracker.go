//go:build ignore

package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// CostTracker tracks usage and costs for LLM providers
type CostTracker struct {
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

// NewCostTracker creates a new cost tracker instance
func NewCostTracker(databaseURL string) (*CostTracker, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(300 * time.Second)

	ct := &CostTracker{
		db: db,
	}

	// Create tables if they don't exist
	if err := ct.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return ct, nil
}

// createTables creates the necessary database tables
func (ct *CostTracker) createTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS usage_records (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL,
			provider VARCHAR(100) NOT NULL,
			model VARCHAR(100) NOT NULL,
			prompt_tokens INTEGER NOT NULL DEFAULT 0,
			completion_tokens INTEGER NOT NULL DEFAULT 0,
			total_tokens INTEGER NOT NULL DEFAULT 0,
			cost DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
			timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			INDEX idx_usage_tenant (tenant_id),
			INDEX idx_usage_user (user_id),
			INDEX idx_usage_provider (provider),
			INDEX idx_usage_timestamp (timestamp)
		)`,
		`CREATE TABLE IF NOT EXISTS budgets (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(255) UNIQUE NOT NULL,
			limit DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
			used DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
			period VARCHAR(20) NOT NULL DEFAULT 'monthly',
			start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			end_date TIMESTAMP WITH TIME ZONE,
			active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			INDEX idx_budget_tenant (tenant_id),
			INDEX idx_budget_active (active)
		)`,
		`CREATE TABLE IF NOT EXISTS cost_alerts (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(255) NOT NULL,
			alert_type VARCHAR(50) NOT NULL, -- budget_exceeded, usage_spike
			threshold DECIMAL(5,2) NOT NULL, -- percentage
			message TEXT NOT NULL,
			sent BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			INDEX idx_alert_tenant (tenant_id),
			INDEX idx_alert_sent (sent)
		)`,
	}

	for _, schema := range schemas {
		if _, err := ct.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	return nil
}

// RecordUsage records a usage record
func (ct *CostTracker) RecordUsage(ctx context.Context, record *UsageRecord) error {
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
func (ct *CostTracker) GetUsage(ctx context.Context, tenantID, period string) (*UsageSummary, error) {
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
func (ct *CostTracker) GetBudget(ctx context.Context, tenantID string) (*Budget, error) {
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

// createDefaultBudget creates a default budget for a tenant
func (ct *CostTracker) createDefaultBudget(ctx context.Context, tenantID string) (*Budget, error) {
	query := `
		INSERT INTO budgets (tenant_id, limit, period, active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, tenant_id, limit, used, period, start_date, end_date, active, created_at, updated_at
	`

	var budget Budget
	err := ct.db.GetContext(ctx, &budget, query, tenantID, 100.0, "monthly", true)
	if err != nil {
		return nil, fmt.Errorf("failed to create default budget: %w", err)
	}

	return &budget, nil
}

// updateBudgetUsage updates the used amount in a budget
func (ct *CostTracker) updateBudgetUsage(ctx context.Context, tenantID string, cost float64) error {
	query := `
		UPDATE budgets
		SET used = used + $1, updated_at = NOW()
		WHERE tenant_id = $2 AND active = true
	`

	_, err := ct.db.ExecContext(ctx, query, cost, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update budget usage: %w", err)
	}

	// Check if budget is exceeded
	return ct.checkBudgetExceeded(ctx, tenantID)
}

// checkBudgetExceeded checks if the budget is exceeded and creates alerts
func (ct *CostTracker) checkBudgetExceeded(ctx context.Context, tenantID string) error {
	// Get current budget
	budget, err := ct.GetBudget(ctx, tenantID)
	if err != nil {
		return err
	}

	// Calculate usage percentage
	usagePercentage := (budget.Used / budget.Limit) * 100

	// Check thresholds
	thresholds := []float64{50, 75, 90, 100, 110}
	for _, threshold := range thresholds {
		if usagePercentage >= threshold {
			// Check if alert already exists
			exists, err := ct.alertExists(ctx, tenantID, threshold)
			if err != nil {
				return err
			}
			if !exists {
				// Create alert
				if err := ct.createAlert(ctx, tenantID, threshold); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// alertExists checks if an alert already exists for the given threshold
func (ct *CostTracker) alertExists(ctx context.Context, tenantID string, threshold float64) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM cost_alerts
			WHERE tenant_id = $1 AND threshold = $2 AND alert_type = 'budget_exceeded'
		)
	`

	var exists bool
	err := ct.db.GetContext(ctx, &exists, query, tenantID, threshold)
	return exists, err
}

// createAlert creates a new cost alert
func (ct *CostTracker) createAlert(ctx context.Context, tenantID string, threshold float64) error {
	message := fmt.Sprintf("Budget usage has reached %.0f%% for tenant %s", threshold, tenantID)

	query := `
		INSERT INTO cost_alerts (tenant_id, alert_type, threshold, message)
		VALUES ($1, 'budget_exceeded', $2, $3)
	`

	_, err := ct.db.ExecContext(ctx, query, tenantID, threshold, message)
	return err
}

// GetUsageByProvider returns usage statistics grouped by provider
func (ct *CostTracker) GetUsageByProvider(ctx context.Context, tenantID string, startDate, endDate time.Time) ([]UsageSummary, error) {
	query := `
		SELECT
			tenant_id,
			provider,
			SUM(total_tokens) as total_tokens,
			SUM(cost) as total_cost,
			COUNT(*) as request_count,
			'custom' as period
		FROM usage_records
		WHERE tenant_id = $1
			AND timestamp BETWEEN $2 AND $3
		GROUP BY tenant_id, provider
		ORDER BY total_cost DESC
	`

	var summaries []UsageSummary
	err := ct.db.SelectContext(ctx, &summaries, query, tenantID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get usage by provider: %w", err)
	}

	return summaries, nil
}

// GetTopUsers returns the top users by usage
func (ct *CostTracker) GetTopUsers(ctx context.Context, tenantID string, limit int) ([]UsageSummary, error) {
	query := `
		SELECT
			tenant_id,
			user_id,
			SUM(total_tokens) as total_tokens,
			SUM(cost) as total_cost,
			COUNT(*) as request_count,
			'monthly' as period
		FROM usage_records
		WHERE tenant_id = $1
			AND timestamp >= NOW() - INTERVAL '30 days'
		GROUP BY tenant_id, user_id
		ORDER BY total_cost DESC
		LIMIT $2
	`

	var summaries []UsageSummary
	err := ct.db.SelectContext(ctx, &summaries, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top users: %w", err)
	}

	return summaries, nil
}

// Close closes the database connection
func (ct *CostTracker) Close() error {
	if ct.db != nil {
		return ct.db.Close()
	}
	return nil
}
