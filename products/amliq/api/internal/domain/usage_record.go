package domain

import (
	"fmt"
	"time"
)

type UsageRecord struct {
	ID            string
	TenantID      string
	Product       Product
	Period        string
	Metrics       map[UsageMetric]int64
	LastUpdatedAt time.Time
}

func NewUsageRecord(tenantID string, product Product, period string) (UsageRecord, error) {
	if tenantID == "" || !product.IsValid() || period == "" {
		return UsageRecord{}, fmt.Errorf("tenant_id, product, and period required")
	}
	return UsageRecord{
		ID:            fmt.Sprintf("usage_%d", time.Now().UnixNano()),
		TenantID:      tenantID,
		Product:       product,
		Period:        period,
		Metrics:       make(map[UsageMetric]int64),
		LastUpdatedAt: time.Now().UTC(),
	}, nil
}

func (u UsageRecord) IsOverLimit(plan Plan, metric UsageMetric) bool {
	limit, ok := plan.GetLimit(metric)
	if !ok {
		return false
	}
	usage, ok := u.Metrics[metric]
	if !ok {
		return false
	}
	return usage > limit
}

func (u UsageRecord) UsagePercent(plan Plan, metric UsageMetric) float64 {
	limit, ok := plan.GetLimit(metric)
	if !ok || limit == 0 {
		return 0.0
	}
	usage, ok := u.Metrics[metric]
	if !ok {
		return 0.0
	}
	percent := float64(usage) / float64(limit) * 100.0
	if percent > 100.0 {
		return 100.0
	}
	return percent
}

func (u *UsageRecord) RecordUsage(metric UsageMetric, count int64) {
	if u.Metrics == nil {
		u.Metrics = make(map[UsageMetric]int64)
	}
	u.Metrics[metric] += count
	u.LastUpdatedAt = time.Now().UTC()
}

func (u UsageRecord) String() string {
	return fmt.Sprintf("Usage(%s, product=%s, period=%s)", u.TenantID, u.Product, u.Period)
}
