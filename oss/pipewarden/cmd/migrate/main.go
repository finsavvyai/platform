// migrate is a one-shot CLI that opens the configured database and
// runs the PipeWarden schema (storage.Open() applies the dialect-aware
// DDL on connect). Exit 0 = schema present and ready.
//
// Reads PIPEWARDEN_DATABASE_URL from the environment so it can run in
// CI / Cloudflare release pipelines without a config file.
//
// Usage:
//
//	PIPEWARDEN_DATABASE_URL='postgres://...?sslmode=require' \
//	  go run ./cmd/migrate
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// env captures the inputs to a migrate run. Pulled into a struct so the
// run() function below is unit-testable without poking process state.
type env struct {
	URL     string
	Driver  string
	Timeout time.Duration
	OpenFn  func(storage.Config) (*storage.DB, error)
	Out     io.Writer
}

// loadEnv reads the runtime configuration from process env vars.
func loadEnv() env {
	url := os.Getenv("PIPEWARDEN_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	driver := os.Getenv("PIPEWARDEN_DATABASE_DRIVER")
	if driver == "" {
		driver = "postgres"
	}
	return env{
		URL:     url,
		Driver:  driver,
		Timeout: 30 * time.Second,
		OpenFn:  storage.Open,
		Out:     os.Stdout,
	}
}

// run executes the migrate flow with the given env. Returns nil on success,
// an error explaining what went wrong otherwise. Pure function — no os.Exit
// here so tests can drive it directly.
func run(e env) error {
	if e.URL == "" {
		return errors.New("PIPEWARDEN_DATABASE_URL is required")
	}

	cfg := storage.Config{
		Driver:          e.Driver,
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 5 * time.Minute,
	}
	if e.Driver == "postgres" {
		cfg.URL = e.URL
	} else {
		cfg.Path = e.URL
	}

	ctx, cancel := context.WithTimeout(context.Background(), e.Timeout)
	defer cancel()

	type openResult struct {
		db  *storage.DB
		err error
	}
	done := make(chan openResult, 1)
	go func() {
		db, err := e.OpenFn(cfg)
		done <- openResult{db, err}
	}()

	var db *storage.DB
	select {
	case r := <-done:
		if r.err != nil {
			return fmt.Errorf("migrate failed: %w", r.err)
		}
		db = r.db
	case <-ctx.Done():
		return fmt.Errorf("migrate timed out: %w", ctx.Err())
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return fmt.Errorf("post-migrate ping failed: %w", err)
	}
	_ = db.Close()
	_, _ = fmt.Fprintln(e.Out, "migrate ok: schema present, ping succeeded")
	return nil
}

func main() {
	if err := run(loadEnv()); err != nil {
		log.Fatal(err)
	}
}
