package container

import (
	"database/sql"
	"fmt"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/config"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/database"
	"github.com/queryflux/backend/internal/infrastructure/lemonsqueezy"
	"github.com/queryflux/backend/internal/infrastructure/metrics"
	"github.com/queryflux/backend/internal/infrastructure/repositories/postgres"
	"github.com/queryflux/backend/internal/services"
	"go.uber.org/zap"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// Container holds all application dependencies
type Container struct {
	// Configuration
	Config *config.Config

	// Database connections
	DB       *pgxpool.Pool
	LegacyDB *sql.DB // Temporary: for repositories not yet migrated to pgxpool
	Redis    *redis.Client

	// Repositories
	UserRepository         repositories.UserRepository
	SessionRepository      repositories.SessionRepository
	ConnectionRepository   repositories.ConnectionRepository
	QueryRepository        repositories.QueryRepository
	MetricsRepository      repositories.MetricsRepository
	AlertRepository        repositories.AlertRepository
	SubscriptionRepository repositories.SubscriptionRepository
	CustomerRepository     repositories.CustomerRepository
	InvoiceRepository      repositories.InvoiceRepository

	// Services
	UserService         services.UserService
	ConnectionService   services.ConnectionService
	QueryService        services.QueryService
	MetricsService      services.MetricsService
	AlertService        services.AlertService
	AuthService         services.AuthService
	DatabaseService     services.DatabaseService
	SubscriptionService services.SubscriptionService
	LemonSqueezyService *services.LemonSqueezyService
	AIService           ports.AIService

	// Infrastructure
	DatabaseManager    *database.Manager
	MetricsCollector   *metrics.Metrics
	MonitoringService  ports.MonitoringService
	LemonSqueezyClient *lemonsqueezy.Client
	Logger             *zap.Logger
}

// NewContainer creates and initializes a new dependency injection container
func NewContainer(cfg *config.Config) (*Container, error) {
	container := &Container{
		Config: cfg,
	}

	// Initialize database connections
	if err := container.initDatabases(); err != nil {
		return nil, fmt.Errorf("failed to initialize databases: %w", err)
	}

	// Initialize repositories
	container.initRepositories()

	// Initialize infrastructure
	if err := container.initInfrastructure(); err != nil {
		return nil, fmt.Errorf("failed to initialize infrastructure: %w", err)
	}

	// Initialize monitoring adapter
	container.MonitoringService = metrics.NewMonitoringServiceAdapter(container.MetricsCollector)

	// Initialize services
	if err := container.initServices(); err != nil {
		return nil, fmt.Errorf("failed to initialize services: %w", err)
	}

	logrus.Info("Dependency injection container initialized successfully")
	return container, nil
}

// Close closes all database connections and cleans up resources
func (c *Container) Close() error {
	var errors []error

	if c.DB != nil {
		c.DB.Close()
	}

	if c.LegacyDB != nil {
		if err := c.LegacyDB.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close legacy database: %w", err))
		}
	}

	if c.Redis != nil {
		if err := c.Redis.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close Redis: %w", err))
		}
	}

	if c.DatabaseManager != nil {
		if err := c.DatabaseManager.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close database manager: %w", err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors during container cleanup: %v", errors)
	}

	logrus.Info("Container closed successfully")
	return nil
}

// initDatabases initializes database connections
func (c *Container) initDatabases() error {
	// Initialize PostgreSQL connection pool (pgxpool)
	db, err := database.NewPostgreSQLConnection(c.Config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}
	c.DB = db

	// Initialize legacy SQL connection (temporary until all repos migrated to pgxpool)
	legacyDB, err := sql.Open("pgx", c.Config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to create legacy database connection: %w", err)
	}
	if err := legacyDB.Ping(); err != nil {
		legacyDB.Close()
		return fmt.Errorf("failed to ping legacy database: %w", err)
	}
	c.LegacyDB = legacyDB

	// Initialize Redis connection
	redisClient, err := database.NewRedisConnection(c.Config.RedisURL)
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}
	c.Redis = redisClient

	logrus.Info("Database connections initialized")
	return nil
}

// initRepositories initializes repository implementations
func (c *Container) initRepositories() {
	// New repositories using pgxpool
	c.UserRepository = postgres.NewUserRepository(c.DB)
	c.SessionRepository = postgres.NewSessionRepository(c.DB)

	// Legacy repositories using sql.DB (to be migrated to pgxpool)
	c.ConnectionRepository = postgres.NewConnectionRepository(c.LegacyDB)
	c.QueryRepository = postgres.NewQueryRepository(c.LegacyDB)
	c.MetricsRepository = postgres.NewMetricsRepository(c.LegacyDB)
	c.AlertRepository = postgres.NewAlertRepository(c.LegacyDB)

	// Subscription repositories using pgxpool
	c.SubscriptionRepository = postgres.NewSubscriptionRepository(c.DB)
	c.CustomerRepository = postgres.NewCustomerRepository(c.DB)
	c.InvoiceRepository = postgres.NewInvoiceRepository(c.DB)

	logrus.Info("Repositories initialized")
}

