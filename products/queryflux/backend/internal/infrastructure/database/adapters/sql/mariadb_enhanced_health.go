package sql

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// mariadbVariablePatternRegex restricts SHOW VARIABLES LIKE patterns to the
// MySQL/MariaDB variable naming alphabet plus the `%` and `_` LIKE wildcards.
// This is an allowlist — anything outside it (quotes, backslashes, semicolons,
// spaces) is rejected with ErrInvalidParam, eliminating the injection vector
// at `SHOW VARIABLES LIKE '<pattern>'`. Option 1 from the fix-payload review.
// Picked over LIKE-escape (Option 2) because MariaDB system variable names
// are a closed set [A-Za-z0-9_] and wildcards are the only legitimate use
// case here.
var mariadbVariablePatternRegex = regexp.MustCompile(`^[A-Za-z0-9_%]{1,64}$`)

// IsConnected reports whether the *sql.DB handle is live.
func (a *MariaDBEnhancedAdapter) IsConnected() bool { return a.db != nil }

// GetConnectionInfo returns the cached *entities.Connection.
func (a *MariaDBEnhancedAdapter) GetConnectionInfo() *entities.Connection { return a.conn }

// GetMariaDBVersion returns the server version string.
func (a *MariaDBEnhancedAdapter) GetMariaDBVersion(ctx context.Context) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("not connected to MariaDB")
	}
	var version string
	if err := a.db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		return "", fmt.Errorf("failed to get MariaDB version: %w", err)
	}
	return version, nil
}

// GetEngineInfo enumerates supported storage engines.
func (a *MariaDBEnhancedAdapter) GetEngineInfo(ctx context.Context) (map[string][]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to MariaDB")
	}
	engineInfo := make(map[string][]string)
	rows, err := a.db.QueryContext(ctx, "SELECT engine, support FROM information_schema.engines ORDER BY engine")
	if err != nil {
		return nil, fmt.Errorf("failed to get engine information: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var engine, support sql.NullString
		if err := rows.Scan(&engine, &support); err == nil {
			engineInfo[engine.String] = []string{support.String}
		}
	}
	return engineInfo, nil
}

// GetVariableInfo returns server variables, optionally filtered.
func (a *MariaDBEnhancedAdapter) GetVariableInfo(ctx context.Context, variablePattern string) (map[string]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to MariaDB")
	}
	variableInfo := make(map[string]string)
	query := "SHOW VARIABLES"
	if variablePattern != "" {
		// SHOW VARIABLES LIKE cannot bind parameters in MySQL/MariaDB, so
		// the pattern must be interpolated. Restrict to a strict allowlist
		// — variable names use [A-Za-z0-9_] plus LIKE wildcards `%` `_`.
		// Anything else (quotes, backslashes, semicolons, spaces, etc.) is
		// rejected. Closes the `' UNION SELECT user,password FROM ...`
		// injection vector.
		if !mariadbVariablePatternRegex.MatchString(variablePattern) {
			return nil, types.NewAdapterError(
				"INVALID_VARIABLE_PATTERN",
				"Invalid SHOW VARIABLES LIKE pattern",
				fmt.Sprintf("pattern %q rejected by allowlist", variablePattern),
			).WithSentinel(types.ErrInvalidParam)
		}
		query += fmt.Sprintf(" LIKE '%s'", variablePattern)
	}
	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get variable information: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var varName, varValue sql.NullString
		if err := rows.Scan(&varName, &varValue); err == nil {
			variableInfo[varName.String] = varValue.String
		}
	}
	return variableInfo, nil
}

// truncateQuery shortens log-bound query strings.
func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// HealthCheck pings the database.
func (a *MariaDBEnhancedAdapter) HealthCheck(ctx context.Context) error {
	return a.TestConnection(ctx)
}

// Ping is an alias for TestConnection.
func (a *MariaDBEnhancedAdapter) Ping(ctx context.Context) error {
	return a.TestConnection(ctx)
}

// GetMetrics returns *sql.DB pool stats.
func (a *MariaDBEnhancedAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDBEnhanced.GetMetrics", "NOT_CONNECTED", "Not connected", errMySQLNotConn)
	}
	stats := a.db.Stats()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    stats.OpenConnections,
			IdleConnections:    stats.Idle,
			InUseConnections:   stats.InUse,
			WaitCount:          int64(stats.WaitCount),
			WaitDuration:       stats.WaitDuration,
			MaxOpenConnections: stats.MaxOpenConnections,
		},
	}, nil
}

// MariaDBTransaction wraps *sql.Tx for the types.Transaction surface.
type MariaDBTransaction struct {
	tx *sql.Tx
}

// Commit commits the transaction.
func (t *MariaDBTransaction) Commit() error { return t.tx.Commit() }

// Rollback rolls the transaction back.
func (t *MariaDBTransaction) Rollback() error { return t.tx.Rollback() }

// BeginTransaction starts a transaction on the active MariaDB connection.
func (a *MariaDBEnhancedAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDBEnhanced.BeginTransaction", "NOT_CONNECTED", "Not connected", errMySQLNotConn)
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDBEnhanced.BeginTx", err)
	}
	return &MariaDBTransaction{tx: tx}, nil
}
