package llm

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
)

// checkBudget checks if the tenant/user has sufficient budget
func (g *Gateway) checkBudget(ctx context.Context, tenantID, userID string) error {
	usage, err := g.costTracker.GetCurrentUsage(ctx, tenantID, userID)
	if err != nil {
		g.logger.WithError(err).Error("Failed to get current usage")
		return nil
	}

	if g.config.Budgets.DefaultDailyLimit > 0 && usage.DailySpend >= g.config.Budgets.DefaultDailyLimit {
		return fmt.Errorf("daily budget exceeded: %.2f/%.2f %s",
			usage.DailySpend, g.config.Budgets.DefaultDailyLimit, g.config.Budgets.Currency)
	}

	if g.config.Budgets.DefaultMonthlyLimit > 0 && usage.MonthlySpend >= g.config.Budgets.DefaultMonthlyLimit {
		return fmt.Errorf("monthly budget exceeded: %.2f/%.2f %s",
			usage.MonthlySpend, g.config.Budgets.DefaultMonthlyLimit, g.config.Budgets.Currency)
	}

	if g.config.Budgets.AlertThreshold > 0 {
		dailyPercentage := usage.DailySpend / g.config.Budgets.DefaultDailyLimit * 100
		monthlyPercentage := usage.MonthlySpend / g.config.Budgets.DefaultMonthlyLimit * 100
		if dailyPercentage >= g.config.Budgets.AlertThreshold ||
			monthlyPercentage >= g.config.Budgets.AlertThreshold {
			g.logger.WithFields(logrus.Fields{
				"tenant_id":          tenantID,
				"user_id":            userID,
				"daily_percentage":   dailyPercentage,
				"monthly_percentage": monthlyPercentage,
			}).Warn("Budget alert threshold exceeded")
		}
	}

	return nil
}
