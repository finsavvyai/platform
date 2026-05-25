package main

import (
	"database/sql"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/storage"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// initSDLCDeps wires only the dependencies the gateway product
// needs. Skips the AML-specific repositories (entities, alerts,
// screenings, lists, cases, monitors, etc.) so the binary is leaner
// and the dependency surface smaller. The shared substrate (audit,
// users, tenants, seats, billing, ai_request_log) stays.
func initSDLCDeps(db *sql.DB) *api.Dependencies {
	return &api.Dependencies{
		DB:           db,
		Tenants:      pgx.NewTenantRepository(db),
		Users:        pgx.NewUserRepository(db),
		Seats:        pgx.NewSeatRepository(db),
		Audit:        pgx.NewAuditRepository(db),
		AIRequestLog: storage.NewInMemoryAIRequestLogRepo(),
		// AMLIQ-only repos left zero-valued — the gateway routes
		// don't reach into them. setupSDLCRoutes asserts only the
		// pieces it needs are present and 500s if a repo is nil.
	}
}
