//go:build ignore

package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// PostgreSQLCostTracker implements the CostTracker interface
type PostgreSQLCostTracker struct {
	db *sqlx.DB
}

// NewPostgreSQLCostTracker creates a new PostgreSQL cost tracker
func NewPostgreSQLCostTracker(databaseURL string) (*PostgreSQLCostTracker, error) {
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(300 * time.Second)

	tracker := &PostgreSQLCostTracker{
		db: db,
	}

	// Create tables if they don't exist
	if err := tracker.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return tracker, nil
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

	_, err := ct.db.ExecContext(ctx, query,
		cost.ID, cost.TenantID, cost.UserID, cost.Provider, cost.Model,
		cost.PromptTokens, cost.OutputTokens, cost.TotalTokens,
		cost.Cost, cost.Currency, cost.Timestamp, cost.RequestID, cost.Metadata,
	)

	if err != nil {
		return fmt.Errorf("failed to record cost: %w", err)
	}

	// Update budget usage
	return ct.updateBudgetUsage(ctx, cost.TenantID, cost.UserID, cost.Cost)
}

// GetCurrentUsage gets current usage for a tenant/user
func (ct *PostgreSQLCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	stats := &UsageStats{
		TenantID: tenantID,
		UserID:   userID,
	}

	// Daily usage
	dailyQuery := `
		SELECT
			COALESCE(SUM(cost), 0) as daily_spend,
			COALESCE(SUM(total_tokens), 0) as daily_tokens,
			COALESCE(COUNT(*), 0) as requests_count
		FROM cost_records
		WHERE tenant_id = $1 AND user_id = $2
			AND timestamp >= DATE_TRUNC('day', NOW())
	`

	var dailySpend float64
	var dailyTokens, requestCount int
	err := ct.db.QueryRowContext(ctx, dailyQuery, tenantID, userID).Scan(&dailySpend, &dailyTokens, &requestCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get daily usage: %w", err)
	}

	stats.DailySpend = dailySpend
	stats.DailyTokens = dailyTokens
	stats.RequestsCount = requestCount

	// Monthly usage
	monthlyQuery := `
		SELECT
			COALESCE(SUM(cost), 0) as monthly_spend,
			COALESCE(SUM(total_tokens), 0) as monthly_tokens,
			MAX(timestamp) as last_request_time
		FROM cost_records
		WHERE tenant_id = $1 AND user_id = $2
			AND timestamp >= DATE_TRUNC('month', NOW())
	`

	var monthlySpend float64
	var monthlyTokens int
	var lastRequestTime time.Time
	err = ct.db.QueryRowContext(ctx, monthlyQuery, tenantID, userID).Scan(&monthlySpend, &monthlyTokens, &lastRequestTime)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get monthly usage: %w", err)
	}

	stats.MonthlySpend = monthlySpend
	stats.MonthlyTokens = monthlyTokens
	stats.LastRequestTime = lastRequestTime

	return stats, nil
}

// GetCostHistory retrieves cost history
func (ct *PostgreSQLCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string,
	startTime, endTime time.Time) ([]*models.CostRecord, error) {

	query := `
		SELECT id, tenant_id, user_id, provider, model,
			   prompt_tokens, output_tokens, total_tokens, cost, currency,
			   timestamp, request_id, metadata
		FROM cost_records
		WHERE tenant_id = $1
			AND ($2 = '' OR user_id = $2)
			AND timestamp BETWEEN $3 AND $4
		ORDER BY timestamp DESC
		LIMIT 1000
	`

	rows, err := ct.db.QueryxContext(ctx, query, tenantID, userID, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get cost history: %w", err)
	}
	defer rows.Close()

	var records []*models.CostRecord
	for rows.Next() {
		var record models.CostRecord
		err := rows.StructScan(&record)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cost record: %w", err)
		}
		records = append(records, &record)
	}

	return records, nil
}

