package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetCostSummary gets a summary of costs
func (p *PostgresCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string,
	period string) (*CostSummary, error) {

	var startTime, endTime time.Time
	now := time.Now()
	switch period {
	case "daily":
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endTime = startTime.Add(24 * time.Hour)
	case "weekly":
		weekday := int(now.Weekday())
		startTime = time.Date(now.Year(), now.Month(), now.Day()-weekday, 0, 0, 0, 0, now.Location())
		endTime = startTime.Add(7 * 24 * time.Hour)
	case "monthly":
		startTime = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endTime = startTime.AddDate(0, 1, 0)
	default:
		return nil, fmt.Errorf("invalid period: %s", period)
	}

	var totals struct {
		Cost       float64
		TokenCount int
	}
	err := p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(total_tokens), 0) as token_count").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?", tenantID, startTime, endTime).
		Scan(&totals).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get total cost: %w", err)
	}
	totalCost, totalTokens := totals.Cost, totals.TokenCount

	var costByProvider []struct {
		Provider string
		Cost     float64
	}
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("provider, COALESCE(SUM(cost), 0) as cost").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?", tenantID, startTime, endTime).
		Group("provider").
		Scan(&costByProvider).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get cost by provider: %w", err)
	}
	providerCostMap := make(map[string]float64)
	for _, cp := range costByProvider {
		providerCostMap[cp.Provider] = cp.Cost
	}

	var costByModel []struct {
		Model string
		Cost  float64
	}
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("model, COALESCE(SUM(cost), 0) as cost").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?", tenantID, startTime, endTime).
		Group("model").
		Scan(&costByModel).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get cost by model: %w", err)
	}
	modelCostMap := make(map[string]float64)
	for _, cm := range costByModel {
		modelCostMap[cm.Model] = cm.Cost
	}

	var peakUsageTime time.Time
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("timestamp").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?", tenantID, startTime, endTime).
		Order("total_tokens DESC").
		Limit(1).
		Scan(&peakUsageTime).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get peak usage time: %w", err)
	}

	avgCostPerToken := float64(0)
	if totalTokens > 0 {
		avgCostPerToken = totalCost / float64(totalTokens)
	}

	return &CostSummary{
		Period:              period,
		StartTime:           startTime,
		EndTime:             endTime,
		TotalCost:           totalCost,
		TotalTokens:         totalTokens,
		CostByProvider:      providerCostMap,
		CostByModel:         modelCostMap,
		CostByUser:          make(map[string]float64),
		AverageCostPerToken: avgCostPerToken,
		PeakUsageTime:       peakUsageTime,
	}, nil
}
