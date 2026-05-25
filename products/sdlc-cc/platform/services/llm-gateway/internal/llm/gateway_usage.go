package llm

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetUsageStats returns current usage for the given tenant and user.
func (g *Gateway) GetUsageStats(ctx context.Context, tenantID, userID string) (*storage.UsageStats, error) {
	return g.costTracker.GetCurrentUsage(ctx, tenantID, userID)
}

// GetCostHistory returns cost records for the given tenant/user and time range.
func (g *Gateway) GetCostHistory(ctx context.Context, tenantID, userID string,
	startTime, endTime time.Time) ([]*models.CostRecord, error) {
	return g.costTracker.GetCostHistory(ctx, tenantID, userID, startTime, endTime)
}
