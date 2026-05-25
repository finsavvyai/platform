package storage

import (
	"context"
	"fmt"

	"github.com/SDLC/llm-gateway/pkg/models"
	"gorm.io/gorm"
)

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
