// Package repositories: audit_repo.go holds the audit-log type +
// constructor, the synchronous critical-path Create call, the row
// scanner shared by every read method, and the table bootstrap helper
// CreateAuditLogsTable.
//
// Day 12 split (was audit.go, 597 LOC). The peer files are:
//   - audit_query.go  — read methods (GetBy*, GetAuditStats)
//   - audit_writer.go — cleanup + CSV export + retention helpers
//
// Behaviour is unchanged from the pre-split file; this is a pure
// refactor to keep each file under the 200-LOC cap.
package repositories

import (
	"context"
	"fmt"
	"net"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	domainrepo "github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// auditLogRepository implements the AuditLogRepository interface.
type auditLogRepository struct {
	pool   *pgxpool.Pool
	logger *logrus.Logger
}

// NewAuditLogRepository creates a new audit log repository.
func NewAuditLogRepository(pool *pgxpool.Pool) domainrepo.AuditLogRepository {
	return &auditLogRepository{
		pool:   pool,
		logger: logrus.New(),
	}
}

// Create creates a new audit log entry. Sync, fail-closed: callers are
// expected to surface the error so the user-facing action stops.
func (r *auditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	query := `
		INSERT INTO audit_logs (
			id, tenant_id, user_id, action, resource_type, resource_id,
			details, ip_address, user_agent, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		)
	`

	var ipAddrStr string
	if log.IPAddress != nil {
		ipAddrStr = log.IPAddress.String()
	}

	_, err := r.pool.Exec(ctx, query,
		log.ID, log.TenantID, log.UserID, log.Action, log.ResourceType,
		log.ResourceID, log.Details, ipAddrStr, log.UserAgent, log.CreatedAt,
	)

	if err != nil {
		r.logger.WithError(err).WithField("audit_id", log.ID).Error("Failed to create audit log")
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	return nil
}

// scanAuditLog scans a row into an AuditLog struct. Shared by every
// read method in audit_query.go.
func (r *auditLogRepository) scanAuditLog(row pgx.CollectableRow) (*models.AuditLog, error) {
	var log models.AuditLog
	var ipAddrStr string

	err := row.Scan(
		&log.ID,
		&log.TenantID,
		&log.UserID,
		&log.Action,
		&log.ResourceType,
		&log.ResourceID,
		&log.Details,
		&ipAddrStr,
		&log.UserAgent,
		&log.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to scan audit log row: %w", err)
	}

	// Parse IP address.
	if ipAddrStr != "" {
		log.IPAddress = net.ParseIP(ipAddrStr)
	}

	return &log, nil
}

// CreateAuditLogsTable creates the audit_logs table if it doesn't
// exist. Used by the test harness; production runs migration 009 which
// supersedes this with HMAC-signed, append-only enforcement.
func (r *auditLogRepository) CreateAuditLogsTable(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS audit_logs (
			id UUID PRIMARY KEY,
			tenant_id UUID NOT NULL,
			user_id UUID,
			action VARCHAR(255) NOT NULL,
			resource_type VARCHAR(100) NOT NULL,
			resource_id UUID,
			details JSONB,
			ip_address INET,
			user_agent TEXT,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);

		-- Create indexes for common queries
		CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);

		-- Create partial index for failed authentication attempts (security monitoring)
		CREATE INDEX IF NOT EXISTS idx_audit_logs_failed_auth
			ON audit_logs(tenant_id, created_at DESC)
			WHERE action LIKE '%login.failed';

		-- Create partial index for authorization denials
		CREATE INDEX IF NOT EXISTS idx_audit_logs_denials
			ON audit_logs(tenant_id, created_at DESC)
			WHERE action LIKE '%deny';
	`

	_, err := r.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create audit_logs table: %w", err)
	}

	r.logger.Info("Audit logs table created/verified")
	return nil
}
