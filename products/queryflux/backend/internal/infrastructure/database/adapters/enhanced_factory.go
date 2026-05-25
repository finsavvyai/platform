package adapters

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/base"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/cache"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// EnhancedFactory is an enhanced factory for creating database adapters with additional features
type EnhancedFactory struct {
	logger        *logrus.Logger
	poolManager   *base.ConnectionPoolManager
	adapterCache  map[string]types.DatabaseAdapter
	cacheMutex    sync.RWMutex
	config        FactoryConfig
	registry      map[string]AdapterConstructor
	registryMutex sync.RWMutex
}

// FactoryConfig contains configuration for the enhanced factory
type FactoryConfig struct {
	EnableCaching       bool          `json:"enable_caching"`
	EnablePooling       bool          `json:"enable_pooling"`
	DefaultTimeout      time.Duration `json:"default_timeout"`
	HealthCheckInterval time.Duration `json:"health_check_interval"`
	MaxCacheSize        int           `json:"max_cache_size"`
	CacheTTL            time.Duration `json:"cache_ttl"`
}

// AdapterConstructor defines the function signature for creating adapters
type AdapterConstructor func(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error)

// AdapterMetadata contains metadata about an adapter
type AdapterMetadata struct {
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Version         string            `json:"version"`
	SupportedTypes  []string          `json:"supported_types"`
	Features        []string          `json:"features"`
	RequiredOptions map[string]string `json:"required_options"`
	OptionalOptions map[string]string `json:"optional_options"`
}

// NewEnhancedFactory creates a new enhanced adapter factory
func NewEnhancedFactory(config FactoryConfig, logger *logrus.Logger) *EnhancedFactory {
	if logger == nil {
		logger = logrus.New()
		logger.SetLevel(logrus.InfoLevel)
	}

	// Set default configuration
	if config.DefaultTimeout == 0 {
		config.DefaultTimeout = time.Second * 30
	}
	if config.HealthCheckInterval == 0 {
		config.HealthCheckInterval = time.Minute * 5
	}
	if config.MaxCacheSize == 0 {
		config.MaxCacheSize = 100
	}
	if config.CacheTTL == 0 {
		config.CacheTTL = time.Hour
	}

	factory := &EnhancedFactory{
		logger:       logger,
		adapterCache: make(map[string]types.DatabaseAdapter),
		config:       config,
		registry:     make(map[string]AdapterConstructor),
	}

	// Initialize pool manager if pooling is enabled
	if config.EnablePooling {
		factory.poolManager = base.NewConnectionPoolManager(logger)
	}

	// Register built-in adapters
	factory.registerBuiltInAdapters()

	// Start background routines
	if config.EnableCaching {
		go factory.cacheCleanupRoutine()
	}
	if config.EnablePooling {
		go factory.healthCheckRoutine()
	}

	return factory
}

// registerBuiltInAdapters registers all built-in adapters
func (f *EnhancedFactory) registerBuiltInAdapters() {
	// SQL Database Adapters
	f.RegisterAdapter("postgresql", f.createPostgreSQLAdapter, AdapterMetadata{
		Name:        "PostgreSQL",
		Description: "PostgreSQL relational database adapter",
		Version:     "1.0.0",
		SupportedTypes: []string{
			entities.TypePostgreSQL,
		},
		Features: []string{
			"transactions", "connection_pooling", "ssl", "replication",
		},
		RequiredOptions: map[string]string{},
		OptionalOptions: map[string]string{
			"sslmode":         "require",
			"max_open_conns":  "10",
			"max_idle_conns":  "2",
			"connect_timeout": "10s",
		},
	})

	f.RegisterAdapter("mysql", f.createMySQLAdapter, AdapterMetadata{
		Name:        "MySQL",
		Description: "MySQL relational database adapter",
		Version:     "1.0.0",
		SupportedTypes: []string{
			entities.TypeMySQL,
		},
		Features: []string{
			"transactions", "connection_pooling", "ssl", "replication",
		},
		RequiredOptions: map[string]string{},
		OptionalOptions: map[string]string{
			"parse_time":      "true",
			"charset":         "utf8mb4",
			"max_open_conns":  "10",
			"max_idle_conns":  "2",
			"connect_timeout": "10s",
		},
	})

	f.RegisterAdapter("mongodb", f.createMongoDBAdapter, AdapterMetadata{
		Name:        "MongoDB",
		Description: "MongoDB document database adapter",
		Version:     "1.0.0",
		SupportedTypes: []string{
			entities.TypeMongoDB,
		},
		Features: []string{
			"document_storage", "aggregation", "indexing", "replica_set", "sharding",
		},
		RequiredOptions: map[string]string{},
		OptionalOptions: map[string]string{
			"replica_set":     "",
			"max_pool_size":   "10",
			"min_pool_size":   "2",
			"connect_timeout": "10s",
		},
	})

	f.RegisterAdapter("redis", f.createRedisAdapter, AdapterMetadata{
		Name:        "Redis",
		Description: "Redis key-value store adapter",
		Version:     "1.0.0",
		SupportedTypes: []string{
			entities.TypeRedis,
		},
		Features: []string{
			"key_value", "pubsub", "transactions", "clustering", "persistence",
		},
		RequiredOptions: map[string]string{},
		OptionalOptions: map[string]string{
			"db":             "0",
			"pool_size":      "10",
			"min_idle_conns": "2",
			"dial_timeout":   "5s",
			"read_timeout":   "3s",
			"write_timeout":  "3s",
			"cluster_mode":   "false",
		},
	})

	// Register other database types...
	f.registerAdditionalAdapters()
}

