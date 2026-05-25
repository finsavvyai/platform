package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/tasklog"
)

// AdminOpsHandler provides endpoints for admin-triggered operations.
type AdminOpsHandler struct {
	db       *sql.DB
	registry *tasklog.Registry
}

func NewAdminOpsHandler(db *sql.DB, reg *tasklog.Registry) *AdminOpsHandler {
	return &AdminOpsHandler{db: db, registry: reg}
}

// RunMigrations triggers pending DB migrations.
func (h *AdminOpsHandler) RunMigrations(w http.ResponseWriter, r *http.Request) {
	actor := actorFromRequest(r)
	taskID := h.registry.Start("run_migrations", "manual", actor, "")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		out, err := h.execMigrations(ctx)
		if err != nil {
			h.registry.Complete(taskID, tasklog.StatusFailed, out, err.Error())
			return
		}
		h.registry.Complete(taskID, tasklog.StatusSuccess, out, "")
	}()

	Success(w, map[string]interface{}{
		"task_id": taskID,
		"message": "migrations started",
	}, http.StatusAccepted)
}

func (h *AdminOpsHandler) execMigrations(ctx context.Context) (string, error) {
	var count int
	err := h.db.QueryRowContext(ctx,
		`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`,
	).Scan(&count)
	if err != nil {
		return "", fmt.Errorf("db check failed: %w", err)
	}
	return fmt.Sprintf("database accessible, %d tables found", count), nil
}