// GetCostSummary gets a summary of costs
func (ct *PostgreSQLCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string,
	period string) (*CostSummary, error) {

	// Calculate time range based on period
	var startTime time.Time
	now := time.Now()
	switch period {
	case "daily":
		startTime = now.Truncate(24 * time.Hour)
	case "weekly":
		startTime = now.AddDate(0, 0, -7)
	case "monthly":
		startTime = now.Truncate(24*time.Hour).AddDate(0, -1, 0)
	default:
		startTime = now.Truncate(24 * time.Hour)
	}

	summary := &CostSummary{
		Period:         period,
		StartTime:      startTime,
		EndTime:        now,
		CostByProvider: make(map[string]float64),
		CostByModel:    make(map[string]float64),
		CostByUser:     make(map[string]float64),
	}

	// Overall summary
	query := `
		SELECT
			COALESCE(SUM(cost), 0) as total_cost,
			COALESCE(SUM(total_tokens), 0) as total_tokens
		FROM cost_records
		WHERE tenant_id = $1
			AND ($2 = '' OR user_id = $2)
			AND timestamp >= $3
	`

	err := ct.db.QueryRowContext(ctx, query, tenantID, userID, startTime).Scan(&summary.TotalCost, &summary.TotalTokens)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get cost summary: %w", err)
	}

	// Cost by provider
	providerQuery := `
		SELECT provider, COALESCE(SUM(cost), 0) as cost
		FROM cost_records
		WHERE tenant_id = $1
			AND ($2 = '' OR user_id = $2)
			AND timestamp >= $3
		GROUP BY provider
	`

	providerRows, err := ct.db.QueryxContext(ctx, providerQuery, tenantID, userID, startTime)
	if err == nil {
		defer providerRows.Close()
		for providerRows.Next() {
			var provider string
			var cost float64
			if err := providerRows.Scan(&provider, &cost); err == nil {
				summary.CostByProvider[provider] = cost
			}
		}
	}

	// Calculate average cost per token
	if summary.TotalTokens > 0 {
		summary.AverageCostPerToken = summary.TotalCost / float64(summary.TotalTokens)
	}

	return summary, nil
}

// UpdateBudget updates a budget
func (ct *PostgreSQLCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	query := `
		INSERT INTO budgets
		(id, tenant_id, user_id, monthly_limit, daily_limit, alert_threshold,
		 current_spend, currency, period, reset_date, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (tenant_id, COALESCE(user_id, '')) DO UPDATE SET
			monthly_limit = EXCLUDED.monthly_limit,
			daily_limit = EXCLUDED.daily_limit,
			alert_threshold = EXCLUDED.alert_threshold,
			current_spend = EXCLUDED.current_spend,
			currency = EXCLUDED.currency,
			period = EXCLUDED.period,
			reset_date = EXCLUDED.reset_date,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
	`

	_, err := ct.db.ExecContext(ctx, query,
		budget.ID, budget.TenantID, budget.UserID, budget.MonthlyLimit,
		budget.DailyLimit, budget.AlertThreshold, budget.CurrentSpend,
		budget.Currency, budget.Period, budget.ResetDate, budget.IsActive,
	)

	return err
}

// GetBudget gets a budget
func (ct *PostgreSQLCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	query := `
		SELECT id, tenant_id, user_id, monthly_limit, daily_limit, alert_threshold,
			   current_spend, currency, period, reset_date, is_active, created_at, updated_at
		FROM budgets
		WHERE tenant_id = $1 AND user_id = $2 AND is_active = true
	`

	var budget models.Budget
	err := ct.db.QueryRowContext(ctx, query, tenantID, userID).Scan(
		&budget.ID, &budget.TenantID, &budget.UserID, &budget.MonthlyLimit,
		&budget.DailyLimit, &budget.AlertThreshold, &budget.CurrentSpend,
		&budget.Currency, &budget.Period, &budget.ResetDate, &budget.IsActive,
		&budget.CreatedAt, &budget.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default budget if none exists
			defaultBudget := &models.Budget{
				ID:             fmt.Sprintf("budget_%s_%s", tenantID, userID),
				TenantID:       tenantID,
				UserID:         userID,
				MonthlyLimit:   100.0,
				DailyLimit:     10.0,
				AlertThreshold: 80.0,
				CurrentSpend:   0.0,
				Currency:       "USD",
				Period:         "monthly",
				IsActive:       true,
			}

			// Create the default budget
			if err := ct.UpdateBudget(ctx, defaultBudget); err != nil {
				return nil, fmt.Errorf("failed to create default budget: %w", err)
			}

			return defaultBudget, nil
		}
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	return &budget, nil
}