// registerAdditionalAdapters registers additional built-in adapters
func (f *EnhancedFactory) registerAdditionalAdapters() {
	// Add more adapters as needed
	// This is a placeholder for additional adapter registrations
}

// RegisterAdapter registers a new adapter constructor
func (f *EnhancedFactory) RegisterAdapter(name string, constructor AdapterConstructor, metadata AdapterMetadata) error {
	f.registryMutex.Lock()
	defer f.registryMutex.Unlock()

	if _, exists := f.registry[name]; exists {
		return fmt.Errorf("adapter %s is already registered", name)
	}

	f.registry[name] = constructor
	f.logger.Infof("Registered adapter: %s (%s)", name, metadata.Description)

	return nil
}

// UnregisterAdapter unregisters an adapter
func (f *EnhancedFactory) UnregisterAdapter(name string) error {
	f.registryMutex.Lock()
	defer f.registryMutex.Unlock()

	if _, exists := f.registry[name]; !exists {
		return fmt.Errorf("adapter %s is not registered", name)
	}

	delete(f.registry, name)
	f.logger.Infof("Unregistered adapter: %s", name)

	return nil
}

// GetRegisteredAdapters returns a list of registered adapter names
func (f *EnhancedFactory) GetRegisteredAdapters() []string {
	f.registryMutex.RLock()
	defer f.registryMutex.RUnlock()

	adapters := make([]string, 0, len(f.registry))
	for name := range f.registry {
		adapters = append(adapters, name)
	}

	return adapters
}

// GetAdapterMetadata returns metadata for a registered adapter
func (f *EnhancedFactory) GetAdapterMetadata(name string) (AdapterMetadata, error) {
	f.registryMutex.RLock()
	defer f.registryMutex.RUnlock()

	// For now, return basic metadata. In a full implementation,
	// we would store metadata when registering adapters.
	return AdapterMetadata{
		Name:    name,
		Version: "1.0.0",
	}, nil
}

// CreateAdapter creates a database adapter for the given connection
func (f *EnhancedFactory) CreateAdapter(conn *entities.Connection) (types.DatabaseAdapter, error) {
	if conn == nil {
		return nil, types.NewAdapterError(types.ErrCodeInternalError, "connection is nil", "")
	}

	// Generate cache key
	cacheKey := f.generateCacheKey(conn)

	// Check cache first if enabled
	if f.config.EnableCaching {
		f.cacheMutex.RLock()
		if cachedAdapter, exists := f.adapterCache[cacheKey]; exists {
			f.cacheMutex.RUnlock()

			// Validate cached adapter
			if cachedAdapter.IsConnected() {
				f.logger.Debugf("Using cached adapter for %s", cacheKey)
				return cachedAdapter, nil
			}

			// Remove stale cache entry
			f.cacheMutex.Lock()
			delete(f.adapterCache, cacheKey)
			f.cacheMutex.Unlock()
		} else {
			f.cacheMutex.RUnlock()
		}
	}

	// Create new adapter
	adapter, err := f.createAdapterInternal(conn)
	if err != nil {
		return nil, err
	}

	// Cache the adapter if enabled
	if f.config.EnableCaching {
		f.cacheMutex.Lock()
		f.adapterCache[cacheKey] = adapter
		f.cacheMutex.Unlock()

		f.logger.Debugf("Cached adapter for %s", cacheKey)
	}

	return adapter, nil
}

// createAdapterInternal creates an adapter without caching
func (f *EnhancedFactory) createAdapterInternal(conn *entities.Connection) (types.DatabaseAdapter, error) {
	// Determine adapter name based on connection type
	adapterName := f.getAdapterNameForConnectionType(conn.Type)

	f.registryMutex.RLock()
	constructor, exists := f.registry[adapterName]
	f.registryMutex.RUnlock()

	if !exists {
		return nil, types.NewAdapterError(
			types.ErrCodeUnsupportedOperation,
			"Unsupported database type",
			conn.Type,
		).WithContext("requested_type", conn.Type)
	}

	// Create adapter with timeout considerations if needed
	// Note: constructors don't take context currently

	adapter, err := constructor(conn, f.logger)
	if err != nil {
		return nil, types.NewAdapterError(
			types.ErrCodeConnectionFailed,
			"Failed to create adapter",
			err.Error(),
		).WithContext("connection_type", conn.Type)
	}

	return adapter, nil
}

