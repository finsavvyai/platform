package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"gorm.io/gorm"
)

// UpdateBudget updates a budget
func (p *PostgresCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	return p.db.WithContext(ctx).Save(budget).Error
}

// GetBudget gets a budget
func (p *PostgresCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	var budget models.Budget
	err := p.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		First(&budget).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			budget = models.Budget{
				ID:             fmt.Sprintf("budget_%s_%s", tenantID, userID),
				TenantID:       tenantID,
				UserID:         userID,
				MonthlyLimit:   100.0,
				DailyLimit:     10.0,
				AlertThreshold: 80.0,
				Currency:       "USD",
				Period:         "monthly",
				IsActive:       true,
			}
			if err := p.db.WithContext(ctx).Create(&budget).Error; err != nil {
				return nil, fmt.Errorf("failed to create default budget: %w", err)
			}
			return &budget, nil
		}
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}
	return &budget, nil
}

// GetTopSpenders gets top spending users/tenants
func (p *PostgresCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*SpenderInfo, error) {
	var spenders []*SpenderInfo
	query := p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("user_id, COALESCE(SUM(cost), 0) as total_spend, COALESCE(SUM(total_tokens), 0) as token_count, COUNT(*) as request_count").
		Where("tenant_id = ? AND timestamp >= ?", tenantID, time.Now().AddDate(0, -1, 0)).
		Group("user_id").
		Order("total_spend DESC").
		Limit(limit)
	err := query.Scan(&spenders).Error
	if err != nil {
		return spenders, err
	}
	for _, spender := range spenders {
		if spender.RequestCount > 0 {
			spender.AverageCost = spender.TotalSpend / float64(spender.RequestCount)
		}
	}
	return spenders, nil
}
