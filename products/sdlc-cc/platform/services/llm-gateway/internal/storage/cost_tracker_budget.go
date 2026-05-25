package storage

import (
	"context"
	"fmt"
)

// createDefaultBudget creates a default budget for a tenant
func (ct *SQLxCostTracker) createDefaultBudget(ctx context.Context, tenantID string) (*Budget, error) {
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
func (ct *SQLxCostTracker) updateBudgetUsage(ctx context.Context, tenantID string, cost float64) error {
	query := `
		UPDATE budgets
		SET used = used + $1, updated_at = NOW()
		WHERE tenant_id = $2 AND active = true
	`
	_, err := ct.db.ExecContext(ctx, query, cost, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update budget usage: %w", err)
	}
	return ct.checkBudgetExceeded(ctx, tenantID)
}
