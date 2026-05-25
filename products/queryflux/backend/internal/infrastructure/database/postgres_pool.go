package database

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// PostgreSQLPoolManager manages PostgreSQL connection pools with advanced features
type PostgreSQLPoolManager struct {
	pool         *pgxpool.Pool
	config       *PostgreSQLPoolConfig
	logger       *zap.Logger
	mu           sync.RWMutex
	healthTicker *time.Ticker
	metrics      *PostgreSQLMetrics
	isConnected  bool
}

// PostgreSQLPoolConfig defines configuration for the PostgreSQL connection pool
type PostgreSQLPoolConfig struct {
	// Connection settings
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Database        string        `mapstructure:"database"`
	Username        string        `mapstructure:"username"`
	Password        string        `mapstructure:"password"`
	SSLMode         string        `mapstructure:"ssl_mode"`
	MaxConnections  int32         `mapstructure:"max_connections"`
	MinConnections  int32         `mapstructure:"min_connections"`
	MaxConnLifetime time.Duration `mapstructure:"max_conn_lifetime"`
	MaxConnIdleTime time.Duration `mapstructure:"max_conn_idle_time"`
	ConnectTimeout  time.Duration `mapstructure:"connect_timeout"`

	// Health check settings
	HealthCheckPeriod  time.Duration `mapstructure:"health_check_period"`
	HealthCheckTimeout time.Duration `mapstructure:"health_check_timeout"`
	MaxRetries         int           `mapstructure:"max_retries"`
	RetryDelay         time.Duration `mapstructure:"retry_delay"`

	// Performance settings
	QueryTimeout         time.Duration `mapstructure:"query_timeout"`
	StatementCacheSize   int           `mapstructure:"statement_cache_size"`
	DescriptionCacheSize int           `mapstructure:"description_cache_size"`

	// Connection string
	ConnectionString string `mapstructure:"connection_string"`
}

// DefaultPostgreSQLPoolConfig returns default configuration
func DefaultPostgreSQLPoolConfig() *PostgreSQLPoolConfig {
	return &PostgreSQLPoolConfig{
		MaxConnections:       20,
		MinConnections:       5,
		MaxConnLifetime:      1 * time.Hour,
		MaxConnIdleTime:      30 * time.Minute,
		ConnectTimeout:       10 * time.Second,
		HealthCheckPeriod:    30 * time.Second,
		HealthCheckTimeout:   5 * time.Second,
		MaxRetries:           3,
		RetryDelay:           1 * time.Second,
		QueryTimeout:         30 * time.Second,
		StatementCacheSize:   1000,
		DescriptionCacheSize: 100,
		SSLMode:              "prefer",
	}
}

// PostgreSQLMetrics tracks PostgreSQL connection pool metrics
type PostgreSQLMetrics struct {
	TotalConnections     int64         `json:"total_connections"`
	ActiveConnections    int64         `json:"active_connections"`
	IdleConnections      int64         `json:"idle_connections"`
	MaxConnections       int64         `json:"max_connections"`
	AcquireCount         int64         `json:"acquire_count"`
	AcquireDuration      time.Duration `json:"acquire_duration_ns"`
	AcquireErrors        int64         `json:"acquire_errors"`
	EmptyAcquireCount    int64         `json:"empty_acquire_count"`
	CanceledAcquireCount int64         `json:"canceled_acquire_count"`
	ConstructCount       int64         `json:"construct_count"`
	ConstructErrors      int64         `json:"construct_errors"`
	CloseCount           int64         `json:"close_count"`
	TotalQueryTime       time.Duration `json:"total_query_time_ns"`
	TotalQueryCount      int64         `json:"total_query_count"`
	FailedQueries        int64         `json:"failed_queries"`
	LastHealthCheck      time.Time     `json:"last_health_check"`
	HealthCheckErrors    int64         `json:"health_check_errors"`
}

