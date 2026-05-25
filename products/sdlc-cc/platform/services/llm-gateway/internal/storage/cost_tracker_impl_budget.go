package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/SDLC/llm-gateway/pkg/models"
)

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
	args := []interface{}{
		budget.ID, budget.TenantID, budget.UserID, budget.MonthlyLimit,
		budget.DailyLimit, budget.AlertThreshold, budget.CurrentSpend,
		budget.Currency, budget.Period, budget.ResetDate, budget.IsActive,
	}
	if err := ct.allow(ctx, "UpdateBudget", query, args); err != nil {
		return err
	}
	_, err := ct.db.ExecContext(ctx, query, args...)
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
	if err := ct.allow(ctx, "GetBudget", query, []interface{}{tenantID, userID}); err != nil {
		return nil, err
	}
	var budget models.Budget
	err := ct.db.QueryRowContext(ctx, query, tenantID, userID).Scan(
		&budget.ID, &budget.TenantID, &budget.UserID, &budget.MonthlyLimit,
		&budget.DailyLimit, &budget.AlertThreshold, &budget.CurrentSpend,
		&budget.Currency, &budget.Period, &budget.ResetDate, &budget.IsActive,
		&budget.CreatedAt, &budget.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
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
	if err := ct.allow(ctx, "GetTopSpenders", query, []interface{}{tenantID, limit}); err != nil {
		return nil, err
	}
	rows, err := ct.db.QueryxContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top spenders: %w", err)
	}
	defer rows.Close()

	var spenders []*SpenderInfo
	for rows.Next() {
		var s SpenderInfo
		if err := rows.Scan(&s.UserID, &s.TotalSpend, &s.TokenCount, &s.RequestCount, &s.AverageCost); err != nil {
			return nil, err
		}
		s.TenantID = tenantID
		spenders = append(spenders, &s)
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
