package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
)

// configurePool applies pool sizing from conn.Options. Defaults: max-open=25,
// max-idle=10, lifetime=1h. Settings are cached on a.poolSettings for ops
// tooling.
func (a *MariaDBEnhancedAdapter) configurePool(db *sql.DB, conn *entities.Connection) error {
	maxOpen := 25
	if v := conn.Options["max_open_conns"]; v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxOpen = n
		}
	}
	db.SetMaxOpenConns(maxOpen)

	maxIdle := 10
	if v := conn.Options["max_idle_conns"]; v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxIdle = n
		}
	}
	db.SetMaxIdleConns(maxIdle)

	lifetime := time.Hour
	if v := conn.Options["conn_max_lifetime"]; v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			lifetime = d
		}
	}
	db.SetConnMaxLifetime(lifetime)

	a.poolSettings = map[string]string{
		"max_open_conns":    strconv.Itoa(maxOpen),
		"max_idle_conns":    strconv.Itoa(maxIdle),
		"conn_max_lifetime": lifetime.String(),
	}
	return nil
}

// verifyMariaDB asserts the server identifies as MariaDB. Logs a warning
// (and returns an error) if a MySQL-compatible server reports a non-MariaDB
// version banner.
func (a *MariaDBEnhancedAdapter) verifyMariaDB(ctx context.Context, db *sql.DB) error {
	var version string
	if err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		return fmt.Errorf("failed to query version: %w", err)
	}
	if !strings.Contains(strings.ToLower(version), "mariadb") {
		a.logger.Warnf("Connected to MySQL-compatible database but version doesn't indicate MariaDB: %s", version)
		return fmt.Errorf("expected MariaDB but got: %s", version)
	}
	a.logger.Infof("Connected to MariaDB version: %s", version)
	return nil
}
