package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/tasklog"
)

// SeedExtra triggers entity metadata enrichment.
func (h *AdminOpsHandler) SeedExtra(w http.ResponseWriter, r *http.Request) {
	actor := actorFromRequest(r)
	taskID := h.registry.Start("seed_extra", "manual", actor, "")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		out, err := runSeedExtra(ctx, h.db)
		if err != nil {
			h.registry.Complete(taskID, tasklog.StatusFailed, out, err.Error())
			return
		}
		h.registry.Complete(taskID, tasklog.StatusSuccess, out, "")
	}()

	Success(w, map[string]interface{}{
		"task_id": taskID,
		"message": "seed started",
	}, http.StatusAccepted)
}

func runSeedExtra(ctx context.Context, db *sql.DB) (string, error) {
	var missing int64
	err := db.QueryRowContext(ctx,
		`SELECT count(*) FROM entities WHERE name_normalized IS NULL OR name_normalized = ''`,
	).Scan(&missing)
	if err != nil {
		return "", fmt.Errorf("count failed: %w", err)
	}
	if missing == 0 {
		return "all entities already have normalized names", nil
	}
	_, err = db.ExecContext(ctx,
		`UPDATE entities SET name_normalized = lower(regexp_replace(full_name, '[^a-zA-Z0-9 ]', '', 'g'))
		 WHERE name_normalized IS NULL OR name_normalized = ''`)
	if err != nil {
		return "", fmt.Errorf("seed update failed: %w", err)
	}
	return fmt.Sprintf("normalized %d entities", missing), nil
}
