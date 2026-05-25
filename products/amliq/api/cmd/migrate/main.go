// Command migrate applies every pending SQL file in ./migrations
// against the Postgres pointed at by $DATABASE_URL. Idempotent —
// already-applied versions (tracked in migrations_applied) are
// skipped. Intended to be run from the Render shell when you want
// to force schema up-to-date without waiting for an API boot.
package main

import (
	"context"
	"log"
	"os"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

func main() {
	cfg := config.Load()
	if cfg.Database.URL == "" {
		log.Fatal("migrate: DATABASE_URL is required")
	}

	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("migrate: pool init: %v", err)
	}
	defer pool.Close()

	migrator := pgx.NewMigrator(pool.DB(), os.DirFS("."))
	if err := migrator.Up(context.Background()); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("migrate: schema up-to-date")
}
