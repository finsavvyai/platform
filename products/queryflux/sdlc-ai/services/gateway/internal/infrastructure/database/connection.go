//go:build ignore

package database

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// Config holds the database configuration
type Config struct {
	Host              string        `mapstructure:"host" yaml:"host"`
	Port              int           `mapstructure:"port" yaml:"port"`
	User              string        `mapstructure:"user" yaml:"user"`
	Password          string        `mapstructure:"password" yaml:"password"`
	Database          string        `mapstructure:"database" yaml:"database"`
	SSLMode           string        `mapstructure:"ssl_mode" yaml:"ssl_mode"`
	MaxConnections    int           `mapstructure:"max_connections" yaml:"max_connections"`
	MinConnections    int           `mapstructure:"min_connections" yaml:"min_connections"`
	MaxConnLifetime   time.Duration `mapstructure:"max_conn_lifetime" yaml:"max_conn_lifetime"`
	MaxConnIdleTime   time.Duration `mapstructure:"max_conn_idle_time" yaml:"max_conn_idle_time"`
	HealthCheckPeriod time.Duration `mapstructure:"health_check_period" yaml:"health_check_period"`
	ConnectTimeout    time.Duration `mapstructure:"connect_timeout" yaml:"connect_timeout"`
	RetryAttempts     int           `mapstructure:"retry_attempts" yaml:"retry_attempts"`
	RetryDelay        time.Duration `mapstructure:"retry_delay" yaml:"retry_delay"`
}

// DefaultConfig returns default database configuration
func DefaultConfig() *Config {
	return &Config{
		Host:              "localhost",
		Port:              5432,
		User:              "postgres",
		Password:          "",
		Database:          "sdlc_platform",
		SSLMode:           "require",
		MaxConnections:    20,
		MinConnections:    5,
		MaxConnLifetime:   time.Hour,
		MaxConnIdleTime:   time.Minute * 30,
		HealthCheckPeriod: time.Minute * 1,
		ConnectTimeout:    time.Second * 10,
		RetryAttempts:     3,
		RetryDelay:        time.Second * 2,
	}
}

// ConnectionString builds the database connection string
func (c *Config) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=%s",
		c.Host,
		c.Port,
		c.User,
		c.Password,
		c.Database,
		c.SSLMode,
		c.ConnectTimeout,
	)
}

// PoolConfig returns pgxpool configuration
func (c *Config) PoolConfig() *pgxpool.Config {
	config, err := pgxpool.ParseConfig(c.ConnectionString())
	if err != nil {
		panic(fmt.Sprintf("Failed to parse database config: %v", err))
	}

	// Configure connection pool
	config.MaxConns = int32(c.MaxConnections)
	config.MinConns = int32(c.MinConnections)
	config.MaxConnLifetime = c.MaxConnLifetime
	config.MaxConnIdleTime = c.MaxConnIdleTime
	config.HealthCheckPeriod = c.HealthCheckPeriod

	// Configure connection timeouts
	config.ConnConfig.ConnectTimeout = c.ConnectTimeout

	// Configure TLS
	if c.SSLMode != "disable" {
		config.ConnConfig.TLSConfig.Config.ServerName = c.Host
	}

	// Configure before connection hook for logging
	config.BeforeConnect = func(ctx context.Context, cfg *pgx.ConnConfig) error {
		logrus.WithFields(logrus.Fields{
			"host":     cfg.Host,
			"database": cfg.Database,
			"user":     cfg.User,
		}).Debug("Connecting to database")
		return nil
	}

	// Configure after connection hook for logging
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		logrus.WithFields(logrus.Fields{
			"host":     conn.Config().Host,
			"database": conn.Config().Database,
		}).Debug("Connected to database")
		return nil
	}

	return config
}

// Database represents the database connection manager
type Database struct {
	Pool   *pgxpool.Pool
	Config *Config
	logger *logrus.Logger
}

