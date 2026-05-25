package plugin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// D1MigrationPlugin validates Cloudflare D1 migration files.
type D1MigrationPlugin struct{}

func (p *D1MigrationPlugin) Name() string { return "d1-migration" }

func (p *D1MigrationPlugin) Run(_ context.Context, dir string) (*Result, error) {
	start := time.Now()
	migDir := filepath.Join(dir, "packages", "db", "migrations")
	entries, err := os.ReadDir(migDir)
	if os.IsNotExist(err) {
		return &Result{Passed: true, Output: "no migrations directory", Duration: time.Since(start)}, nil
	}
	if err != nil {
		return &Result{Passed: false, Output: err.Error(), Duration: time.Since(start)}, nil
	}
	var errs []string
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		if problems := validateMigration(filepath.Join(migDir, e.Name())); len(problems) > 0 {
			errs = append(errs, fmt.Sprintf("%s: %s", e.Name(), strings.Join(problems, "; ")))
		}
	}
	d := time.Since(start)
	if len(errs) > 0 {
		return &Result{Passed: false, Output: strings.Join(errs, "\n"), Duration: d}, nil
	}
	return &Result{Passed: true, Output: fmt.Sprintf("validated %d migrations", len(entries)), Duration: d}, nil
}

func validateMigration(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return []string{err.Error()}
	}
	content := strings.ToUpper(string(data))
	var errs []string
	if strings.Contains(content, "DROP TABLE") && !strings.Contains(content, "IF EXISTS") {
		errs = append(errs, "DROP TABLE without IF EXISTS")
	}
	if strings.Contains(content, "DROP COLUMN") {
		errs = append(errs, "DROP COLUMN is destructive")
	}
	return errs
}
