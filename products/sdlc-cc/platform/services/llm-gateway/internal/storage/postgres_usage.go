package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetCurrentUsage gets current usage for a tenant/user
func (p *PostgresCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	now := time.Now()
	dailyStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthlyStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var dailyCost, monthlyCost float64
	var dailyTokens, monthlyTokens int
	var requestCount int64
	var lastRequestTime time.Time

	err := p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?", tenantID, userID, dailyStart).
		Scan(&dailyCost).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get daily cost: %w", err)
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?", tenantID, userID, monthlyStart).
		Scan(&monthlyCost).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get monthly cost: %w", err)
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(total_tokens), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?", tenantID, userID, dailyStart).
		Scan(&dailyTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get daily tokens: %w", err)
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(total_tokens), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?", tenantID, userID, monthlyStart).
		Scan(&monthlyTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get monthly tokens: %w", err)
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?", tenantID, userID, dailyStart).
		Count(&requestCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get request count: %w", err)
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("MAX(timestamp)").
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Scan(&lastRequestTime).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get last request time: %w", err)
	}

	return &UsageStats{
		TenantID:        tenantID,
		UserID:          userID,
		DailySpend:      dailyCost,
		MonthlySpend:    monthlyCost,
		DailyTokens:     dailyTokens,
		MonthlyTokens:   monthlyTokens,
		LastRequestTime: lastRequestTime,
		RequestsCount:   int(requestCount),
	}, nil
}

// GetCostHistory retrieves cost history
func (p *PostgresCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string,
	startTime, endTime time.Time) ([]*models.CostRecord, error) {

	var records []*models.CostRecord
	query := p.db.WithContext(ctx).
		Where("timestamp BETWEEN ? AND ?", startTime, endTime)
	if tenantID != "" {
		query = query.Where("tenant_id = ?", tenantID)
	}
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	err := query.Order("timestamp DESC").Find(&records).Error
	return records, err
}
