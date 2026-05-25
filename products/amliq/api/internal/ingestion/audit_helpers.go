package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// NewAuditFrom is the exported wrapper around newAuditFrom, for callers
// outside the ingestion package (e.g. cmd/reingest-global) that need to
// emit ListSyncAudit rows without routing through RefreshService.
func NewAuditFrom(
	tenantID, triggeredBy string, lc domain.ListConfig,
) domain.ListSyncAudit {
	return newAuditFrom(tenantID, triggeredBy, lc)
}

// FinaliseOK stamps a successful outcome onto an in-progress audit.
func FinaliseOK(a *domain.ListSyncAudit, status domain.SyncStatus) {
	finaliseOK(a, status)
}

// FinaliseFail stamps a failure outcome with the error string.
func FinaliseFail(a *domain.ListSyncAudit, err error) {
	finaliseFail(a, err)
}
