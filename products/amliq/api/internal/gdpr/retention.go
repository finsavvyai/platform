package gdpr

import (
	"context"
	"database/sql"
	"fmt"
	"log"
)

// RetentionPolicy defines how long each data category is kept.
type RetentionPolicy struct {
	ScreeningRetention int // days
	AlertRetention     int // days (resolved only)
	AuditRetention     int // days (minimum, never auto-deleted)
}

// DefaultRetentionPolicy returns the default retention periods.
// Audit entries use a 7-year minimum for regulatory compliance.
func DefaultRetentionPolicy() RetentionPolicy {
	return RetentionPolicy{
		ScreeningRetention: 90,
		AlertRetention:     365,
		AuditRetention:     2555, // 7 years
	}
}

// RetentionResult tracks how many records were purged.
type RetentionResult struct {
	ScreeningsDeleted int
	AlertsDeleted     int
	MediaHitsDeleted  int
	BatchesDeleted    int
}

// EnforceRetention deletes records older than the configured retention
// periods. Audit entries are never deleted (regulatory requirement).
func EnforceRetention(
	ctx context.Context, db *sql.DB, policy RetentionPolicy,
) (RetentionResult, error) {
	var result RetentionResult

	n, err := deleteOlderThan(ctx, db, "screenings", policy.ScreeningRetention)
	if err != nil {
		return result, fmt.Errorf("screenings retention: %w", err)
	}
	result.ScreeningsDeleted = n

	n, err = deleteResolvedAlerts(ctx, db, policy.AlertRetention)
	if err != nil {
		return result, fmt.Errorf("alerts retention: %w", err)
	}
	result.AlertsDeleted = n

	n, err = deleteOlderThan(ctx, db, "media_hits", policy.ScreeningRetention)
	if err != nil {
		return result, fmt.Errorf("media_hits retention: %w", err)
	}
	result.MediaHitsDeleted = n

	n, err = deleteOlderThan(ctx, db, "batch_results", policy.ScreeningRetention)
	if err != nil {
		return result, fmt.Errorf("batch_results retention: %w", err)
	}
	result.BatchesDeleted = n

	log.Printf("Retention: deleted %d screenings, %d alerts, %d media hits",
		result.ScreeningsDeleted, result.AlertsDeleted, result.MediaHitsDeleted)
	return result, nil
}

func deleteOlderThan(
	ctx context.Context, db *sql.DB, table string, days int,
) (int, error) {
	query := fmt.Sprintf(
		"DELETE FROM %s WHERE created_at < NOW() - INTERVAL '%d days'",
		table, days,
	)
	res, err := db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return int(affected), nil
}

func deleteResolvedAlerts(
	ctx context.Context, db *sql.DB, days int,
) (int, error) {
	query := fmt.Sprintf(
		"DELETE FROM alerts WHERE status = 'resolved' AND created_at < NOW() - INTERVAL '%d days'",
		days,
	)
	res, err := db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return int(affected), nil
}
