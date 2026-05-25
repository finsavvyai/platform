// Command sdlc-api is the standalone "compliance LLM gateway"
// product (sdlc.cc) sharing the aegis codebase but mounting only
// the AI-gateway routes — no AML / sanctions / case-management
// surface. Same DB schema, same migrations, different SKU.
//
// What this binary serves:
//   POST /v1/messages             — Anthropic-compat drop-in (DLP'd)
//   POST /api/v1/ai/summarize     — fixed-template summarization
//   GET  /api/v1/ai/requests      — observability log (admin)
//   GET  /api/v1/team/ai-cost     — cost rollup (admin)
//   GET  /api/v1/team             — team CRUD
//   POST /api/v1/team/invite      — invite teammate (admin)
//   PUT  /api/v1/team/{id}/role   — change role (admin)
//   DELETE /api/v1/team/{id}      — remove (admin)
//   GET  /sso/{tenant}/login      — SAML auth start
//   POST /sso/{tenant}/acs        — SAML response validation
//   GET  /health, /ready          — ops
//
// What it does NOT serve (compared to cmd/api):
//   /api/v1/screen, /alerts, /lists, /cases, /ubo, /pep, /txn,
//   /vessel, /crypto, /entities, /monitor, /enforcements — all
//   AML-domain routes that belong only to AMLIQ's SKU.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	oauthCfg := config.LoadOAuth()

	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("sdlc-api: pool init: %v", err)
	}
	defer pool.Close()
	db := pool.DB()
	ctx := context.Background()

	migrator := pgx.NewMigrator(db, os.DirFS("."))
	if err := migrator.Up(ctx); err != nil {
		log.Fatalf("sdlc-api: migrations: %v", err)
	}

	deps := initSDLCDeps(db)

	server := api.NewServer(fmt.Sprintf("%s:%d",
		cfg.Server.Host, cfg.Server.Port))
	api.SetupSDLCRoutes(server.GetMux(), deps,
		api.NewAuthChain(cfg.Auth, db, deps), cfg.Auth, oauthCfg)

	log.Printf("sdlc-api: listening on %s:%d (sdlc.cc gateway SKU)",
		cfg.Server.Host, cfg.Server.Port)
	if err := server.Start(); err != nil {
		log.Fatalf("sdlc-api: server: %v", err)
	}
}
