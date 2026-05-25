package storage

import "fmt"

// createTables creates the necessary database tables
func (ct *SQLxCostTracker) createTables() error {
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
			alert_type VARCHAR(50) NOT NULL,
			threshold DECIMAL(5,2) NOT NULL,
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
