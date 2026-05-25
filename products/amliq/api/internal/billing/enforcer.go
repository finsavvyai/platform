package billing

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type Enforcer struct {
	subs  storage.SubscriptionRepository
	usage storage.UsageRepository
}

func NewEnforcer(
	subs storage.SubscriptionRepository,
	usage storage.UsageRepository,
) *Enforcer {
	return &Enforcer{subs: subs, usage: usage}
}

// Quota holds current usage and plan limit for a metric.
type Quota struct {
	Used            int64  `json:"used"`
	Limit           int64  `json:"limit"`
	Remaining       int64  `json:"remaining"`
	PlanName        string `json:"plan_name"`
	HasSubscription bool   `json:"has_subscription"`
}

// GetQuota returns the current usage and plan limit for a metric.
func (e *Enforcer) GetQuota(
	ctx context.Context, tenantID domain.TenantID,
	product domain.Product, metric domain.UsageMetric,
) (Quota, error) {
	sub, err := e.subs.GetByTenantID(ctx, tenantID)
	if err != nil || !sub.IsActive() {
		// Still return actual usage for free tier tracking
		period := currentPeriod()
		rec, _ := e.usage.GetOrCreate(ctx, tenantID, product, period)
		used := int64(0)
		if rec != nil {
			used = rec.Metrics[metric]
		}
		return Quota{Used: used, HasSubscription: false}, nil
	}
	plan, err := GetPlanByID(sub.PlanID)
	if err != nil {
		return Quota{HasSubscription: false}, nil
	}
	period := currentPeriod()
	rec, err := e.usage.GetOrCreate(ctx, tenantID, product, period)
	if err != nil {
		return Quota{HasSubscription: true, PlanName: plan.Name}, err
	}
	limit, ok := plan.GetLimit(metric)
	if !ok {
		return Quota{
			Used: 0, Limit: -1, Remaining: -1,
			PlanName: plan.Name, HasSubscription: true,
		}, nil
	}
	used := rec.Metrics[metric]
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return Quota{
		Used: used, Limit: limit, Remaining: remaining,
		PlanName: plan.Name, HasSubscription: true,
	}, nil
}

// RecordUsage increments the usage counter for a tenant + metric.
// Call after a successful billable action (e.g. a screen returning 2xx)
// so plan limits and quota responses reflect actual consumption.
func (e *Enforcer) RecordUsage(
	ctx context.Context, tenantID domain.TenantID,
	product domain.Product, metric domain.UsageMetric,
) error {
	period := currentPeriod()
	return e.usage.IncrementMetric(ctx, tenantID, product, period, metric, 1)
}

func (e *Enforcer) CheckAllowed(
	ctx context.Context, tenantID domain.TenantID,
	product domain.Product, metric domain.UsageMetric,
) (bool, int64, error) {
	sub, err := e.subs.GetByTenantID(ctx, tenantID)
	if err != nil {
		return false, 0, fmt.Errorf("no subscription: %w", err)
	}
	if !sub.IsActive() {
		return false, 0, fmt.Errorf("subscription not active")
	}

	plan, err := GetPlanByID(sub.PlanID)
	if err != nil {
		return false, 0, err
	}

	period := currentPeriod()
	rec, err := e.usage.GetOrCreate(ctx, tenantID, product, period)
	if err != nil {
		return false, 0, err
	}

	if rec.IsOverLimit(plan, metric) {
		return false, 0, nil
	}

	limit, ok := plan.GetLimit(metric)
	if !ok {
		return true, -1, nil
	}

	usage := rec.Metrics[metric]
	remaining := limit - usage
	if remaining < 0 {
		remaining = 0
	}
	return true, remaining, nil
}
