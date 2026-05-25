package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// Connect opens an enhanced MariaDB connection. multiStatements=true is
// intentionally NOT honoured from conn.Options — multi-statement SQL is
// rejected at the adapter level per QUERY_CONTRACT.md §4.
func (a *MariaDBEnhancedAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn
	dsn := a.buildDSN(conn)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open MariaDB connection: %w", err)
	}
	if err := a.configurePool(db, conn); err != nil {
		db.Close()
		return fmt.Errorf("failed to configure MariaDB connection pool: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("MariaDB ping failed: %w", mapMySQLError(ctx, "MariaDBEnhanced.Ping", err))
	}
	if err := a.verifyMariaDB(ctx, db); err != nil {
		db.Close()
		return fmt.Errorf("MariaDB verification failed: %w", err)
	}

	a.db = db
	a.logger.WithFields(logrus.Fields{
		"host":     conn.Host,
		"port":     conn.Port,
		"database": conn.Database,
	}).Info("Successfully connected to MariaDB")
	return nil
}

// buildDSN constructs the MariaDB DSN. multiStatements is filtered out — it is
// never appended, even if the user supplies it via conn.Options.
func (a *MariaDBEnhancedAdapter) buildDSN(conn *entities.Connection) string {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		conn.Username, conn.Password, conn.Host, conn.Port, conn.Database)

	params := make([]string, 0, 8)
	params = append(params, mariadbEnhancedTLSParams(conn)...)
	params = append(params, mariadbEnhancedCharsetParams(conn)...)
	params = append(params, mariadbEnhancedTimeoutParams(conn)...)
	params = append(params, "parseTime=true")

	// NOTE: multi_statements is intentionally NOT propagated here.
	for k, v := range conn.Options {
		if isReservedMariaDBOption(k) {
			continue
		}
		params = append(params, fmt.Sprintf("%s=%s", k, v))
	}

	if len(params) > 0 {
		dsn += "?" + strings.Join(params, "&")
	}
	return dsn
}

func mariadbEnhancedTLSParams(conn *entities.Connection) []string {
	if !conn.SSL {
		return []string{"tls=false"}
	}
	out := []string{"tls=true"}
	if v := conn.Options["ca_file"]; v != "" {
		out = append(out, fmt.Sprintf("ca=%s", v))
	}
	if v := conn.Options["cert_file"]; v != "" {
		out = append(out, fmt.Sprintf("cert=%s", v))
	}
	if v := conn.Options["key_file"]; v != "" {
		out = append(out, fmt.Sprintf("key=%s", v))
	}
	if conn.Options["skip_verify"] == "true" {
		out = append(out, "skip-verify=true")
	}
	return out
}

func mariadbEnhancedCharsetParams(conn *entities.Connection) []string {
	out := []string{}
	if v := conn.Options["charset"]; v != "" {
		out = append(out, fmt.Sprintf("charset=%s", v))
	} else {
		out = append(out, "charset=utf8mb4")
	}
	if v := conn.Options["collation"]; v != "" {
		out = append(out, fmt.Sprintf("collation=%s", v))
	} else {
		out = append(out, "collation=utf8mb4_unicode_ci")
	}
	return out
}

func mariadbEnhancedTimeoutParams(conn *entities.Connection) []string {
	out := []string{}
	if v := conn.Options["timeout"]; v != "" {
		out = append(out, fmt.Sprintf("timeout=%s", v))
	}
	if v := conn.Options["read_timeout"]; v != "" {
		out = append(out, fmt.Sprintf("readTimeout=%s", v))
	}
	if v := conn.Options["write_timeout"]; v != "" {
		out = append(out, fmt.Sprintf("writeTimeout=%s", v))
	}
	return out
}

func isReservedMariaDBOption(key string) bool {
	switch {
	case strings.Contains(key, "charset"),
		strings.Contains(key, "collation"),
		strings.Contains(key, "timeout"),
		strings.Contains(key, "tls"),
		strings.Contains(key, "ca_file"),
		strings.Contains(key, "cert_file"),
		strings.Contains(key, "key_file"),
		strings.Contains(key, "skip_verify"),
		strings.Contains(key, "multi_statements"), // never appended
		strings.Contains(key, "multiStatements"):
		return true
	}
	return false
}

// Disconnect closes the connection.
func (a *MariaDBEnhancedAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			return fmt.Errorf("failed to close MariaDB connection: %w", err)
		}
		a.db = nil
		a.logger.Info("MariaDB connection closed")
	}
	return nil
}

// TestConnection pings the server.
func (a *MariaDBEnhancedAdapter) TestConnection(ctx context.Context) error {
	if a.db == nil {
		return wrapMySQLAdapterErr("MariaDBEnhanced.TestConnection", "NOT_CONNECTED", "not connected to MariaDB", errMySQLNotConn)
	}
	return mapMySQLError(ctx, "MariaDBEnhanced.Ping", a.db.PingContext(ctx))
}
