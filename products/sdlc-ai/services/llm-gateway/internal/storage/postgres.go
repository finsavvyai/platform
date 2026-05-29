package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"gorm.io/gorm"
)

// PostgresCostTracker implements CostTracker using PostgreSQL
type PostgresCostTracker struct {
	db *gorm.DB
}

// NewPostgresCostTracker creates a new PostgreSQL cost tracker
func NewPostgresCostTracker(db *gorm.DB) *PostgresCostTracker {
	return &PostgresCostTracker{db: db}
}

// RecordCost records a cost transaction
func (p *PostgresCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	return p.db.WithContext(ctx).Create(cost).Error
}

// GetCurrentUsage gets current usage for a tenant/user
func (p *PostgresCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	now := time.Now()

	// Get daily usage
	dailyStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthlyStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var dailyCost, monthlyCost float64
	var dailyTokens, monthlyTokens int
	var requestCount int64
	var lastRequestTime time.Time

	// Daily cost
	err := p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?",
			tenantID, userID, dailyStart).
		Scan(&dailyCost).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get daily cost: %w", err)
	}

	// Monthly cost
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?",
			tenantID, userID, monthlyStart).
		Scan(&monthlyCost).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get monthly cost: %w", err)
	}

	// Daily tokens
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(total_tokens), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?",
			tenantID, userID, dailyStart).
		Scan(&dailyTokens).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get daily tokens: %w", err)
	}

	// Monthly tokens
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(total_tokens), 0)").
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?",
			tenantID, userID, monthlyStart).
		Scan(&monthlyTokens).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get monthly tokens: %w", err)
	}

	// Request count
	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Where("tenant_id = ? AND user_id = ? AND timestamp >= ?",
			tenantID, userID, dailyStart).
		Count(&requestCount).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get request count: %w", err)
	}

	// Last request time
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

	// Total cost and tokens
	var totalCost float64
	var totalTokens int

	err := p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("COALESCE(SUM(cost), 0), COALESCE(SUM(total_tokens), 0)").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?",
			tenantID, startTime, endTime).
		Row().Scan(&totalCost, &totalTokens)

	if err != nil {
		return nil, fmt.Errorf("failed to get total cost: %w", err)
	}

	// Cost by provider
	var costByProvider []struct {
		Provider string
		Cost     float64
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("provider, COALESCE(SUM(cost), 0) as cost").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?",
			tenantID, startTime, endTime).
		Group("provider").
		Scan(&costByProvider).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get cost by provider: %w", err)
	}

	providerCostMap := make(map[string]float64)
	for _, cp := range costByProvider {
		providerCostMap[cp.Provider] = cp.Cost
	}

	// Cost by model
	var costByModel []struct {
		Model string
		Cost  float64
	}

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("model, COALESCE(SUM(cost), 0) as cost").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?",
			tenantID, startTime, endTime).
		Group("model").
		Scan(&costByModel).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get cost by model: %w", err)
	}

	modelCostMap := make(map[string]float64)
	for _, cm := range costByModel {
		modelCostMap[cm.Model] = cm.Cost
	}

	// Peak usage time
	var peakUsageTime time.Time

	err = p.db.WithContext(ctx).
		Model(&models.CostRecord{}).
		Select("timestamp").
		Where("tenant_id = ? AND timestamp BETWEEN ? AND ?",
			tenantID, startTime, endTime).
		Order("total_tokens DESC").
		Limit(1).
		Scan(&peakUsageTime).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get peak usage time: %w", err)
	}

	// Average cost per token
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
		CostByUser:          make(map[string]float64), // TODO: Implement if needed
		AverageCostPerToken: avgCostPerToken,
		PeakUsageTime:       peakUsageTime,
	}, nil
}

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
			// Create default budget
			budget = models.Budget{
				ID:             fmt.Sprintf("budget_%s_%s", tenantID, userID),
				TenantID:       tenantID,
				UserID:         userID,
				MonthlyLimit:   100.0, // Default $100 monthly limit
				DailyLimit:     10.0,  // Default $10 daily limit
				AlertThreshold: 80.0,  // 80% alert threshold
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
		Where("tenant_id = ? AND timestamp >= ?",
			tenantID, time.Now().AddDate(0, -1, 0)). // Last month
		Group("user_id").
		Order("total_spend DESC").
		Limit(limit)

	err := query.Scan(&spenders).Error

	// Calculate average cost for each spender
	for _, spender := range spenders {
		if spender.RequestCount > 0 {
			spender.AverageCost = spender.TotalSpend / float64(spender.RequestCount)
		}
	}

	return spenders, err
}

// PostgresBudgetManager implements BudgetManager using PostgreSQL
type PostgresBudgetManager struct {
	db *gorm.DB
}

// NewPostgresBudgetManager creates a new PostgreSQL budget manager
func NewPostgresBudgetManager(db *gorm.DB) *PostgresBudgetManager {
	return &PostgresBudgetManager{db: db}
}

// CreateBudget creates a new budget
func (p *PostgresBudgetManager) CreateBudget(ctx context.Context, budget *models.Budget) error {
	return p.db.WithContext(ctx).Create(budget).Error
}

// GetBudget retrieves a budget
func (p *PostgresBudgetManager) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	var budget models.Budget

	err := p.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		First(&budget).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	return &budget, nil
}

// UpdateBudget updates an existing budget
func (p *PostgresBudgetManager) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	return p.db.WithContext(ctx).Save(budget).Error
}

// DeleteBudget deletes a budget
func (p *PostgresBudgetManager) DeleteBudget(ctx context.Context, tenantID, userID string) error {
	return p.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Delete(&models.Budget{}).Error
}

// CheckBudget checks if a request is within budget
func (p *PostgresBudgetManager) CheckBudget(ctx context.Context, tenantID, userID string,
	estimatedCost float64) (*BudgetCheckResult, error) {

	budget, err := p.GetBudget(ctx, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	// Get current usage
	tracker := NewPostgresCostTracker(p.db)
	usage, err := tracker.GetCurrentUsage(ctx, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current usage: %w", err)
	}

	result := &BudgetCheckResult{
		Allowed:         true,
		CurrentSpend:    usage.MonthlySpend,
		Limit:           budget.MonthlyLimit,
		Period:          budget.Period,
		ResetTime:       budget.ResetDate,
		RemainingBudget: budget.MonthlyLimit - usage.MonthlySpend,
	}

	// Check if adding the estimated cost would exceed the budget
	if usage.MonthlySpend+estimatedCost > budget.MonthlyLimit {
		result.Allowed = false
		result.Reason = "Monthly budget would be exceeded"
	}

	return result, nil
}

// ListBudgets lists all budgets
func (p *PostgresBudgetManager) ListBudgets(ctx context.Context, tenantID string) ([]*models.Budget, error) {
	var budgets []*models.Budget

	err := p.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Find(&budgets).Error

	return budgets, err
}
