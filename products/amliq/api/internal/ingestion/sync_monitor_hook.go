package ingestion

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ListMonitorHook upserts a list_monitors row after each sync.
type ListMonitorHook struct {
	repo storage.ListMonitorRepository
}

// NewListMonitorHook creates a hook backed by the given repo.
func NewListMonitorHook(repo storage.ListMonitorRepository) *ListMonitorHook {
	return &ListMonitorHook{repo: repo}
}

// AfterSync records a successful sync in list_monitors.
func (h *ListMonitorHook) AfterSync(
	ctx context.Context,
	tenantID domain.TenantID,
	listID string,
	schedule string,
) {
	nextSync := nextSyncFromSchedule(schedule)
	m, err := domain.NewListMonitor(tenantID, listID, nextSync)
	if err != nil {
		log.Printf("list_monitor hook: build: %v", err)
		return
	}
	now := time.Now().UTC()
	m.LastSyncedAt = &now
	m.Status = "synced"
	if err := h.repo.Upsert(ctx, m); err != nil {
		log.Printf("list_monitor hook: upsert %s/%s: %v",
			tenantID, listID, err)
	}
}

// AfterSyncError records a failed sync in list_monitors.
func (h *ListMonitorHook) AfterSyncError(
	ctx context.Context,
	tenantID domain.TenantID,
	listID string,
	schedule string,
	syncErr error,
) {
	nextSync := nextSyncFromSchedule(schedule)
	m, err := domain.NewListMonitor(tenantID, listID, nextSync)
	if err != nil {
		return
	}
	m.Status = "error"
	m.ErrorMessage = syncErr.Error()
	_ = h.repo.Upsert(ctx, m)
}

func nextSyncFromSchedule(schedule string) time.Time {
	next := nextCronRunSafe(schedule, time.Now().UTC())
	if next.IsZero() {
		return time.Now().UTC().Add(24 * time.Hour)
	}
	return next
}
