package pgx

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// ScreeningArchiver manages screening data retention.
type ScreeningArchiver struct {
	db *sql.DB
}

func NewScreeningArchiver(db *sql.DB) *ScreeningArchiver {
	return &ScreeningArchiver{db: db}
}

// ArchiveOld marks screenings older than retention period as archived.
// Archived screenings are still queryable but excluded from dashboards.
func (a *ScreeningArchiver) ArchiveOld(
	ctx context.Context, retention time.Duration,
) (int64, error) {
	cutoff := time.Now().Add(-retention)
	result, err := a.db.ExecContext(ctx, `
		UPDATE screenings
		SET archived = TRUE
		WHERE created_at < $1 AND archived = FALSE
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// PurgeArchived permanently deletes archived screenings older than limit.
// Call only after confirming data has been exported/backed up.
func (a *ScreeningArchiver) PurgeArchived(
	ctx context.Context, olderThan time.Duration,
) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result, err := a.db.ExecContext(ctx, `
		DELETE FROM screenings
		WHERE archived = TRUE AND created_at < $1
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// Stats returns archival statistics.
func (a *ScreeningArchiver) Stats(ctx context.Context) (ArchiveStats, error) {
	var s ArchiveStats
	err := a.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE NOT archived) as active,
			COUNT(*) FILTER (WHERE archived) as archived,
			COUNT(*) as total,
			MIN(created_at) as oldest
		FROM screenings
	`).Scan(&s.Active, &s.Archived, &s.Total, &s.Oldest)
	return s, err
}

// ArchiveStats holds screening archive metrics.
type ArchiveStats struct {
	Active   int64        `json:"active"`
	Archived int64        `json:"archived"`
	Total    int64        `json:"total"`
	Oldest   sql.NullTime `json:"oldest"`
}

// RunRetentionCycle archives old + purges expired on a schedule.
func RunRetentionCycle(
	ctx context.Context,
	archiver *ScreeningArchiver,
	archiveAfter, purgeAfter time.Duration,
) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	log.Printf("retention: archive after %v, purge after %v",
		archiveAfter, purgeAfter)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			archived, err := archiver.ArchiveOld(ctx, archiveAfter)
			if err != nil {
				log.Printf("retention archive error: %v", err)
			} else if archived > 0 {
				log.Printf("retention: archived %d screenings", archived)
			}

			purged, err := archiver.PurgeArchived(ctx, purgeAfter)
			if err != nil {
				log.Printf("retention purge error: %v", err)
			} else if purged > 0 {
				log.Printf("retention: purged %d old screenings", purged)
			}
		}
	}
}
