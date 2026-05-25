package sql

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/go-sql-driver/mysql"
)

// Connect establishes a connection to MySQL. Multi-statement execution is
// disabled at the DSN level (QUERY_CONTRACT.md §4) — we strip any
// multiStatements=true the connection options may contain.
func (m *MySQLAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.db != nil {
		return nil
	}
	m.conn = conn

	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build connection string",
			Details: err.Error(),
		}
	}
	connStr = ensureMySQLDSNParams(connStr)
	connStr = stripMultiStatementsDSN(connStr)

	if name, ok, terr := buildMySQLTLSConfig(conn); terr != nil {
		return terr
	} else if ok {
		if strings.Contains(connStr, "?") {
			connStr += "&tls=" + name
		} else {
			connStr += "?tls=" + name
		}
	}

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return &types.AdapterError{Code: "CONNECTION_FAILED", Message: "Failed to open MySQL connection", Details: err.Error()}
	}

	applyMySQLPool(db, conn)

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return wrapMySQLAdapterErr("MySQL.Ping", "CONNECTION_TEST_FAILED", err.Error(), errMySQLConnection)
	}

	m.db = db
	m.logger.Infof("Connected to MySQL database: %s", conn.Name)
	return nil
}

// Disconnect closes the MySQL connection.
func (m *MySQLAdapter) Disconnect(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.db == nil {
		return nil
	}
	if err := m.db.Close(); err != nil {
		return &types.AdapterError{Code: "DISCONNECT_FAILED", Message: "Failed to close MySQL connection", Details: err.Error()}
	}
	m.db = nil
	m.logger.Infof("Disconnected from MySQL database: %s", m.conn.Name)
	return nil
}

// TestConnection pings MySQL to validate the active connection.
func (m *MySQLAdapter) TestConnection(ctx context.Context) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return wrapMySQLAdapterErr("MySQL.TestConnection", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}
	if err := m.db.PingContext(ctx); err != nil {
		return wrapMySQLAdapterErr("MySQL.TestConnection", "CONNECTION_TEST_FAILED", err.Error(), errMySQLConnection)
	}
	return nil
}

// ensureMySQLDSNParams appends parseTime+charset defaults if missing.
func ensureMySQLDSNParams(dsn string) string {
	if !strings.Contains(dsn, "parseTime=") {
		dsn = appendDSNParam(dsn, "parseTime=true")
	}
	if !strings.Contains(dsn, "charset=") {
		dsn = appendDSNParam(dsn, "charset=utf8mb4")
	}
	return dsn
}

// stripMultiStatementsDSN removes multiStatements=true if present. The runner
// (task #2) rejects multi-statement SQL — defence in depth at the DSN level.
func stripMultiStatementsDSN(dsn string) string {
	dsn = strings.ReplaceAll(dsn, "&multiStatements=true", "")
	dsn = strings.ReplaceAll(dsn, "multiStatements=true&", "")
	dsn = strings.ReplaceAll(dsn, "?multiStatements=true", "?")
	dsn = strings.TrimSuffix(dsn, "?")
	return dsn
}

func appendDSNParam(dsn, kv string) string {
	if strings.Contains(dsn, "?") {
		return dsn + "&" + kv
	}
	return dsn + "?" + kv
}

// buildMySQLTLSConfig registers a custom TLS config if the connection carries
// certificate material. Returns the registered name + true on success.
func buildMySQLTLSConfig(conn *entities.Connection) (string, bool, error) {
	sslCA, hasCA := conn.Options["ssl_ca"]
	sslCert, hasCert := conn.Options["ssl_cert"]
	sslKey, hasKey := conn.Options["ssl_key"]
	if !(hasCA || (hasCert && hasKey)) {
		return "", false, nil
	}

	tlsConfig := &tls.Config{}
	if hasCA && sslCA != "" {
		pool := x509.NewCertPool()
		if pool.AppendCertsFromPEM([]byte(sslCA)) {
			tlsConfig.RootCAs = pool
		}
	}
	if hasCert && sslCert != "" && hasKey && sslKey != "" {
		cert, err := tls.X509KeyPair([]byte(sslCert), []byte(sslKey))
		if err == nil {
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}

	name := "custom_" + conn.ID
	if err := mysql.RegisterTLSConfig(name, tlsConfig); err != nil {
		return "", false, &types.AdapterError{Code: "TLS_CONFIG_ERROR", Message: "Failed to register TLS config", Details: err.Error()}
	}
	return name, true, nil
}

// applyMySQLPool configures the *sql.DB pool from conn.Options with sensible
// MySQL defaults (max=10, min=2, lifetime=1h, idle=30m).
func applyMySQLPool(db *sql.DB, conn *entities.Connection) {
	if v, ok := conn.Options["pool_max_conns"]; ok {
		if n, err := toInt32(v); err == nil && n > 0 {
			db.SetMaxOpenConns(int(n))
		}
	} else {
		db.SetMaxOpenConns(10)
	}
	if v, ok := conn.Options["pool_min_conns"]; ok {
		if n, err := toInt32(v); err == nil && n >= 0 {
			db.SetMaxIdleConns(int(n))
		}
	} else {
		db.SetMaxIdleConns(2)
	}
	if v, ok := conn.Options["pool_max_conn_lifetime"]; ok {
		if d, err := toDuration(v); err == nil {
			db.SetConnMaxLifetime(d)
		}
	} else {
		db.SetConnMaxLifetime(time.Hour)
	}
	if v, ok := conn.Options["pool_max_conn_idle_time"]; ok {
		if d, err := toDuration(v); err == nil {
			db.SetConnMaxIdleTime(d)
		}
	} else {
		db.SetConnMaxIdleTime(30 * time.Minute)
	}
}