// GetTopSpenders gets top spending users/tenants
func (ct *PostgreSQLCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*SpenderInfo, error) {
	query := `
		SELECT
			user_id,
			SUM(cost) as total_spend,
			SUM(total_tokens) as token_count,
			COUNT(*) as request_count,
			SUM(cost) / NULLIF(COUNT(*), 0) as average_cost
		FROM cost_records
		WHERE tenant_id = $1
			AND timestamp >= DATE_TRUNC('month', NOW())
		GROUP BY user_id
		ORDER BY total_spend DESC
		LIMIT $2
	`

	rows, err := ct.db.QueryxContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top spenders: %w", err)
	}
	defer rows.Close()

	var spenders []*SpenderInfo
	for rows.Next() {
		var spender SpenderInfo
		err := rows.StructScan(&spender)
		if err != nil {
			return nil, fmt.Errorf("failed to scan spender: %w", err)
		}
		spender.TenantID = tenantID
		spenders = append(spenders, &spender)
	}

	return spenders, nil
}

// updateBudgetUsage updates the used amount in a budget
func (ct *PostgreSQLCostTracker) updateBudgetUsage(ctx context.Context, tenantID, userID string, cost float64) error {
	query := `
		UPDATE budgets
		SET current_spend = current_spend + $1, updated_at = NOW()
		WHERE tenant_id = $2 AND (user_id = $3 OR (user_id IS NULL AND $3 = ''))
		AND is_active = true
	`

	_, err := ct.db.ExecContext(ctx, query, cost, tenantID, userID)
	if err != nil {
		return fmt.Errorf("failed to update budget usage: %w", err)
	}

	return nil
}

// Close closes the database connection
func (ct *PostgreSQLCostTracker) Close() error {
	if ct.db != nil {
		return ct.db.Close()
	}
	return nil
}

// MockCostTracker provides a mock implementation for testing
type MockCostTracker struct{}

func NewMockCostTracker() *MockCostTracker {
	return &MockCostTracker{}
}

func (m *MockCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	// Mock implementation - just log
	return nil
}

func (m *MockCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	return &UsageStats{
		TenantID:        tenantID,
		UserID:          userID,
		DailySpend:      5.0,
		MonthlySpend:    50.0,
		DailyTokens:     1000,
		MonthlyTokens:   10000,
		RequestsCount:   25,
		LastRequestTime: time.Now(),
	}, nil
}

func (m *MockCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string, startTime, endTime time.Time) ([]*models.CostRecord, error) {
	return []*models.CostRecord{}, nil
}

func (m *MockCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string, period string) (*CostSummary, error) {
	return &CostSummary{
		Period:              period,
		TotalCost:           50.0,
		TotalTokens:         10000,
		CostByProvider:      map[string]float64{"openai": 30.0, "anthropic": 20.0},
		CostByModel:         map[string]float64{"gpt-4": 30.0, "claude-3": 20.0},
		AverageCostPerToken: 0.005,
	}, nil
}

func (m *MockCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	return nil
}

func (m *MockCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	return &models.Budget{
		ID:             "mock-budget",
		TenantID:       tenantID,
		UserID:         userID,
		MonthlyLimit:   100.0,
		DailyLimit:     10.0,
		AlertThreshold: 80.0,
		CurrentSpend:   5.0,
		Currency:       "USD",
		Period:         "monthly",
		IsActive:       true,
	}, nil
}

func (m *MockCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*SpenderInfo, error) {
	return []*SpenderInfo{}, nil
}
