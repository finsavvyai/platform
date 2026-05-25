package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetCurrentUsage gets current usage for a tenant/user
func (ct *PostgreSQLCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	dailyQuery := `
		SELECT
			COALESCE(SUM(cost), 0) as daily_spend,
			COALESCE(SUM(total_tokens), 0) as daily_tokens,
			COALESCE(COUNT(*), 0) as requests_count
		FROM cost_records
		WHERE tenant_id = $1 AND user_id = $2
			AND timestamp >= DATE_TRUNC('day', NOW())
	`
	if err := ct.allow(ctx, "GetCurrentUsage", dailyQuery, []interface{}{tenantID, userID}); err != nil {
		return nil, err
	}
	stats := &UsageStats{TenantID: tenantID, UserID: userID}

	var dailySpend float64
	var dailyTokens, requestCount int
	err := ct.db.QueryRowContext(ctx, dailyQuery, tenantID, userID).Scan(&dailySpend, &dailyTokens, &requestCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get daily usage: %w", err)
	}
	stats.DailySpend = dailySpend
	stats.DailyTokens = dailyTokens
	stats.RequestsCount = requestCount

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
	if err := ct.allow(ctx, "GetCostHistory", query, []interface{}{tenantID, userID, startTime, endTime}); err != nil {
		return nil, err
	}
	rows, err := ct.db.QueryxContext(ctx, query, tenantID, userID, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get cost history: %w", err)
	}
	defer rows.Close()

	var records []*models.CostRecord
	for rows.Next() {
		var record models.CostRecord
		if err := rows.StructScan(&record); err != nil {
			return nil, fmt.Errorf("failed to scan cost record: %w", err)
		}
		records = append(records, &record)
	}
	return records, nil
}

// GetCostSummary gets a summary of costs
func (ct *PostgreSQLCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string,
	period string) (*CostSummary, error) {

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

	query := `
		SELECT
			COALESCE(SUM(cost), 0) as total_cost,
			COALESCE(SUM(total_tokens), 0) as total_tokens
		FROM cost_records
		WHERE tenant_id = $1
			AND ($2 = '' OR user_id = $2)
			AND timestamp >= $3
	`
	if err := ct.allow(ctx, "GetCostSummary", query, []interface{}{tenantID, userID, startTime}); err != nil {
		return nil, err
	}
	if err := ct.db.QueryRowContext(ctx, query, tenantID, userID, startTime).Scan(&summary.TotalCost, &summary.TotalTokens); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get cost summary: %w", err)
	}

	providerQuery := `
		SELECT provider, COALESCE(SUM(cost), 0) as cost
		FROM cost_records
		WHERE tenant_id = $1 AND ($2 = '' OR user_id = $2) AND timestamp >= $3
		GROUP BY provider
	`
	providerRows, err := ct.db.QueryxContext(ctx, providerQuery, tenantID, userID, startTime)
	if err == nil {
		defer providerRows.Close()
		for providerRows.Next() {
			var provider string
			var cost float64
			if providerRows.Scan(&provider, &cost) == nil {
				summary.CostByProvider[provider] = cost
			}
		}
	}
	if summary.TotalTokens > 0 {
		summary.AverageCostPerToken = summary.TotalCost / float64(summary.TotalTokens)
	}
	return summary, nil
}
