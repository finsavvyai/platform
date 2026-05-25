package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// auditRepository implements the AuditRepository interface for PostgreSQL
type auditRepository struct {
	db PgxIface
}

// NewAuditRepository creates a new PostgreSQL audit repository
func NewAuditRepository(db PgxIface) repositories.AuditRepository {
	return &auditRepository{db: db}
}

// Log creates a new audit log entry
func (r *auditRepository) Log(ctx context.Context, audit *entities.AuditLog) error {
	query := `
		INSERT INTO audit_logs (id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.db.Exec(ctx, query,
		audit.ID,
		audit.UserID,
		audit.TeamID,
		audit.Action,
		audit.ResourceType,
		audit.ResourceID,
		audit.Details,
		audit.IPAddress,
		audit.UserAgent,
		audit.Success,
		audit.ErrorMessage,
		audit.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	return nil
}

// GetByID retrieves an audit log entry by ID
func (r *auditRepository) GetByID(ctx context.Context, id string) (*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE id = $1
	`

	var audit entities.AuditLog
	err := r.db.QueryRow(ctx, query, id).Scan(
		&audit.ID,
		&audit.UserID,
		&audit.TeamID,
		&audit.Action,
		&audit.ResourceType,
		&audit.ResourceID,
		&audit.Details,
		&audit.IPAddress,
		&audit.UserAgent,
		&audit.Success,
		&audit.ErrorMessage,
		&audit.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("audit log not found")
		}
		return nil, fmt.Errorf("failed to get audit log: %w", err)
	}

	return &audit, nil
}

