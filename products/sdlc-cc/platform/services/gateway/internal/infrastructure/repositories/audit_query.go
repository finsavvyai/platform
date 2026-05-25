// audit_query.go: read-side methods on auditLogRepository — listing,
// filtered search, by-user / by-action / by-resource lookups.
//
// Day 12 split (was audit.go). Construction + the synchronous Create
// path live in audit_repo.go; cleanup, retention, CSV export and the
// per-tenant stats aggregations live in audit_writer.go.
package repositories

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// GetByTenant retrieves audit logs for a tenant with filtering.
func (r *auditLogRepository) GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]*models.AuditLog, error) {
	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIndex := 2

	if filter.UserID != nil {
		whereParts = append(whereParts, fmt.Sprintf("user_id = $%d", argIndex))
		args = append(args, *filter.UserID)
		argIndex++
	}
	if filter.Action != nil {
		whereParts = append(whereParts, fmt.Sprintf("action = $%d", argIndex))
		args = append(args, *filter.Action)
		argIndex++
	}
	if filter.ResourceType != nil {
		whereParts = append(whereParts, fmt.Sprintf("resource_type = $%d", argIndex))
		args = append(args, *filter.ResourceType)
		argIndex++
	}
	if filter.ResourceID != nil {
		whereParts = append(whereParts, fmt.Sprintf("resource_id = $%d", argIndex))
		args = append(args, *filter.ResourceID)
		argIndex++
	}
	if filter.IPAddress != nil {
		whereParts = append(whereParts, fmt.Sprintf("ip_address = $%d", argIndex))
		args = append(args, *filter.IPAddress)
		argIndex++
	}
	if filter.CreatedAfter != nil {
		whereParts = append(whereParts, fmt.Sprintf("created_at >= $%d", argIndex))
		args = append(args, *filter.CreatedAfter)
		argIndex++
	}
	if filter.CreatedBefore != nil {
		whereParts = append(whereParts, fmt.Sprintf("created_at <= $%d", argIndex))
		args = append(args, *filter.CreatedBefore)
		argIndex++
	}

	limit := 100
	if filter.Limit != nil {
		limit = *filter.Limit
	}
	offset := 0
	if filter.Offset != nil {
		offset = *filter.Offset
	}

	query := fmt.Sprintf(`
		SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		       details, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(whereParts, " AND "), argIndex, argIndex+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		r.logger.WithError(err).WithField("tenant_id", tenantID).Error("Failed to query audit logs")
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*models.AuditLog
	for rows.Next() {
		log, err := r.scanAuditLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating audit log rows: %w", err)
	}
	return logs, nil
}

// GetByUser retrieves audit logs for a specific user.
func (r *auditLogRepository) GetByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.AuditLog, error) {
	query := `
		SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		       details, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		r.logger.WithError(err).WithField("user_id", userID).Error("Failed to query user audit logs")
		return nil, fmt.Errorf("failed to query user audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*models.AuditLog
	for rows.Next() {
		log, err := r.scanAuditLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, nil
}

// GetByAction retrieves audit logs by action type.
func (r *auditLogRepository) GetByAction(ctx context.Context, tenantID uuid.UUID, action string, limit, offset int) ([]*models.AuditLog, error) {
	query := `
		SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		       details, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE tenant_id = $1 AND action = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`
	rows, err := r.pool.Query(ctx, query, tenantID, action, limit, offset)
	if err != nil {
		r.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"action":    action,
		}).Error("Failed to query audit logs by action")
		return nil, fmt.Errorf("failed to query audit logs by action: %w", err)
	}
	defer rows.Close()

	var logs []*models.AuditLog
	for rows.Next() {
		log, err := r.scanAuditLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, nil
}

// GetByResource retrieves audit logs for a specific resource.
func (r *auditLogRepository) GetByResource(ctx context.Context, tenantID uuid.UUID, resourceType string, resourceID uuid.UUID) ([]*models.AuditLog, error) {
	query := `
		SELECT id, tenant_id, user_id, action, resource_type, resource_id,
		       details, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
		ORDER BY created_at DESC
		LIMIT 1000
	`
	rows, err := r.pool.Query(ctx, query, tenantID, resourceType, resourceID)
	if err != nil {
		r.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":     tenantID,
			"resource_type": resourceType,
			"resource_id":   resourceID,
		}).Error("Failed to query audit logs by resource")
		return nil, fmt.Errorf("failed to query audit logs by resource: %w", err)
	}
	defer rows.Close()

	var logs []*models.AuditLog
	for rows.Next() {
		log, err := r.scanAuditLog(rows)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}
	return logs, nil
}