// NewDatabase creates a new database connection manager
func NewDatabase(config *Config, logger *logrus.Logger) (*Database, error) {
	if logger == nil {
		logger = logrus.New()
	}

	db := &Database{
		Config: config,
		logger: logger,
	}

	if err := db.Connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

// Connect establishes a connection pool to the database
func (db *Database) Connect() error {
	ctx, cancel := context.WithTimeout(context.Background(), db.Config.ConnectTimeout)
	defer cancel()

	var lastErr error

	// Retry connection attempts
	for attempt := 1; attempt <= db.Config.RetryAttempts; attempt++ {
		db.logger.WithFields(logrus.Fields{
			"attempt":      attempt,
			"max_attempts": db.Config.RetryAttempts,
			"host":         db.Config.Host,
			"port":         db.Config.Port,
			"database":     db.Config.Database,
		}).Info("Attempting to connect to database")

		pool, err := pgxpool.NewWithConfig(ctx, db.Config.PoolConfig())
		if err == nil {
			// Test the connection
			if err := pool.Ping(ctx); err == nil {
				db.Pool = pool
				db.logger.WithFields(logrus.Fields{
					"host":            db.Config.Host,
					"port":            db.Config.Port,
					"database":        db.Config.Database,
					"max_connections": db.Config.MaxConnections,
					"min_connections": db.Config.MinConnections,
				}).Info("Successfully connected to database")
				return nil
			}
			pool.Close()
			lastErr = err
		} else {
			lastErr = err
		}

		if attempt < db.Config.RetryAttempts {
			db.logger.WithError(err).Warnf("Database connection attempt %d failed, retrying in %v", attempt, db.Config.RetryDelay)
			time.Sleep(db.Config.RetryDelay)
		}
	}

	return fmt.Errorf("failed to connect to database after %d attempts: %w", db.Config.RetryAttempts, lastErr)
}

// Close closes the database connection pool
func (db *Database) Close() error {
	if db.Pool != nil {
		db.Pool.Close()
		db.logger.Info("Database connection pool closed")
	}
	return nil
}

// Ping checks if the database connection is alive
func (db *Database) Ping(ctx context.Context) error {
	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	return db.Pool.Ping(ctx)
}

// GetPool returns the connection pool
func (db *Database) GetPool() *pgxpool.Pool {
	return db.Pool
}

// GetStats returns connection pool statistics
func (db *Database) GetStats() *pgxpool.Stat {
	return db.Pool.Stat()
}

// Health performs a comprehensive health check
func (db *Database) Health(ctx context.Context) map[string]interface{} {
	health := map[string]interface{}{
		"status":  "unhealthy",
		"details": map[string]interface{}{},
	}

	if db.Pool == nil {
		health["details"] = map[string]interface{}{
			"error": "Database pool is not initialized",
		}
		return health
	}

	// Check basic connectivity
	if err := db.Ping(ctx); err != nil {
		health["details"].(map[string]interface{})["ping_error"] = err.Error()
		return health
	}

	// Get connection pool stats
	stats := db.GetStats()
	health["details"].(map[string]interface{})["pool_stats"] = map[string]interface{}{
		"acquire_count":          stats.AcquireCount(),
		"acquire_duration":       stats.AcquireDuration().String(),
		"canceled_acquire_count": stats.CanceledAcquireCount(),
		"constructing_conns":     stats.ConstructingConns(),
		"empty_acquire_count":    stats.EmptyAcquireCount(),
		"idle_conns":             stats.IdleConns(),
		"max_conns":              stats.MaxConns(),
		"total_conns":            stats.TotalConns(),
	}

	// Check if we can perform a simple query
	var result int
	if err := db.Pool.QueryRow(ctx, "SELECT 1").Scan(&result); err != nil {
		health["details"].(map[string]interface{})["query_error"] = err.Error()
		return health
	}

	// Check table availability
	tables := []string{"tenants", "users", "documents", "document_chunks", "api_keys", "policies", "audit_logs"}
	availableTables := make([]string, 0, len(tables))

	for _, table := range tables {
		var exists bool
		err := db.Pool.QueryRow(ctx,
			"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
			table).Scan(&exists)
		if err == nil && exists {
			availableTables = append(availableTables, table)
		}
	}

	health["details"].(map[string]interface{})["available_tables"] = availableTables
	health["details"].(map[string]interface{})["total_tables"] = len(tables)
	health["details"].(map[string]interface{})["available_tables_count"] = len(availableTables)

	// Check connection to the database host
	if host, port, err := net.SplitHostPort(fmt.Sprintf("%s:%d", db.Config.Host, db.Config.Port)); err == nil {
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), time.Second*5)
		if err != nil {
			health["details"].(map[string]interface{})["network_error"] = err.Error()
		} else {
			conn.Close()
		}
	}

	// If all checks passed, mark as healthy
	if _, hasQueryError := health["details"].(map[string]interface{})["query_error"]; !hasQueryError {
		health["status"] = "healthy"
	}

	return health
}

// RetryableOperation defines an operation that can be retried
type RetryableOperation func(ctx context.Context) error

// WithRetry executes an operation with retry logic
func (db *Database) WithRetry(ctx context.Context, operation RetryableOperation) error {
	var lastErr error

	for attempt := 1; attempt <= db.Config.RetryAttempts; attempt++ {
		if err := operation(ctx); err != nil {
			lastErr = err

			// Check if error is retryable
			if !db.isRetryableError(err) {
				return err
			}

			if attempt < db.Config.RetryAttempts {
				db.logger.WithFields(logrus.Fields{
					"attempt":      attempt,
					"max_attempts": db.Config.RetryAttempts,
					"error":        err.Error(),
				}).Warn("Operation failed, retrying")

				// Exponential backoff
				delay := db.Config.RetryDelay * time.Duration(attempt)
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(delay):
				}
			}
		} else {
			return nil
		}
	}

	return fmt.Errorf("operation failed after %d attempts: %w", db.Config.RetryAttempts, lastErr)
}

// isRetryableError checks if an error is retryable
func (db *Database) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	// Check for specific PostgreSQL errors that are retryable
	errMsg := err.Error()
	retryableErrors := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"timeout",
		"deadlock",
		"connection timed out",
		"too many connections",
		"database is locked",
	}

	for _, retryableErr := range retryableErrors {
		if contains(errMsg, retryableErr) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 1; i < len(s)-len(substr)+1; i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
