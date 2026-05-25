package pgx

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanListMeta(row *sql.Row) (*domain.ListSyncMeta, error) {
	var (
		tenantIDStr string
		listID      string
		etag        string
		entityCount int
		syncedAt    time.Time
	)

	err := row.Scan(&tenantIDStr, &listID, &etag, &entityCount, &syncedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan list meta: %w", err)
	}

	tenantID, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		return nil, fmt.Errorf("parse tenant id: %w", err)
	}

	return &domain.ListSyncMeta{
		TenantID:    tenantID,
		ListID:      listID,
		ETag:        etag,
		EntityCount: entityCount,
		SyncedAt:    syncedAt,
	}, nil
}