// initServices initializes service implementations
func (c *Container) initServices() error {
	// Initialize services with their dependencies
	c.UserService = services.NewUserService(c.UserRepository)
	c.ConnectionService = services.NewConnectionService(c.ConnectionRepository, c.UserRepository)
	c.QueryService = services.NewQueryService(c.QueryRepository, c.ConnectionRepository)
	c.MetricsService = services.NewMetricsService(c.MetricsRepository, c.AlertRepository, c.ConnectionRepository)
	c.AlertService = services.NewAlertService(c.AlertRepository, c.UserRepository, c.ConnectionRepository)

	// Initialize auth service with JWT configuration
	authService, err := services.NewAuthService(c.UserRepository, c.SessionRepository, c.Redis, c.Config.JWTSecret, int(c.Config.JWTExpiration.Hours()))
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}
	c.AuthService = authService

	// Initialize Lemon Squeezy service
	c.LemonSqueezyService = services.NewLemonSqueezyService(
		c.Config.LemonSqueezyAPIKey,
		c.Config.LemonSqueezyStoreID,
		c.Logger,
	)

	// Initialize Subscription service
	c.SubscriptionService = services.NewSubscriptionService(
		c.SubscriptionRepository,
		c.CustomerRepository,
		c.InvoiceRepository,
		c.LemonSqueezyClient,
		c.Logger,
	)

	// Initialize AI service with API keys and monitoring
	aiService, err := services.NewAIService(c.Config.OpenAIAPIKey, c.Config.ClaudeAPIKey, c.Config.OpenHandsURL, c.MonitoringService)
	if err != nil {
		return fmt.Errorf("failed to initialize AI service: %w", err)
	}
	c.AIService = aiService

	logrus.Info("Services initialized")
	return nil
}

// initInfrastructure initializes infrastructure components
func (c *Container) initInfrastructure() error {
	// Initialize logger
	logger, _ := zap.NewProduction()
	c.Logger = logger

	// Initialize metrics collector
	m := metrics.New()
	if err := m.Register(); err != nil {
		return fmt.Errorf("failed to register metrics: %w", err)
	}
	c.MetricsCollector = m

	// Initialize database manager for handling multiple database connections
	manager, err := database.NewManager()
	if err != nil {
		return fmt.Errorf("failed to initialize database manager: %w", err)
	}
	c.DatabaseManager = manager

	// Initialize database service with the manager
	c.DatabaseService = services.NewDatabaseService(c.DatabaseManager, c.ConnectionRepository)

	// Initialize Lemon Squeezy client
	lsConfig := &lemonsqueezy.Config{
		APIKey:        c.Config.LemonSqueezyAPIKey,
		StoreID:       c.Config.LemonSqueezyStoreID,
		WebhookSecret: c.Config.LemonSqueezyWebhookSecret,
	}
	c.LemonSqueezyClient = lemonsqueezy.NewClient(lsConfig, c.Logger)

	logrus.Info("Infrastructure initialized")
	return nil
}

// GetLemonSqueezyService returns the Lemon Squeezy service
func (c *Container) GetLemonSqueezyService() *services.LemonSqueezyService {
	return c.LemonSqueezyService
}

// GetUserService returns the user service
func (c *Container) GetUserService() services.UserService {
	return c.UserService
}

// GetConnectionService returns the connection service
func (c *Container) GetConnectionService() services.ConnectionService {
	return c.ConnectionService
}

// GetQueryService returns the query service
func (c *Container) GetQueryService() services.QueryService {
	return c.QueryService
}

// GetMetricsService returns the metrics service
func (c *Container) GetMetricsService() services.MetricsService {
	return c.MetricsService
}

// GetAlertService returns the alert service
func (c *Container) GetAlertService() services.AlertService {
	return c.AlertService
}

// GetAuthService returns the auth service
func (c *Container) GetAuthService() services.AuthService {
	return c.AuthService
}

// GetDatabaseService returns the database service
func (c *Container) GetDatabaseService() services.DatabaseService {
	return c.DatabaseService
}

// GetAIService returns the AI service
func (c *Container) GetAIService() ports.AIService {
	return c.AIService
}

// GetSubscriptionService returns the subscription service
func (c *Container) GetSubscriptionService() services.SubscriptionService {
	return c.SubscriptionService
}

// GetDatabaseManager returns the database manager
func (c *Container) GetDatabaseManager() *database.Manager {
	return c.DatabaseManager
}

// GetMonitoringService returns the monitoring service
func (c *Container) GetMonitoringService() ports.MonitoringService {
	return c.MonitoringService
}
