// audit_writer.go: maintenance side of the audit repository —
// retention cleanup, CSV export of filtered logs, and the scheduled
// cleanup-function bootstrap.
//
// Day 12 split (was audit.go). The synchronous Create critical-path
// lives in audit_repo.go; per-row reads + stats live in audit_query.go.
//
// Note: the buffered async + critical-path writer for the new audit
// pipeline lives in services/gateway/internal/infrastructure/audit/
// (signer.go + writer.go); this file is the legacy repository's
// retention/export surface, kept compatible with the existing domain
// repositories interface.
package repositories

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// CleanupOldLogs removes audit logs older than the specified number of days.
func (r *auditLogRepository) CleanupOldLogs(ctx context.Context, olderThanDays int) (int, error) {
	query := `
		DELETE FROM audit_logs
		WHERE created_at < NOW() - INTERVAL '1 day' * $1
	`
	result, err := r.pool.Exec(ctx, query, olderThanDays)
	if err != nil {
		r.logger.WithError(err).WithField("days", olderThanDays).Error("Failed to cleanup old audit logs")
		return 0, fmt.Errorf("failed to cleanup old audit logs: %w", err)
	}
	count := int(result.RowsAffected())
	r.logger.WithFields(logrus.Fields{
		"days":  olderThanDays,
		"count": count,
	}).Info("Cleaned up old audit logs")
	return count, nil
}

// ExportAuditLogs exports audit logs in CSV format. Caps export at
// 10000 rows; admin UI calls /admin/audit-logs?format=csv (handled in
// the API layer) for streaming exports.
func (r *auditLogRepository) ExportAuditLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]byte, error) {
	exportFilter := filter
	exportLimit := 10000
	exportFilter.Limit = &exportLimit

	logs, err := r.GetByTenant(ctx, tenantID, exportFilter)
	if err != nil {
		return nil, err
	}

	var output strings.Builder
	writer := csv.NewWriter(&output)
	header := []string{"ID", "TenantID", "UserID", "Action", "ResourceType", "ResourceID", "IPAddress", "UserAgent", "CreatedAt", "Details"}
	if err := writer.Write(header); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}
	for _, log := range logs {
		var userID, resourceID, ipAddr string
		if log.UserID != nil {
			userID = log.UserID.String()
		}
		if log.ResourceID != nil {
			resourceID = log.ResourceID.String()
		}
		if log.IPAddress != nil {
			ipAddr = log.IPAddress.String()
		}
		detailsJSON := "{}"
		if len(log.Details) > 0 {
			if jsonBytes, err := json.Marshal(log.Details); err == nil {
				detailsJSON = string(jsonBytes)
			}
		}
		row := []string{
			log.ID.String(), log.TenantID.String(), userID,
			log.Action, log.ResourceType, resourceID,
			ipAddr, log.UserAgent, log.CreatedAt.Format(time.RFC3339),
			detailsJSON,
		}
		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("CSV error: %w", err)
	}
	return []byte(output.String()), nil
}

// CreateAuditRetentionPolicy installs a scheduled-cleanup function for
// audit logs older than retentionDays. Postgres has no built-in
// retention; pair this with pg_cron or an out-of-band scheduler.
func (r *auditLogRepository) CreateAuditRetentionPolicy(ctx context.Context, retentionDays int) error {
	query := `
		CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
		RETURNS void AS $$
		BEGIN
			DELETE FROM audit_logs
			WHERE created_at < NOW() - INTERVAL '1 day' * $1;
		END;
		$$ LANGUAGE plpgsql;
	`
	_, err := r.pool.Exec(ctx, query, retentionDays)
	if err != nil {
		return fmt.Errorf("failed to create cleanup function: %w", err)
	}
	r.logger.WithField("retention_days", retentionDays).Info("Audit retention function created")
	return nil
}
