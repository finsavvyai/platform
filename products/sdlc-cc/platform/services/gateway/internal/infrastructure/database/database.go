package database

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/repository"
)

// logrusWriter adapts logrus.Logger to io.Writer for GORM
type logrusWriter struct {
	logger *logrus.Logger
	mu     sync.Mutex
}

func (w *logrusWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.logger.Log(logrus.InfoLevel, string(p))
	return len(p), nil
}

// Printf implements logger.Writer interface for GORM
func (w *logrusWriter) Printf(format string, args ...interface{}) {
	w.logger.Logf(logrus.InfoLevel, format, args...)
}

// GormConfig represents GORM database configuration
type GormConfig struct {
	// PostgreSQL configuration
	Host     string `yaml:"host" mapstructure:"host"`
	Port     int    `yaml:"port" mapstructure:"port"`
	User     string `yaml:"user" mapstructure:"user"`
	Password string `yaml:"password" mapstructure:"password"`
	DBName   string `yaml:"dbname" mapstructure:"dbname"`
	SSLMode  string `yaml:"sslmode" mapstructure:"sslmode"`
	TimeZone string `yaml:"timezone" mapstructure:"timezone"`

	// Connection pool settings
	MaxOpenConns    int           `yaml:"max_open_conns" mapstructure:"max_open_conns"`
	MaxIdleConns    int           `yaml:"max_idle_conns" mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime" mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `yaml:"conn_max_idle_time" mapstructure:"conn_max_idle_time"`

	// Retry configuration
	MaxRetries   int           `yaml:"max_retries" mapstructure:"max_retries"`
	RetryDelay   time.Duration `yaml:"retry_delay" mapstructure:"retry_delay"`
	RetryBackoff float64       `yaml:"retry_backoff" mapstructure:"retry_backoff"`

	// Health check settings
	HealthCheckInterval time.Duration `yaml:"health_check_interval" mapstructure:"health_check_interval"`
	HealthCheckTimeout  time.Duration `yaml:"health_check_timeout" mapstructure:"health_check_timeout"`

	// Redis configuration for caching
	RedisHost     string `yaml:"redis_host" mapstructure:"redis_host"`
	RedisPort     int    `yaml:"redis_port" mapstructure:"redis_port"`
	RedisPassword string `yaml:"redis_password" mapstructure:"redis_password"`
	RedisDB       int    `yaml:"redis_db" mapstructure:"redis_db"`
	RedisPoolSize int    `yaml:"redis_pool_size" mapstructure:"redis_pool_size"`

	// Development mode
	Debug         bool `yaml:"debug" mapstructure:"debug"`
	EnableLogging bool `yaml:"enable_logging" mapstructure:"enable_logging"`
}

// DefaultGormConfig returns default GORM database configuration
func DefaultGormConfig() GormConfig {
	return GormConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "postgres",
		Password: "password",
		DBName:   "sdlc",
		SSLMode:  "prefer",
		TimeZone: "UTC",

		MaxOpenConns:    25,
		MaxIdleConns:    5,
		ConnMaxLifetime: 5 * time.Minute,
		ConnMaxIdleTime: 1 * time.Minute,

		MaxRetries:   3,
		RetryDelay:   100 * time.Millisecond,
		RetryBackoff: 2.0,

		HealthCheckInterval: 30 * time.Second,
		HealthCheckTimeout:  5 * time.Second,

		RedisHost:     "localhost",
		RedisPort:     6379,
		RedisPassword: "",
		RedisDB:       0,
		RedisPoolSize: 10,

		Debug:         false,
		EnableLogging: true,
	}
}

// GormDatabase represents the GORM database manager
type GormDatabase struct {
	config       GormConfig
	db           *gorm.DB
	pgxPool      *pgxpool.Pool
	redis        *redis.Client
	repositories repository.DatabaseManager
	logger       *logrus.Logger
	healthStatus *HealthStatus
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

// HealthStatus represents database health status
type HealthStatus struct {
	IsHealthy       bool                       `json:"is_healthy"`
	LastCheck       time.Time                  `json:"last_check"`
	DatabaseStatus  ConnectionStatus           `json:"database_status"`
	RedisStatus     ConnectionStatus           `json:"redis_status"`
	OverallStatus   string                     `json:"overall_status"`
	ConnectionStats repository.ConnectionStats `json:"connection_stats"`
	Error           string                     `json:"error,omitempty"`
	Checks          map[string]CheckResult     `json:"checks"`
}

// ConnectionStatus represents connection status
type ConnectionStatus struct {
	Connected         bool          `json:"connected"`
	ResponseTime      time.Duration `json:"response_time"`
	LastError         string        `json:"last_error,omitempty"`
	LastChecked       time.Time     `json:"last_checked"`
	ConsecutiveErrors int           `json:"consecutive_errors"`
}

// CheckResult represents a specific health check result
type CheckResult struct {
	Passed       bool          `json:"passed"`
	ResponseTime time.Duration `json:"response_time"`
	Message      string        `json:"message"`
	Error        string        `json:"error,omitempty"`
}

// NewGormDatabase creates a new GORM database manager
func NewGormDatabase(config GormConfig, logger *logrus.Logger) (*GormDatabase, error) {
	if logger == nil {
		logger = logrus.New()
		if config.Debug {
			logger.SetLevel(logrus.DebugLevel)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())

	db := &GormDatabase{
		config: config,
		logger: logger,
		healthStatus: &HealthStatus{
			IsHealthy:       false,
			LastCheck:       time.Now(),
			OverallStatus:   "initializing",
			ConnectionStats: repository.ConnectionStats{},
			Checks:          make(map[string]CheckResult),
		},
		ctx:    ctx,
		cancel: cancel,
	}

	// Initialize database connection
	if err := db.initializeDatabase(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// Initialize Redis connection
	if err := db.initializeRedis(); err != nil {
		db.logger.Warnf("Failed to initialize Redis: %v", err)
		// Redis is optional, so we don't fail completely
	}

	// Initialize repository manager
	db.repositories = repository.NewDatabaseManager(db.db, db.redis)

	// Start health monitoring
	go db.startHealthMonitoring()

	db.logger.Info("GORM database manager initialized successfully")
	return db, nil
}

// initializeDatabase initializes the main database connection
func (d *GormDatabase) initializeDatabase() error {
	var err error
	var attempts int

	for attempts < d.config.MaxRetries {
		err = d.connectDatabase()
		if err == nil {
			break
		}

		attempts++
		if attempts < d.config.MaxRetries {
			backoff := 1 << (attempts - 1)
			delay := time.Duration(float64(d.config.RetryDelay) *
				float64(backoff) * d.config.RetryBackoff)
			d.logger.Warnf("Database connection attempt %d failed: %v, retrying in %v",
				attempts, err, delay)
			time.Sleep(delay)
		}
	}

	if err != nil {
		return fmt.Errorf("failed to connect after %d attempts: %w", attempts, err)
	}

	// Configure connection pool
	sqlDB, err := d.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(d.config.MaxOpenConns)
	sqlDB.SetMaxIdleConns(d.config.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(d.config.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(d.config.ConnMaxIdleTime)

	d.logger.Infof("Database connection pool configured: max_open=%d, max_idle=%d, max_lifetime=%v, max_idle_time=%v",
		d.config.MaxOpenConns, d.config.MaxIdleConns,
		d.config.ConnMaxLifetime, d.config.ConnMaxIdleTime)

	return nil
}

// connectDatabase establishes the database connection
func (d *GormDatabase) connectDatabase() error {
	dsn := d.buildDSN()

	// Configure GORM logger
	var gormLogger logger.Interface
	if d.config.EnableLogging {
		gormLogger = logger.New(
			&logrusWriter{logger: d.logger},
			logger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  logger.Info,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		)
	} else {
		gormLogger = logger.Default.LogMode(logger.Silent)
	}

	// Open database connection
	var err error
	d.db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})

	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	sqlDB, err := d.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	d.logger.Info("Database connection established successfully")
	return nil
}

// buildDSN builds the data source name for PostgreSQL
func (d *GormDatabase) buildDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		d.config.Host,
		d.config.Port,
		d.config.User,
		d.config.Password,
		d.config.DBName,
		d.config.SSLMode,
		d.config.TimeZone,
	)
}

// initializeRedis initializes the Redis connection
func (d *GormDatabase) initializeRedis() error {
	d.redis = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", d.config.RedisHost, d.config.RedisPort),
		Password:     d.config.RedisPassword,
		DB:           d.config.RedisDB,
		PoolSize:     d.config.RedisPoolSize,
		MinIdleConns: 2,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(d.ctx, 5*time.Second)
	defer cancel()

	if err := d.redis.Ping(ctx).Err(); err != nil {
		d.redis = nil
		return fmt.Errorf("failed to ping Redis: %w", err)
	}

	d.logger.Info("Redis connection established successfully")
	return nil
}

// startHealthMonitoring starts the health monitoring routine
func (d *GormDatabase) startHealthMonitoring() {
	ticker := time.NewTicker(d.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			d.logger.Info("Health monitoring stopped")
			return
		case <-ticker.C:
			d.performHealthCheck()
		}
	}
}

// performHealthCheck performs a comprehensive health check
func (d *GormDatabase) performHealthCheck() {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.healthStatus.LastCheck = time.Now()
	checks := make(map[string]CheckResult)

	// Check database connection
	dbStatus := d.checkDatabase()
	checks["database"] = dbStatus
	d.healthStatus.DatabaseStatus = ConnectionStatus{
		Connected:         dbStatus.Passed,
		ResponseTime:      dbStatus.ResponseTime,
		LastError:         dbStatus.Error,
		LastChecked:       time.Now(),
		ConsecutiveErrors: d.consecutiveErrors("database", dbStatus.Passed),
	}

	// Check Redis connection if available
	if d.redis != nil {
		redisStatus := d.checkRedis()
		checks["redis"] = redisStatus
		d.healthStatus.RedisStatus = ConnectionStatus{
			Connected:         redisStatus.Passed,
			ResponseTime:      redisStatus.ResponseTime,
			LastError:         redisStatus.Error,
			LastChecked:       time.Now(),
			ConsecutiveErrors: d.consecutiveErrors("redis", redisStatus.Passed),
		}
	} else {
		checks["redis"] = CheckResult{
			Passed:  true,
			Message: "Redis not configured",
		}
		d.healthStatus.RedisStatus = ConnectionStatus{
			Connected:   false,
			LastChecked: time.Now(),
		}
	}

	// Check connection pool stats
	d.healthStatus.ConnectionStats = d.getConnectionStats()

	// Determine overall health status
	allPassed := true
	var errorMsgs []string

	for name, check := range checks {
		if !check.Passed {
			allPassed = false
			errorMsgs = append(errorMsgs, fmt.Sprintf("%s: %s", name, check.Error))
		}
	}

	d.healthStatus.IsHealthy = allPassed
	d.healthStatus.Checks = checks

	if allPassed {
		d.healthStatus.OverallStatus = "healthy"
		d.healthStatus.Error = ""
	} else {
		d.healthStatus.OverallStatus = "unhealthy"
		d.healthStatus.Error = fmt.Sprintf("Health checks failed: %v", errorMsgs)
	}

	// Log health status changes
	if d.healthStatus.IsHealthy {
		d.logger.Debug("Database health check passed")
	} else {
		d.logger.Warnf("Database health check failed: %s", d.healthStatus.Error)
	}
}

// checkDatabase performs a database health check
func (d *GormDatabase) checkDatabase() CheckResult {
	start := time.Now()

	ctx, cancel := context.WithTimeout(d.ctx, d.config.HealthCheckTimeout)
	defer cancel()

	sqlDB, err := d.db.DB()
	if err != nil {
		return CheckResult{
			Passed:  false,
			Error:   fmt.Sprintf("Failed to get sql.DB: %v", err),
			Message: "Failed to get database connection",
		}
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return CheckResult{
			Passed:       false,
			ResponseTime: time.Since(start),
			Error:        fmt.Sprintf("Ping failed: %v", err),
			Message:      "Database ping failed",
		}
	}

	// Test a simple query
	var result int
	if err := d.db.WithContext(ctx).Raw("SELECT 1").Scan(&result).Error; err != nil {
		return CheckResult{
			Passed:       false,
			ResponseTime: time.Since(start),
			Error:        fmt.Sprintf("Query failed: %v", err),
			Message:      "Database query failed",
		}
	}

	return CheckResult{
		Passed:       true,
		ResponseTime: time.Since(start),
		Message:      "Database connection healthy",
	}
}

// checkRedis performs a Redis health check
func (d *GormDatabase) checkRedis() CheckResult {
	start := time.Now()

	ctx, cancel := context.WithTimeout(d.ctx, d.config.HealthCheckTimeout)
	defer cancel()

	if err := d.redis.Ping(ctx).Err(); err != nil {
		return CheckResult{
			Passed:       false,
			ResponseTime: time.Since(start),
			Error:        fmt.Sprintf("Redis ping failed: %v", err),
			Message:      "Redis connection failed",
		}
	}

	return CheckResult{
		Passed:       true,
		ResponseTime: time.Since(start),
		Message:      "Redis connection healthy",
	}
}

// consecutiveErrors calculates consecutive errors for a service
func (d *GormDatabase) consecutiveErrors(service string, currentCheckPassed bool) int {
	// This would require maintaining state across checks
	// For now, return 0 if passed, 1 if failed
	if currentCheckPassed {
		return 0
	}
	return 1
}

// getConnectionStats retrieves database connection statistics
func (d *GormDatabase) getConnectionStats() repository.ConnectionStats {
	sqlDB, err := d.db.DB()
	if err != nil {
		d.logger.Errorf("Failed to get sql.DB for stats: %v", err)
		return repository.ConnectionStats{}
	}

	stats := sqlDB.Stats()

	// Get database size (this is a simplified version)
	var dbSize, indexSize int64
	d.db.Raw("SELECT pg_database_size(current_database())").Scan(&dbSize)
	d.db.Raw("SELECT pg_indexes_size(current_database())").Scan(&indexSize)

	return repository.ConnectionStats{
		OpenConnections:    stats.OpenConnections,
		IdleConnections:    stats.Idle,
		MaxConnections:     stats.MaxOpenConnections,
		WaitingConnections: int(stats.WaitCount),
		AverageQueryTime:   0, // Would need to implement query timing
		QueriesPerSecond:   0, // Would need to implement query rate tracking
		DatabaseSize:       dbSize,
		IndexSize:          indexSize,
	}
}

// Public methods

// GetDB returns the GORM database instance
func (d *GormDatabase) GetDB() *gorm.DB {
	return d.db
}

// GetPgxPool returns the pgx connection pool
func (d *GormDatabase) GetPgxPool() *pgxpool.Pool {
	return d.pgxPool
}

// GetRedis returns the Redis client
func (d *GormDatabase) GetRedis() *redis.Client {
	return d.redis
}

// GetRepositories returns the repository manager
func (d *GormDatabase) GetRepositories() repository.DatabaseManager {
	return d.repositories
}

// HealthCheck performs an immediate health check
func (d *GormDatabase) HealthCheck(ctx context.Context) error {
	d.performHealthCheck()

	d.mu.RLock()
	defer d.mu.RUnlock()

	if !d.healthStatus.IsHealthy {
		return fmt.Errorf("database unhealthy: %s", d.healthStatus.Error)
	}

	return nil
}

// GetHealthStatus returns the current health status
func (d *GormDatabase) GetHealthStatus() HealthStatus {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return *d.healthStatus
}

// WithTenant returns a database instance scoped to a tenant
func (d *GormDatabase) WithTenant(tenantID string) *gorm.DB {
	return d.db.WithContext(d.ctx).Where("tenant_id = ?", tenantID)
}

// WithUser returns a database instance scoped to a user
func (d *GormDatabase) WithUser(userID string) *gorm.DB {
	return d.db.WithContext(d.ctx).Where("user_id = ?", userID)
}

// BeginTx begins a new transaction
func (d *GormDatabase) BeginTx(ctx context.Context) (*gorm.DB, error) {
	tx := d.db.Begin()
	return tx, tx.Error
}

// Close closes the database connections
func (d *GormDatabase) Close() error {
	d.logger.Info("Closing database connections")

	// Stop health monitoring
	d.cancel()

	// Close database connection
	if d.db != nil {
		sqlDB, err := d.db.DB()
		if err == nil {
			if err := sqlDB.Close(); err != nil {
				d.logger.Errorf("Error closing database: %v", err)
				return err
			}
		}
	}

	// Close pgx pool if set
	if d.pgxPool != nil {
		d.pgxPool.Close()
	}

	// Close Redis connection
	if d.redis != nil {
		if err := d.redis.Close(); err != nil {
			d.logger.Errorf("Error closing Redis: %v", err)
			return err
		}
	}

	d.logger.Info("Database connections closed")
	return nil
}

// RunMigrations runs database migrations
func (d *GormDatabase) RunMigrations() error {
	d.logger.Info("Running database migrations")

	// This would integrate with the migration system
	// For now, we'll auto-migrate the models
	if err := d.db.AutoMigrate(
	// Add all model types here
	); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	d.logger.Info("Database migrations completed successfully")
	return nil
}

// WithRetry executes a function with retry logic
func (d *GormDatabase) WithRetry(ctx context.Context, fn func() error) error {
	var lastErr error

	for attempt := 0; attempt < d.config.MaxRetries; attempt++ {
		if attempt > 0 {
			backoff := 1 << (attempt - 1)
			delay := time.Duration(float64(d.config.RetryDelay) *
				float64(backoff) * d.config.RetryBackoff)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
				// Continue with retry
			}
		}

		if err := fn(); err != nil {
			lastErr = err
			d.logger.Debugf("Database operation attempt %d failed: %v", attempt+1, err)
			continue
		}

		// Success
		if attempt > 0 {
			d.logger.Debugf("Database operation succeeded after %d attempts", attempt+1)
		}
		return nil
	}

	return fmt.Errorf("operation failed after %d attempts: %w", d.config.MaxRetries, lastErr)
}

// SetPgxPool sets the pgx connection pool
func (d *GormDatabase) SetPgxPool(pool *pgxpool.Pool) {
	d.pgxPool = pool
}
