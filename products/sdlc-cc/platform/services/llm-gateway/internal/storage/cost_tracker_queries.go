package storage

import (
	"context"
	"fmt"
	"time"
)

// GetUsageByProvider returns usage statistics grouped by provider
func (ct *SQLxCostTracker) GetUsageByProvider(ctx context.Context, tenantID string, startDate, endDate time.Time) ([]UsageSummary, error) {
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
func (ct *SQLxCostTracker) GetTopUsers(ctx context.Context, tenantID string, limit int) ([]UsageSummary, error) {
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
func (ct *SQLxCostTracker) Close() error {
	if ct.db != nil {
		return ct.db.Close()
	}
	return nil
}