// Query retrieves audit logs based on filters
func (r *auditRepository) Query(ctx context.Context, filter *entities.AuditLogFilter) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1

	if filter.UserID != nil {
		query += fmt.Sprintf(" AND user_id = $%d", argNum)
		args = append(args, *filter.UserID)
		argNum++
	}

	if filter.TeamID != nil {
		query += fmt.Sprintf(" AND team_id = $%d", argNum)
		args = append(args, *filter.TeamID)
		argNum++
	}

	if filter.Action != nil {
		query += fmt.Sprintf(" AND action = $%d", argNum)
		args = append(args, *filter.Action)
		argNum++
	}

	if filter.ResourceType != nil {
		query += fmt.Sprintf(" AND resource_type = $%d", argNum)
		args = append(args, *filter.ResourceType)
		argNum++
	}

	if filter.ResourceID != nil {
		query += fmt.Sprintf(" AND resource_id = $%d", argNum)
		args = append(args, *filter.ResourceID)
		argNum++
	}

	if filter.StartDate != nil {
		query += fmt.Sprintf(" AND created_at >= $%d", argNum)
		args = append(args, *filter.StartDate)
		argNum++
	}

	if filter.EndDate != nil {
		query += fmt.Sprintf(" AND created_at <= $%d", argNum)
		args = append(args, *filter.EndDate)
		argNum++
	}

	if filter.Success != nil {
		query += fmt.Sprintf(" AND success = $%d", argNum)
		args = append(args, *filter.Success)
		argNum++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetByUser retrieves audit logs for a specific user
func (r *auditRepository) GetByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs by user: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetByResource retrieves audit logs for a specific resource
func (r *auditRepository) GetByResource(ctx context.Context, resourceType, resourceID string, limit, offset int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE resource_type = $1 AND resource_id = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(ctx, query, resourceType, resourceID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs by resource: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetByTeam retrieves audit logs for a team
func (r *auditRepository) GetByTeam(ctx context.Context, teamID string, limit, offset int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE team_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, teamID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs by team: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetByAction retrieves audit logs by action type
func (r *auditRepository) GetByAction(ctx context.Context, action string, limit, offset int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE action = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, action, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs by action: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetFailedActions retrieves failed audit log entries
func (r *auditRepository) GetFailedActions(ctx context.Context, limit, offset int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		WHERE success = false
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get failed audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// GetStats retrieves audit statistics
func (r *auditRepository) GetStats(ctx context.Context, filter *entities.AuditLogFilter) (*entities.AuditLogStats, error) {
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argNum := 1

	if filter.StartDate != nil {
		whereClause += fmt.Sprintf(" AND created_at >= $%d", argNum)
		args = append(args, *filter.StartDate)
		argNum++
	}

	if filter.EndDate != nil {
		whereClause += fmt.Sprintf(" AND created_at <= $%d", argNum)
		args = append(args, *filter.EndDate)
		argNum++
	}

	if filter.TeamID != nil {
		whereClause += fmt.Sprintf(" AND team_id = $%d", argNum)
		args = append(args, *filter.TeamID)
		argNum++
	}

	// Get total actions
	totalQuery := "SELECT COUNT(*) FROM audit_logs " + whereClause
	var totalActions int64
	err := r.db.QueryRow(ctx, totalQuery, args...).Scan(&totalActions)
	if err != nil {
		return nil, fmt.Errorf("failed to get total actions: %w", err)
	}

	// Get actions by type
	actionsByTypeQuery := `
		SELECT action, COUNT(*) as count
		FROM audit_logs
		` + whereClause + `
		GROUP BY action
	`

	rows, err := r.db.Query(ctx, actionsByTypeQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get actions by type: %w", err)
	}
	defer rows.Close()

	actionsByType := make(map[string]int64)
	for rows.Next() {
		var action string
		var count int64
		if err := rows.Scan(&action, &count); err != nil {
			return nil, fmt.Errorf("failed to scan action type: %w", err)
		}
		actionsByType[action] = count
	}

	// Get resources by type
	resourcesByTypeQuery := `
		SELECT resource_type, COUNT(*) as count
		FROM audit_logs
		` + whereClause + `
		GROUP BY resource_type
	`

	rows2, err := r.db.Query(ctx, resourcesByTypeQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get resources by type: %w", err)
	}
	defer rows2.Close()

	resourcesByType := make(map[string]int64)
	for rows2.Next() {
		var resourceType string
		var count int64
		if err := rows2.Scan(&resourceType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan resource type: %w", err)
		}
		resourcesByType[resourceType] = count
	}

	// Get failed actions
	failedQuery := "SELECT COUNT(*) FROM audit_logs " + whereClause + " AND success = false"
	var failedActions int64
	err = r.db.QueryRow(ctx, failedQuery, args...).Scan(&failedActions)
	if err != nil {
		return nil, fmt.Errorf("failed to get failed actions: %w", err)
	}

	return &entities.AuditLogStats{
		TotalActions:    totalActions,
		ActionsByType:   actionsByType,
		ResourcesByType: resourcesByType,
		FailedActions:   failedActions,
	}, nil
}

// GetUserActivitySummary retrieves a summary of user activity
func (r *auditRepository) GetUserActivitySummary(ctx context.Context, userID string, days int) (*repositories.UserActivitySummary, error) {
	startDate := time.Now().AddDate(0, 0, -days)

	// Get total actions
	totalQuery := `
		SELECT COUNT(*) FROM audit_logs
		WHERE user_id = $1 AND created_at >= $2
	`
	var totalActions int64
	err := r.db.QueryRow(ctx, totalQuery, userID, startDate).Scan(&totalActions)
	if err != nil {
		return nil, fmt.Errorf("failed to get total actions: %w", err)
	}

	// Get actions by type
	actionsByTypeQuery := `
		SELECT action, COUNT(*) as count
		FROM audit_logs
		WHERE user_id = $1 AND created_at >= $2
		GROUP BY action
	`

	rows, err := r.db.Query(ctx, actionsByTypeQuery, userID, startDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get actions by type: %w", err)
	}
	defer rows.Close()

	actionsByType := make(map[string]int64)
	for rows.Next() {
		var action string
		var count int64
		if err := rows.Scan(&action, &count); err != nil {
			return nil, fmt.Errorf("failed to scan action type: %w", err)
		}
		actionsByType[action] = count
	}

	// Get resources accessed
	resourcesQuery := `
		SELECT COUNT(DISTINCT resource_type || ':' || resource_id) FROM audit_logs
		WHERE user_id = $1 AND created_at >= $2
	`
	var resourcesAccessed int64
	err = r.db.QueryRow(ctx, resourcesQuery, userID, startDate).Scan(&resourcesAccessed)
	if err != nil {
		return nil, fmt.Errorf("failed to get resources accessed: %w", err)
	}

	// Get failed actions
	failedQuery := `
		SELECT COUNT(*) FROM audit_logs
		WHERE user_id = $1 AND created_at >= $2 AND success = false
	`
	var failedActions int64
	err = r.db.QueryRow(ctx, failedQuery, userID, startDate).Scan(&failedActions)
	if err != nil {
		return nil, fmt.Errorf("failed to get failed actions: %w", err)
	}

	// Get last activity
	lastActivityQuery := `
		SELECT created_at FROM audit_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`
	var lastActivityAt time.Time
	err = r.db.QueryRow(ctx, lastActivityQuery, userID).Scan(&lastActivityAt)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get last activity: %w", err)
	}

	return &repositories.UserActivitySummary{
		UserID:            userID,
		TotalActions:      totalActions,
		ActionsByType:     actionsByType,
		ResourcesAccessed: resourcesAccessed,
		FailedActions:     failedActions,
		LastActivityAt:    lastActivityAt.Format(time.RFC3339),
	}, nil
}

// GetRecentActions retrieves recent audit log entries
func (r *auditRepository) GetRecentActions(ctx context.Context, limit int) ([]*entities.AuditLog, error) {
	query := `
		SELECT id, user_id, team_id, action, resource_type, resource_id, details, ip_address, user_agent, success, error_message, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*entities.AuditLog
	for rows.Next() {
		var audit entities.AuditLog
		err := rows.Scan(
			&audit.ID,
			&audit.UserID,
			&audit.TeamID,
			&audit.Action,
			&audit.ResourceType,
			&audit.ResourceID,
			&audit.Details,
			&audit.IPAddress,
			&audit.UserAgent,
			&audit.Success,
			&audit.ErrorMessage,
			&audit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		logs = append(logs, &audit)
	}

	return logs, nil
}

// Count returns the total number of audit logs matching filters
func (r *auditRepository) Count(ctx context.Context, filter *entities.AuditLogFilter) (int64, error) {
	query := `SELECT COUNT(*) FROM audit_logs WHERE 1=1`
	args := []interface{}{}
	argNum := 1

	if filter.UserID != nil {
		query += fmt.Sprintf(" AND user_id = $%d", argNum)
		args = append(args, *filter.UserID)
		argNum++
	}

	if filter.TeamID != nil {
		query += fmt.Sprintf(" AND team_id = $%d", argNum)
		args = append(args, *filter.TeamID)
		argNum++
	}

	if filter.Action != nil {
		query += fmt.Sprintf(" AND action = $%d", argNum)
		args = append(args, *filter.Action)
		argNum++
	}

	if filter.ResourceType != nil {
		query += fmt.Sprintf(" AND resource_type = $%d", argNum)
		args = append(args, *filter.ResourceType)
		argNum++
	}

	if filter.StartDate != nil {
		query += fmt.Sprintf(" AND created_at >= $%d", argNum)
		args = append(args, *filter.StartDate)
		argNum++
	}

	if filter.EndDate != nil {
		query += fmt.Sprintf(" AND created_at <= $%d", argNum)
		args = append(args, *filter.EndDate)
		argNum++
	}

	if filter.Success != nil {
		query += fmt.Sprintf(" AND success = $%d", argNum)
		args = append(args, *filter.Success)
	}

	var count int64
	err := r.db.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	return count, nil
}

// CleanupOldLogs removes audit logs older than specified days
func (r *auditRepository) CleanupOldLogs(ctx context.Context, olderThanDays int) (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -olderThanDays)
	query := `DELETE FROM audit_logs WHERE created_at < $1`

	result, err := r.db.Exec(ctx, query, cutoffDate)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old audit logs: %w", err)
	}

	return result.RowsAffected(), nil
}

// Export exports audit logs to a format (JSON, CSV)
func (r *auditRepository) Export(ctx context.Context, filter *entities.AuditLogFilter, format string) ([]byte, error) {
	logs, err := r.Query(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs for export: %w", err)
	}

	if format == "json" {
		data, err := json.MarshalIndent(logs, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("failed to marshal logs to JSON: %w", err)
		}
		return data, nil
	}

	// CSV format (simplified)
	csvData := "ID,UserID,TeamID,Action,ResourceType,ResourceID,Success,ErrorMessage,CreatedAt\n"
	for _, log := range logs {
		errorMsg := ""
		if log.ErrorMessage != nil {
			errorMsg = *log.ErrorMessage
		}
		teamID := ""
		if log.TeamID != nil {
			teamID = *log.TeamID
		}
		csvData += fmt.Sprintf("%s,%s,%s,%s,%s,%s,%t,%s,%s\n",
			log.ID, log.UserID, teamID, log.Action, log.ResourceType,
			log.ResourceID, log.Success, errorMsg, log.CreatedAt.Format(time.RFC3339))
	}

	return []byte(csvData), nil
}