// NewPostgreSQLPoolManager creates a new PostgreSQL pool manager
func NewPostgreSQLPoolManager(config *PostgreSQLPoolConfig, logger *zap.Logger) (*PostgreSQLPoolManager, error) {
	if config == nil {
		config = DefaultPostgreSQLPoolConfig()
	}

	if logger == nil {
		var err error
		logger, err = zap.NewProduction()
		if err != nil {
			return nil, fmt.Errorf("failed to create logger: %w", err)
		}
	}

	manager := &PostgreSQLPoolManager{
		config:  config,
		logger:  logger,
		metrics: &PostgreSQLMetrics{},
	}

	return manager, nil
}

// Connect establishes a connection to PostgreSQL with retry logic
func (p *PostgreSQLPoolManager) Connect(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.pool != nil {
		return nil // Already connected
	}

	var lastErr error
	for attempt := 0; attempt < p.config.MaxRetries; attempt++ {
		if attempt > 0 {
			p.logger.Warn("Retrying PostgreSQL connection",
				zap.Int("attempt", attempt+1),
				zap.Duration("delay", p.config.RetryDelay))

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(p.config.RetryDelay):
			}
		}

		if err := p.connectAttempt(ctx); err != nil {
			lastErr = err
			p.logger.Error("PostgreSQL connection attempt failed",
				zap.Int("attempt", attempt+1),
				zap.Error(err))
			continue
		}

		p.isConnected = true
		p.logger.Info("Successfully connected to PostgreSQL",
			zap.String("host", p.config.Host),
			zap.Int("port", p.config.Port),
			zap.String("database", p.config.Database))

		// Start health check routine
		p.startHealthCheck(ctx)

		return nil
	}

	return fmt.Errorf("failed to connect to PostgreSQL after %d attempts: %w",
		p.config.MaxRetries, lastErr)
}

// connectAttempt makes a single connection attempt
func (p *PostgreSQLPoolManager) connectAttempt(ctx context.Context) error {
	// Build connection string if not provided
	connString := p.config.ConnectionString
	if connString == "" {
		connString = p.buildConnectionString()
	}

	// Parse and configure connection pool
	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return fmt.Errorf("failed to parse connection config: %w", err)
	}

	// Configure pool parameters
	poolConfig.MaxConns = p.config.MaxConnections
	poolConfig.MinConns = p.config.MinConnections
	poolConfig.MaxConnLifetime = p.config.MaxConnLifetime
	poolConfig.MaxConnIdleTime = p.config.MaxConnIdleTime
	poolConfig.HealthCheckPeriod = p.config.HealthCheckPeriod
	poolConfig.ConnConfig.ConnectTimeout = p.config.ConnectTimeout

	// Configure statement cache
	if poolConfig.ConnConfig.RuntimeParams == nil {
		poolConfig.ConnConfig.RuntimeParams = make(map[string]string)
	}
	poolConfig.ConnConfig.RuntimeParams["prepared_statement_cache_size"] = fmt.Sprintf("%d", p.config.StatementCacheSize)
	poolConfig.ConnConfig.RuntimeParams["description_cache_size"] = fmt.Sprintf("%d", p.config.DescriptionCacheSize)

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("connection ping failed: %w", err)
	}

	p.pool = pool
	p.metrics.MaxConnections = int64(p.config.MaxConnections)
	return nil
}

// buildConnectionString constructs PostgreSQL connection string
func (p *PostgreSQLPoolManager) buildConnectionString() string {
	return fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=%s connect_timeout=%d",
		p.config.Host,
		p.config.Port,
		p.config.Database,
		p.config.Username,
		p.config.Password,
		p.config.SSLMode,
		int(p.config.ConnectTimeout.Seconds()))
}

// Disconnect closes the PostgreSQL connection pool
func (p *PostgreSQLPoolManager) Disconnect(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.pool == nil {
		return nil
	}

	// Stop health check
	if p.healthTicker != nil {
		p.healthTicker.Stop()
		p.healthTicker = nil
	}

	p.pool.Close()
	p.pool = nil
	p.isConnected = false

	p.logger.Info("Disconnected from PostgreSQL")
	return nil
}