// getAdapterNameForConnectionType maps connection types to adapter names
func (f *EnhancedFactory) getAdapterNameForConnectionType(connType string) string {
	// Mapping from connection types to adapter names
	typeMapping := map[string]string{
		entities.TypePostgreSQL: "postgresql",
		entities.TypeMySQL:      "mysql",
		entities.TypeMariaDB:    "mysql", // MySQL adapter can handle MariaDB
		entities.TypeMongoDB:    "mongodb",
		entities.TypeRedis:      "redis",
		entities.TypeSQLite:     "sqlite",
		entities.TypeSQLServer:  "sqlserver",
		entities.TypeOracle:     "oracle",
		entities.TypeCassandra:  "cassandra",
		entities.TypeCouchDB:    "couchdb",
		entities.TypeNeo4j:      "neo4j",
		entities.TypeArangoDB:   "arangodb",
	}

	if adapterName, exists := typeMapping[connType]; exists {
		return adapterName
	}

	// Default to connection type as adapter name
	return connType
}

// Adapter constructor functions
func (f *EnhancedFactory) createPostgreSQLAdapter(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
	adapter := sql.NewPostgreSQLAdapter(conn, logger)
	// In a full implementation, we would wrap this with enhanced functionality
	return adapter, nil
}

func (f *EnhancedFactory) createMySQLAdapter(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
	adapter := sql.NewMySQLAdapter(conn, logger)
	return adapter, nil
}

func (f *EnhancedFactory) createMongoDBAdapter(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
	adapter := nosql.NewMongoDBAdapter(conn, logger)
	return adapter, nil
}

func (f *EnhancedFactory) createRedisAdapter(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
	adapter := cache.NewRedisAdapter(conn, logger)
	return adapter, nil
}

// generateCacheKey generates a unique cache key for a connection
func (f *EnhancedFactory) generateCacheKey(conn *entities.Connection) string {
	return fmt.Sprintf("%s://%s:%d/%s", conn.Type, conn.Host, conn.Port, conn.Database)
}

// cacheCleanupRoutine periodically cleans up expired cache entries
func (f *EnhancedFactory) cacheCleanupRoutine() {
	ticker := time.NewTicker(time.Minute * 10)
	defer ticker.Stop()

	for range ticker.C {
		f.cleanupCache()
	}
}

// cleanupCache removes expired and stale cache entries
func (f *EnhancedFactory) cleanupCache() {
	f.cacheMutex.Lock()
	defer f.cacheMutex.Unlock()

	if len(f.adapterCache) <= f.config.MaxCacheSize {
		return
	}

	// Remove disconnected adapters
	for key, adapter := range f.adapterCache {
		if !adapter.IsConnected() {
			delete(f.adapterCache, key)
			f.logger.Debugf("Removed disconnected adapter from cache: %s", key)
		}
	}

	// If still over limit, remove oldest entries (LRU)
	for len(f.adapterCache) > f.config.MaxCacheSize {
		// Simple LRU: remove first entry
		// In a production system, you'd want more sophisticated LRU tracking
		for key := range f.adapterCache {
			delete(f.adapterCache, key)
			f.logger.Debugf("Removed adapter from cache (LRU): %s", key)
			break
		}
	}
}

// healthCheckRoutine performs periodic health checks
func (f *EnhancedFactory) healthCheckRoutine() {
	if f.poolManager == nil {
		return
	}

	ticker := time.NewTicker(f.config.HealthCheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
		f.poolManager.HealthCheck(ctx)
		cancel()
	}
}

// GetStats returns factory statistics
func (f *EnhancedFactory) GetStats() FactoryStats {
	f.cacheMutex.RLock()
	cachedAdapters := len(f.adapterCache)
	f.cacheMutex.RUnlock()

	stats := FactoryStats{
		RegisteredAdapters: f.GetRegisteredAdapters(),
		CachedAdapters:     cachedAdapters,
		MaxCacheSize:       f.config.MaxCacheSize,
		CacheEnabled:       f.config.EnableCaching,
		PoolingEnabled:     f.config.EnablePooling,
	}

	if f.poolManager != nil {
		stats.PoolStats = f.poolManager.GetStats()
	}

	return stats
}

// FactoryStats contains factory statistics
type FactoryStats struct {
	RegisteredAdapters []string        `json:"registered_adapters"`
	CachedAdapters     int             `json:"cached_adapters"`
	MaxCacheSize       int             `json:"max_cache_size"`
	CacheEnabled       bool            `json:"cache_enabled"`
	PoolingEnabled     bool            `json:"pooling_enabled"`
	PoolStats          *base.PoolStats `json:"pool_stats,omitempty"`
}

// Close shuts down the enhanced factory
func (f *EnhancedFactory) Close() error {
	f.logger.Info("Shutting down enhanced adapter factory")

	// Close all cached adapters
	f.cacheMutex.Lock()
	for key, adapter := range f.adapterCache {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		if err := adapter.Disconnect(ctx); err != nil {
			f.logger.Errorf("Error disconnecting cached adapter %s: %v", key, err)
		}
		cancel()
	}
	f.adapterCache = make(map[string]types.DatabaseAdapter)
	f.cacheMutex.Unlock()

	// Close pool manager
	if f.poolManager != nil {
		f.poolManager.Close()
	}

	f.logger.Info("Enhanced adapter factory shutdown complete")
	return nil
}
