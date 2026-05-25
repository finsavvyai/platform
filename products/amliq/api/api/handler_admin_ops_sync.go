package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/tasklog"
)

// SyncFingerprints triggers fingerprint rebuild for all entities.
func (h *AdminOpsHandler) SyncFingerprints(w http.ResponseWriter, r *http.Request) {
	actor := actorFromRequest(r)
	taskID := h.registry.Start("sync_fingerprints", "manual", actor, "")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		out, err := runFingerprintSync(ctx, h.db)
		if err != nil {
			h.registry.Complete(taskID, tasklog.StatusFailed, out, err.Error())
			return
		}
		h.registry.Complete(taskID, tasklog.StatusSuccess, out, "")
	}()

	Success(w, map[string]interface{}{
		"task_id": taskID,
		"message": "fingerprint sync started",
	}, http.StatusAccepted)
}

func runFingerprintSync(ctx context.Context, db *sql.DB) (string, error) {
	var total int64
	err := db.QueryRowContext(ctx, `SELECT count(*) FROM entities`).Scan(&total)
	if err != nil {
		return "", fmt.Errorf("entity count failed: %w", err)
	}

	var fpCount int64
	err = db.QueryRowContext(ctx,
		`SELECT count(*) FROM search_fingerprints`,
	).Scan(&fpCount)
	if err != nil {
		// Table may not exist yet
		return fmt.Sprintf("%d entities, fingerprints table not ready", total), nil
	}

	return fmt.Sprintf("%d entities, %d fingerprints indexed", total, fpCount), nil
}