// GetPool returns the underlying connection pool
func (p *PostgreSQLPoolManager) GetPool() *pgxpool.Pool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.pool
}

// IsConnected returns true if connected to PostgreSQL
func (p *PostgreSQLPoolManager) IsConnected() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.isConnected && p.pool != nil
}

// HealthCheck performs a health check on the PostgreSQL connection
func (p *PostgreSQLPoolManager) HealthCheck(ctx context.Context) error {
	if !p.IsConnected() {
		return fmt.Errorf("not connected to PostgreSQL")
	}

	ctx, cancel := context.WithTimeout(ctx, p.config.HealthCheckTimeout)
	defer cancel()

	if err := p.pool.Ping(ctx); err != nil {
		p.metrics.HealthCheckErrors++
		return fmt.Errorf("health check failed: %w", err)
	}

	p.metrics.LastHealthCheck = time.Now()
	return nil
}

// GetMetrics returns current connection pool metrics
func (p *PostgreSQLPoolManager) GetMetrics() *PostgreSQLMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.pool == nil {
		return p.metrics
	}

	// Get stats from pgxpool
	stats := p.pool.Stat()
	p.metrics.TotalConnections = int64(stats.TotalConns())
	p.metrics.IdleConnections = int64(stats.IdleConns())
	p.metrics.ActiveConnections = int64(stats.AcquiredConns())
	p.metrics.AcquireCount = int64(stats.AcquireCount())
	p.metrics.AcquireDuration = stats.AcquireDuration()
	// p.metrics.AcquireErrors = int64(stats.AcquireErrors()) // Not available in pgx/v5
	p.metrics.EmptyAcquireCount = int64(stats.EmptyAcquireCount())
	p.metrics.CanceledAcquireCount = int64(stats.CanceledAcquireCount())
	// p.metrics.ConstructCount = int64(stats.ConstructCount()) // Not available in pgx/v5
	// p.metrics.ConstructErrors = int64(stats.ConstructErrors()) // Not available in pgx/v5
	// p.metrics.CloseCount = int64(stats.CloseCount()) // Not available in pgx/v5

	return p.metrics
}

// startHealthCheck starts the health check routine
func (p *PostgreSQLPoolManager) startHealthCheck(ctx context.Context) {
	if p.healthTicker != nil {
		p.healthTicker.Stop()
	}

	p.healthTicker = time.NewTicker(p.config.HealthCheckPeriod)

	go func() {
		defer p.healthTicker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-p.healthTicker.C:
				if err := p.HealthCheck(context.Background()); err != nil {
					p.logger.Error("PostgreSQL health check failed", zap.Error(err))
				} else {
					p.logger.Debug("PostgreSQL health check passed")
				}
			}
		}
	}()
}

// ExecuteQuery executes a query with timeout and metrics tracking
func (p *PostgreSQLPoolManager) ExecuteQuery(ctx context.Context, query string, args ...interface{}) error {
	if !p.IsConnected() {
		return fmt.Errorf("not connected to PostgreSQL")
	}

	// Add query timeout if not already present
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, p.config.QueryTimeout)
		defer cancel()
	}

	start := time.Now()

	rows, err := p.pool.Query(ctx, query, args...)
	if rows != nil {
		rows.Close()
	}

	// Update metrics
	p.mu.Lock()
	p.metrics.TotalQueryCount++
	p.metrics.TotalQueryTime += time.Since(start)
	if err != nil {
		p.metrics.FailedQueries++
	}
	p.mu.Unlock()

	return err
}

// ExecuteQueryRow executes a query that returns a single row
func (p *PostgreSQLPoolManager) ExecuteQueryRow(ctx context.Context, query string, args ...interface{}) pgx.Row {
	if !p.IsConnected() {
		return nil
	}

	// Add query timeout if not already present
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, p.config.QueryTimeout)
		defer cancel()
	}

	return p.pool.QueryRow(ctx, query, args...)
}

// Close closes the connection pool gracefully
func (p *PostgreSQLPoolManager) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return p.Disconnect(ctx)
}
