package storage

import (
	"context"
	"fmt"
)

// checkBudgetExceeded checks if the budget is exceeded and creates alerts
func (ct *SQLxCostTracker) checkBudgetExceeded(ctx context.Context, tenantID string) error {
	budget, err := ct.GetBudget(ctx, tenantID)
	if err != nil {
		return err
	}
	usagePercentage := (budget.Used / budget.Limit) * 100
	thresholds := []float64{50, 75, 90, 100, 110}
	for _, threshold := range thresholds {
		if usagePercentage >= threshold {
			exists, err := ct.alertExists(ctx, tenantID, threshold)
			if err != nil {
				return err
			}
			if !exists {
				if err := ct.createAlert(ctx, tenantID, threshold); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// alertExists checks if an alert already exists for the given threshold
func (ct *SQLxCostTracker) alertExists(ctx context.Context, tenantID string, threshold float64) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM cost_alerts
			WHERE tenant_id = $1 AND threshold = $2 AND alert_type = 'budget_exceeded'
		)
	`
	var exists bool
	err := ct.db.GetContext(ctx, &exists, query, tenantID, threshold)
	return exists, err
}

// createAlert creates a new cost alert
func (ct *SQLxCostTracker) createAlert(ctx context.Context, tenantID string, threshold float64) error {
	message := fmt.Sprintf("Budget usage has reached %.0f%% for tenant %s", threshold, tenantID)
	query := `
		INSERT INTO cost_alerts (tenant_id, alert_type, threshold, message)
		VALUES ($1, 'budget_exceeded', $2, $3)
	`
	_, err := ct.db.ExecContext(ctx, query, tenantID, threshold, message)
	return err
}
