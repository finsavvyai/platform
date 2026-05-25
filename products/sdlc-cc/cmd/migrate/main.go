// Command migrate applies every migrations/*.sql file to DATABASE_URL
// in lexical order. Idempotent: keeps a small bookkeeping table
// (sdlc_migrations) recording which files have already run, so a
// re-run on an up-to-date database is a no-op.
//
// Usage:
//
//	DATABASE_URL=postgres://... migrate -dir ./migrations
//
// Designed to be the entrypoint of a one-shot K8s Job before the
// gateway pod starts. The bookkeeping table itself is created on
// first run, so a fresh database needs nothing pre-seeded.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const bookkeepingDDL = `
CREATE TABLE IF NOT EXISTS sdlc_migrations (
  filename    TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

func main() {
	dir := flag.String("dir", "./migrations", "directory containing *.sql files")
	flag.Parse()

	url := os.Getenv("DATABASE_URL")
	if url == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if _, err := pool.Exec(ctx, bookkeepingDDL); err != nil {
		log.Fatalf("init bookkeeping: %v", err)
	}

	files, err := listSQL(*dir)
	if err != nil {
		log.Fatalf("scan dir: %v", err)
	}
	if len(files) == 0 {
		log.Printf("no migrations found in %s", *dir)
		return
	}

	applied, err := alreadyApplied(ctx, pool)
	if err != nil {
		log.Fatalf("read state: %v", err)
	}

	skipped, ran := 0, 0
	for _, f := range files {
		name := filepath.Base(f)
		if applied[name] {
			skipped++
			continue
		}
		if err := apply(ctx, pool, f, name); err != nil {
			log.Fatalf("%s: %v", name, err)
		}
		ran++
		log.Printf("applied %s", name)
	}
	log.Printf("done — applied=%d skipped=%d", ran, skipped)
}

// listSQL returns every *.sql file in dir, sorted lexically. Filename
// is the contract: 001_*.sql before 002_*.sql, etc. We don't try to
// be clever with version columns — operators name files explicitly.
func listSQL(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		out = append(out, filepath.Join(dir, e.Name()))
	}
	sort.Strings(out)
	return out, nil
}

func alreadyApplied(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, `SELECT filename FROM sdlc_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]bool)
	for rows.Next() {
		var f string
		if err := rows.Scan(&f); err != nil {
			return nil, err
		}
		out[f] = true
	}
	return out, rows.Err()
}

func apply(ctx context.Context, pool *pgxpool.Pool, path, name string) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, string(body)); err != nil {
		return fmt.Errorf("exec: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO sdlc_migrations (filename) VALUES ($1)`, name); err != nil {
		return fmt.Errorf("record: %w", err)
	}
	return tx.Commit(ctx)
}
