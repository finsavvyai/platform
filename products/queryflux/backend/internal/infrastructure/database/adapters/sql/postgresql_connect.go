package sql

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"strings"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect establishes a connection to PostgreSQL using pgx v5's connection
// pool. SSL/TLS material in conn.Options is applied to the pool's TLS config.
func (p *PostgreSQLAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.pool != nil {
		return nil
	}
	p.conn = conn

	connStr, err := conn.GetConnectionString()
	if err != nil {
		return pgAdapterError("CONNECTION_STRING_ERROR",
			"Failed to build connection string", ctx, err)
	}

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return pgAdapterError("CONFIG_PARSE_ERROR",
			"Failed to parse connection configuration", ctx, err)
	}

	applyPoolOptions(config, conn)
	if err := applyTLSOptions(config, conn, connStr, p.logger); err != nil {
		return pgAdapterError("TLS_CONFIG_ERROR",
			"Failed to configure TLS", ctx, err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return pgAdapterError("CONNECTION_FAILED",
			"Failed to create connection pool", ctx, err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return pgAdapterError("CONNECTION_TEST_FAILED",
			"Failed to ping PostgreSQL database", ctx, err)
	}

	p.pool = pool
	p.logger.Infof("Connected to PostgreSQL database: %s", conn.Name)
	return nil
}

// Disconnect closes the PostgreSQL connection pool.
func (p *PostgreSQLAdapter) Disconnect(_ context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.pool == nil {
		return nil
	}
	p.pool.Close()
	p.pool = nil
	if p.conn != nil {
		p.logger.Infof("Disconnected from PostgreSQL database: %s", p.conn.Name)
	}
	return nil
}

// IsConnected returns true if the adapter is connected to PostgreSQL.
func (p *PostgreSQLAdapter) IsConnected() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.pool != nil
}

// GetConnectionInfo returns the connection metadata in use.
func (p *PostgreSQLAdapter) GetConnectionInfo() *entities.Connection {
	return p.conn
}

// applyPoolOptions reads pool_* keys from conn.Options and applies them to
// the pgxpool config. Defaults: MaxConns=10, MinConns=2.
func applyPoolOptions(config *pgxpool.Config, conn *entities.Connection) {
	if v, ok := conn.Options["pool_max_conns"]; ok {
		if n, err := toInt32(v); err == nil && n > 0 {
			config.MaxConns = n
		}
	} else {
		config.MaxConns = 10
	}
	if v, ok := conn.Options["pool_min_conns"]; ok {
		if n, err := toInt32(v); err == nil && n >= 0 {
			config.MinConns = n
		}
	} else {
		config.MinConns = 2
	}
	if v, ok := conn.Options["pool_max_conn_lifetime"]; ok {
		if d, err := toDuration(v); err == nil {
			config.MaxConnLifetime = d
		}
	}
	if v, ok := conn.Options["pool_max_conn_idle_time"]; ok {
		if d, err := toDuration(v); err == nil {
			config.MaxConnIdleTime = d
		}
	}
}

// applyTLSOptions wires custom CA / client cert PEM material from
// conn.Options into config.ConnConfig.TLSConfig.
func applyTLSOptions(config *pgxpool.Config, conn *entities.Connection, connStr string, logger interface {
	Warn(...interface{})
	Warnf(string, ...interface{})
}) error {
	sslCA, hasCA := conn.Options["ssl_ca"]
	sslCert, hasCert := conn.Options["ssl_cert"]
	sslKey, hasKey := conn.Options["ssl_key"]
	if !hasCA && !(hasCert && hasKey) {
		return nil
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: strings.Contains(connStr, "sslmode=no-verify") ||
			strings.Contains(connStr, "sslmode=require"),
	}
	if hasCA && sslCA != "" {
		pool := x509.NewCertPool()
		if pool.AppendCertsFromPEM([]byte(sslCA)) {
			tlsConfig.RootCAs = pool
		} else {
			logger.Warn("Failed to append CA certificate")
		}
	}
	if hasCert && hasKey && sslCert != "" && sslKey != "" {
		cert, err := tls.X509KeyPair([]byte(sslCert), []byte(sslKey))
		if err != nil {
			logger.Warnf("Failed to load client certificate/key: %v", err)
		} else {
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}
	config.ConnConfig.TLSConfig = tlsConfig
	return nil
}

// notConnectedError is shared by exec/stream/schema/health.
func notConnectedError() *types.AdapterError {
	ae := &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to database"}
	ae.WithContext("sentinel", errPgNotConnected.Error())
	return ae
}
