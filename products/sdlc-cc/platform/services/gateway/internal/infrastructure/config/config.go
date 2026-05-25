package config

import (
	"fmt"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	Server         ServerConfig         `mapstructure:"server" yaml:"server"`
	Database       DatabaseConfig       `mapstructure:"database" yaml:"database"`
	Redis          RedisConfig          `mapstructure:"redis" yaml:"redis"`
	JWT            JWTConfig            `mapstructure:"jwt" yaml:"jwt"`
	Logging        LoggingConfig        `mapstructure:"logging" yaml:"logging"`
	Monitoring     MonitoringConfig     `mapstructure:"monitoring" yaml:"monitoring"`
	Security       SecurityConfig       `mapstructure:"security" yaml:"security"`
	Cloudflare     CloudflareConfig     `mapstructure:"cloudflare" yaml:"cloudflare"`
	Version        string               `mapstructure:"version" yaml:"version"`
	Environment    string               `mapstructure:"environment" yaml:"environment"`
	InstanceID     string               `mapstructure:"instance_id" yaml:"instance_id"`
	GitCommit      string               `mapstructure:"git_commit" yaml:"git_commit"`
	BuildTime      string               `mapstructure:"build_time" yaml:"build_time"`
	StartTime      time.Time            `mapstructure:"-" yaml:"-"`
	Tracing        TracingConfig        `mapstructure:"tracing" yaml:"tracing"`
	CORS           CORSConfig           `mapstructure:"cors" yaml:"cors"`
	RateLimit      RateLimitConfig      `mapstructure:"rate_limit" yaml:"rate_limit"`
	CircuitBreaker CircuitBreakerConfig `mapstructure:"circuit_breaker" yaml:"circuit_breaker"`
	OPA            OPAConfig            `mapstructure:"opa" yaml:"opa"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Host                    string        `mapstructure:"host" yaml:"host"`
	Port                    int           `mapstructure:"port" yaml:"port"`
	ReadTimeout             time.Duration `mapstructure:"read_timeout" yaml:"read_timeout"`
	WriteTimeout            time.Duration `mapstructure:"write_timeout" yaml:"write_timeout"`
	IdleTimeout             time.Duration `mapstructure:"idle_timeout" yaml:"idle_timeout"`
	GracefulShutdownTimeout time.Duration `mapstructure:"graceful_shutdown_timeout" yaml:"graceful_shutdown_timeout"`
	LegacyShutdownTimeout   time.Duration `mapstructure:"shutdown_timeout" yaml:"shutdown_timeout"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
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
	MigrationPath     string        `mapstructure:"migration_path" yaml:"migration_path"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host         string        `mapstructure:"host" yaml:"host"`
	Port         int           `mapstructure:"port" yaml:"port"`
	Password     string        `mapstructure:"password" yaml:"password"`
	Database     int           `mapstructure:"database" yaml:"database"`
	PoolSize     int           `mapstructure:"pool_size" yaml:"pool_size"`
	MinIdleConns int           `mapstructure:"min_idle_conns" yaml:"min_idle_conns"`
	MaxRetries   int           `mapstructure:"max_retries" yaml:"max_retries"`
	DialTimeout  time.Duration `mapstructure:"dial_timeout" yaml:"dial_timeout"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout" yaml:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout" yaml:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout" yaml:"idle_timeout"`
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret           string        `mapstructure:"secret" yaml:"secret"`
	AccessTokenTTL   time.Duration `mapstructure:"access_token_ttl" yaml:"access_token_ttl"`
	RefreshTokenTTL  time.Duration `mapstructure:"refresh_token_ttl" yaml:"refresh_token_ttl"`
	Issuer           string        `mapstructure:"issuer" yaml:"issuer"`
	SigningAlgorithm string        `mapstructure:"signing_algorithm" yaml:"signing_algorithm"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `mapstructure:"level" yaml:"level"`
	Format     string `mapstructure:"format" yaml:"format"`
	Output     string `mapstructure:"output" yaml:"output"`
	File       string `mapstructure:"file" yaml:"file"`
	MaxSize    int    `mapstructure:"max_size" yaml:"max_size"`
	MaxAge     int    `mapstructure:"max_age" yaml:"max_age"`
	MaxBackups int    `mapstructure:"max_backups" yaml:"max_backups"`
	Compress   bool   `mapstructure:"compress" yaml:"compress"`
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Enabled    bool    `mapstructure:"enabled" yaml:"enabled"`
	Port       int     `mapstructure:"port" yaml:"port"`
	Path       string  `mapstructure:"path" yaml:"path"`
	Namespace  string  `mapstructure:"namespace" yaml:"namespace"`
	Subsystem  string  `mapstructure:"subsystem" yaml:"subsystem"`
	JaegerURL  string  `mapstructure:"jaeger_url" yaml:"jaeger_url"`
	SampleRate float64 `mapstructure:"sample_rate" yaml:"sample_rate"`
}

// SecurityConfig holds security configuration
type SecurityConfig struct {
	RateLimiting RateLimitingConfig `mapstructure:"rate_limiting" yaml:"rate_limiting"`
	CORS         CORSConfig         `mapstructure:"cors" yaml:"cors"`
	MTLS         MTLSConfig         `mapstructure:"mtls" yaml:"mtls"`
	Encryption   EncryptionConfig   `mapstructure:"encryption" yaml:"encryption"`
	DLP          DLPConfig          `mapstructure:"dlp" yaml:"dlp"`
}

// RateLimitingConfig holds rate limiting configuration
type RateLimitingConfig struct {
	Enabled          bool          `mapstructure:"enabled" yaml:"enabled"`
	DefaultRateLimit int           `mapstructure:"default_rate_limit" yaml:"default_rate_limit"`
	DefaultWindow    time.Duration `mapstructure:"default_window" yaml:"default_window"`
	BurstLimit       int           `mapstructure:"burst_limit" yaml:"burst_limit"`
	RedisKeyPrefix   string        `mapstructure:"redis_key_prefix" yaml:"redis_key_prefix"`
	CleanupInterval  time.Duration `mapstructure:"cleanup_interval" yaml:"cleanup_interval"`
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	Enabled          bool     `mapstructure:"enabled" yaml:"enabled"`
	AllowedOrigins   []string `mapstructure:"allowed_origins" yaml:"allowed_origins"`
	AllowedMethods   []string `mapstructure:"allowed_methods" yaml:"allowed_methods"`
	AllowedHeaders   []string `mapstructure:"allowed_headers" yaml:"allowed_headers"`
	ExposedHeaders   []string `mapstructure:"exposed_headers" yaml:"exposed_headers"`
	AllowCredentials bool     `mapstructure:"allow_credentials" yaml:"allow_credentials"`
	MaxAge           int      `mapstructure:"max_age" yaml:"max_age"`
}

// MTLSConfig holds mTLS configuration
type MTLSConfig struct {
	Enabled    bool   `mapstructure:"enabled" yaml:"enabled"`
	CertFile   string `mapstructure:"cert_file" yaml:"cert_file"`
	KeyFile    string `mapstructure:"key_file" yaml:"key_file"`
	CAFile     string `mapstructure:"ca_file" yaml:"ca_file"`
	ClientAuth bool   `mapstructure:"client_auth" yaml:"client_auth"`
	SkipVerify bool   `mapstructure:"skip_verify" yaml:"skip_verify"`
}

// EncryptionConfig holds encryption configuration
type EncryptionConfig struct {
	KeyRotationInterval time.Duration `mapstructure:"key_rotation_interval" yaml:"key_rotation_interval"`
	Algorithm           string        `mapstructure:"algorithm" yaml:"algorithm"`
	KeyDerivation       string        `mapstructure:"key_derivation" yaml:"key_derivation"`
}

// DLPConfig holds DLP configuration
type DLPConfig struct {
	Enabled             bool          `mapstructure:"enabled" yaml:"enabled"`
	Engines             []string      `mapstructure:"engines" yaml:"engines"`
	ConfidenceThreshold float64       `mapstructure:"confidence_threshold" yaml:"confidence_threshold"`
	Timeout             time.Duration `mapstructure:"timeout" yaml:"timeout"`
	PresidioURL         string        `mapstructure:"presidio_url" yaml:"presidio_url"`
}

// CloudflareConfig holds Cloudflare-specific configuration
type CloudflareConfig struct {
	AccountID     string `mapstructure:"account_id" yaml:"account_id"`
	APIToken      string `mapstructure:"api_token" yaml:"api_token"`
	R2Bucket      string `mapstructure:"r2_bucket" yaml:"r2_bucket"`
	VectorizeName string `mapstructure:"vectorize_name" yaml:"vectorize_name"`
	KVNamespace   string `mapstructure:"kv_namespace" yaml:"kv_namespace"`
	QueueName     string `mapstructure:"queue_name" yaml:"queue_name"`
	Region        string `mapstructure:"region" yaml:"region"`
}

// TracingConfig holds distributed tracing configuration
type TracingConfig struct {
	Exporter       string  `mapstructure:"exporter" yaml:"exporter"`
	JaegerEndpoint string  `mapstructure:"jaeger_endpoint" yaml:"jaeger_endpoint"`
	OTLPEndpoint   string  `mapstructure:"otlp_endpoint" yaml:"otlp_endpoint"`
	SampleRate     float64 `mapstructure:"sample_rate" yaml:"sample_rate"`
	ServiceName    string  `mapstructure:"service_name" yaml:"service_name"`
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Requests int           `mapstructure:"requests" yaml:"requests"`
	Window   time.Duration `mapstructure:"window" yaml:"window"`
	Burst    int           `mapstructure:"burst" yaml:"burst"`
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	MaxFailures  int           `mapstructure:"max_failures" yaml:"max_failures"`
	ResetTimeout time.Duration `mapstructure:"reset_timeout" yaml:"reset_timeout"`
}

// OPAConfig holds Open Policy Agent configuration
type OPAConfig struct {
	Enabled          bool          `mapstructure:"enabled" yaml:"enabled"`
	ServerURL        string        `mapstructure:"server_url" yaml:"server_url"`
	BundleURL        string        `mapstructure:"bundle_url" yaml:"bundle_url"`
	BundleVersion    string        `mapstructure:"bundle_version" yaml:"bundle_version"`
	SigningKey       string        `mapstructure:"signing_key" yaml:"signing_key"`
	Timeout          time.Duration `mapstructure:"timeout" yaml:"timeout"`
	CacheSize        int           `mapstructure:"cache_size" yaml:"cache_size"`
	CacheTTL         time.Duration `mapstructure:"cache_ttl" yaml:"cache_ttl"`
	HotReload        bool          `mapstructure:"hot_reload" yaml:"hot_reload"`
	DecisionLogging  bool          `mapstructure:"decision_logging" yaml:"decision_logging"`
	MetricsEnabled   bool          `mapstructure:"metrics_enabled" yaml:"metrics_enabled"`
	DenyByDefault    bool          `mapstructure:"deny_by_default" yaml:"deny_by_default"`
	RetryAttempts    int           `mapstructure:"retry_attempts" yaml:"retry_attempts"`
	RetryDelay       time.Duration `mapstructure:"retry_delay" yaml:"retry_delay"`
	PolicyPath       string        `mapstructure:"policy_path" yaml:"policy_path"`
	TenantPolicyPath string        `mapstructure:"tenant_policy_path" yaml:"tenant_policy_path"`
	AuthPolicyPath   string        `mapstructure:"auth_policy_path" yaml:"auth_policy_path"`
	DataPolicyPath   string        `mapstructure:"data_policy_path" yaml:"data_policy_path"`
	DLPPolicyPath    string        `mapstructure:"dlp_policy_path" yaml:"dlp_policy_path"`
}

// Environment represents the application environment
type Environment string

const (
	Development Environment = "development"
	Staging     Environment = "staging"
	Production  Environment = "production"
	Test        Environment = "test"
)

// Load loads configuration from file and environment variables
func Load(configPath string) (*Config, error) {
	viper.Reset()

	// Set defaults
	setDefaults()

	// Enable environment variable support
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	runtimeEnvironment, hasRuntimeEnvironment := getEnvironmentFromEnv()

	// Load configuration file
	if configPath != "" {
		viper.SetConfigFile(configPath)
		if err := viper.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	} else {
		addDefaultConfigPaths()

		if err := readOptionalConfig("config"); err != nil {
			return nil, err
		}

		environmentForOverrides := runtimeEnvironment
		if !hasRuntimeEnvironment {
			environmentForOverrides = normalizeEnvironment(viper.GetString("environment"))
		}

		if err := mergeOptionalConfig(fmt.Sprintf("config.%s", environmentForOverrides)); err != nil {
			return nil, err
		}
	}

	// Unmarshal configuration
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	applyLegacyCompatibility(&config)
	expandEnvironmentVariables(&config)

	if hasRuntimeEnvironment {
		config.Environment = string(runtimeEnvironment)
	} else if strings.TrimSpace(config.Environment) == "" {
		config.Environment = string(normalizeEnvironment(viper.GetString("environment")))
	}

	// Set start time
	config.StartTime = time.Now()

	// Validate configuration
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return &config, nil
}

func addDefaultConfigPaths() {
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/sdlc-platform")
	viper.AddConfigPath("$HOME/.sdlc-platform")
}

func readOptionalConfig(name string) error {
	viper.SetConfigName(name)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			logrus.Warn("Configuration file not found, using defaults and environment variables")
			return nil
		}

		return fmt.Errorf("error reading config file: %w", err)
	}

	return nil
}

func mergeOptionalConfig(name string) error {
	viper.SetConfigName(name)

	if err := viper.MergeInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			return nil
		}

		return fmt.Errorf("error reading config override: %w", err)
	}

	return nil
}

// setDefaults sets default configuration values
func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "60s")
	viper.SetDefault("server.graceful_shutdown_timeout", "30s")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.database", "sdlc_platform")
	viper.SetDefault("database.ssl_mode", "require")
	viper.SetDefault("database.max_connections", 20)
	viper.SetDefault("database.min_connections", 5)
	viper.SetDefault("database.max_conn_lifetime", "1h")
	viper.SetDefault("database.max_conn_idle_time", "30m")
	viper.SetDefault("database.health_check_period", "1m")
	viper.SetDefault("database.connect_timeout", "10s")
	viper.SetDefault("database.retry_attempts", 3)
	viper.SetDefault("database.retry_delay", "2s")
	viper.SetDefault("database.migration_path", "./migrations")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.database", 0)
	viper.SetDefault("redis.pool_size", 10)
	viper.SetDefault("redis.min_idle_conns", 3)
	viper.SetDefault("redis.max_retries", 3)
	viper.SetDefault("redis.dial_timeout", "5s")
	viper.SetDefault("redis.read_timeout", "3s")
	viper.SetDefault("redis.write_timeout", "3s")
	viper.SetDefault("redis.idle_timeout", "5m")

	// JWT defaults
	viper.SetDefault("jwt.access_token_ttl", "15m")
	viper.SetDefault("jwt.refresh_token_ttl", "168h")
	viper.SetDefault("jwt.issuer", "sdlc-platform")
	viper.SetDefault("jwt.signing_algorithm", "HS256")

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output", "stdout")
	viper.SetDefault("logging.max_size", 100)
	viper.SetDefault("logging.max_age", 28)
	viper.SetDefault("logging.max_backups", 3)
	viper.SetDefault("logging.compress", true)

	// Monitoring defaults
	viper.SetDefault("monitoring.enabled", true)
	viper.SetDefault("monitoring.port", 9090)
	viper.SetDefault("monitoring.path", "/metrics")
	viper.SetDefault("monitoring.namespace", "sdlc_platform")
	viper.SetDefault("monitoring.subsystem", "gateway")
	viper.SetDefault("monitoring.sample_rate", 0.1)

	// Security defaults
	viper.SetDefault("security.rate_limiting.enabled", true)
	viper.SetDefault("security.rate_limiting.default_rate_limit", 1000)
	viper.SetDefault("security.rate_limiting.default_window", "1h")
	viper.SetDefault("security.rate_limiting.burst_limit", 100)
	viper.SetDefault("security.rate_limiting.redis_key_prefix", "rate_limit:")
	viper.SetDefault("security.rate_limiting.cleanup_interval", "5m")

	viper.SetDefault("security.cors.enabled", true)
	viper.SetDefault("security.cors.allowed_origins", []string{"*"})
	viper.SetDefault("security.cors.allowed_methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	viper.SetDefault("security.cors.allowed_headers", []string{"*"})
	viper.SetDefault("security.cors.allow_credentials", false)
	viper.SetDefault("security.cors.max_age", 86400)

	viper.SetDefault("security.mtls.enabled", false)
	viper.SetDefault("security.mtls.client_auth", false)
	viper.SetDefault("security.mtls.skip_verify", false)

	viper.SetDefault("security.encryption.key_rotation_interval", "2160h")
	viper.SetDefault("security.encryption.algorithm", "AES-256-GCM")
	viper.SetDefault("security.encryption.key_derivation", "HKDF-SHA256")

	viper.SetDefault("security.dlp.enabled", true)
	viper.SetDefault("security.dlp.engines", []string{"regex", "ner", "ml"})
	viper.SetDefault("security.dlp.confidence_threshold", 0.8)
	viper.SetDefault("security.dlp.timeout", "5s")

	// Application defaults
	viper.SetDefault("version", "1.0.0")
	viper.SetDefault("environment", "development")
	viper.SetDefault("instance_id", "local")

	// Tracing defaults
	viper.SetDefault("tracing.exporter", "stdout")
	viper.SetDefault("tracing.jaeger_endpoint", "http://localhost:14268/api/traces")
	viper.SetDefault("tracing.otlp_endpoint", "http://localhost:4318/v1/traces")
	viper.SetDefault("tracing.sample_rate", 0.1)
	viper.SetDefault("tracing.service_name", "gateway")

	// CORS defaults
	viper.SetDefault("cors.allowed_origins", []string{"*"})
	viper.SetDefault("cors.allowed_methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allowed_headers", []string{"*"})
	viper.SetDefault("cors.allow_credentials", true)
	viper.SetDefault("cors.max_age", 300)

	// Rate limiting defaults
	viper.SetDefault("rate_limit.requests", 1000)
	viper.SetDefault("rate_limit.window", "1h")
	viper.SetDefault("rate_limit.burst", 100)

	// Circuit breaker defaults
	viper.SetDefault("circuit_breaker.max_failures", 5)
	viper.SetDefault("circuit_breaker.reset_timeout", "30s")

	// OPA defaults
	viper.SetDefault("opa.enabled", true)
	viper.SetDefault("opa.server_url", "http://localhost:8181")
	viper.SetDefault("opa.bundle_url", "https://bundles.example.com/policies")
	viper.SetDefault("opa.bundle_version", "latest")
	viper.SetDefault("opa.timeout", "5s")
	viper.SetDefault("opa.cache_size", 10000)
	viper.SetDefault("opa.cache_ttl", "5m")
	viper.SetDefault("opa.hot_reload", true)
	viper.SetDefault("opa.decision_logging", true)
	viper.SetDefault("opa.metrics_enabled", true)
	viper.SetDefault("opa.deny_by_default", true)
	viper.SetDefault("opa.retry_attempts", 3)
	viper.SetDefault("opa.retry_delay", "100ms")
	viper.SetDefault("opa.policy_path", "sdlc")
	viper.SetDefault("opa.tenant_policy_path", "sdlc.tenant")
	viper.SetDefault("opa.auth_policy_path", "sdlc.auth")
	viper.SetDefault("opa.data_policy_path", "sdlc.data")
	viper.SetDefault("opa.dlp_policy_path", "sdlc.dlp")
}

// getEnvironment determines the current environment
func getEnvironment() Environment {
	environment, _ := getEnvironmentFromEnv()
	return environment
}

func getEnvironmentFromEnv() (Environment, bool) {
	for _, key := range []string{"ENV", "GO_ENV", "APP_ENV"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return normalizeEnvironment(value), true
		}
	}

	return Development, false
}

func normalizeEnvironment(env string) Environment {
	switch strings.ToLower(strings.TrimSpace(env)) {
	case "production", "prod":
		return Production
	case "staging", "stage":
		return Staging
	case "test":
		return Test
	default:
		return Development
	}
}

func applyLegacyCompatibility(config *Config) {
	if !viper.InConfig("server.graceful_shutdown_timeout") && config.Server.LegacyShutdownTimeout > 0 {
		config.Server.GracefulShutdownTimeout = config.Server.LegacyShutdownTimeout
	}
}

func expandEnvironmentVariables(config *Config) {
	expandValue(reflect.ValueOf(config))
}

func expandValue(value reflect.Value) {
	if !value.IsValid() {
		return
	}

	switch value.Kind() {
	case reflect.Pointer:
		if !value.IsNil() {
			expandValue(value.Elem())
		}
	case reflect.Struct:
		for index := 0; index < value.NumField(); index++ {
			field := value.Field(index)
			if field.CanSet() {
				expandValue(field)
			}
		}
	case reflect.String:
		if value.CanSet() {
			value.SetString(os.ExpandEnv(value.String()))
		}
	case reflect.Slice:
		if value.Type().Elem().Kind() == reflect.String {
			for index := 0; index < value.Len(); index++ {
				value.Index(index).SetString(os.ExpandEnv(value.Index(index).String()))
			}
			return
		}

		for index := 0; index < value.Len(); index++ {
			expandValue(value.Index(index))
		}
	}
}

// validate validates the configuration
func validate(config *Config) error {
	// Validate server configuration
	if config.Server.Port <= 0 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	// Validate database configuration
	if config.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if config.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if config.Database.Database == "" {
		return fmt.Errorf("database name is required")
	}

	// Validate JWT configuration
	if config.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if len(config.JWT.Secret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters long")
	}

	// Validate security configuration
	if config.Security.RateLimiting.DefaultRateLimit <= 0 {
		return fmt.Errorf("default rate limit must be positive")
	}
	if config.Security.RateLimiting.DefaultWindow <= 0 {
		return fmt.Errorf("default rate limit window must be positive")
	}

	if normalizeEnvironment(config.Environment) == Production &&
		config.JWT.Secret == "your-super-secret-jwt-key-change-this-in-production" {
		return fmt.Errorf("JWT secret must be overridden in production")
	}

	// Validate Cloudflare configuration (if enabled)
	if config.Cloudflare.AccountID == "" && normalizeEnvironment(config.Environment) == Production {
		logrus.Warn("Cloudflare AccountID not configured in production")
	}

	return nil
}

// GetConnectionString returns the database connection string
func (c *Config) GetConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s connect_timeout=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Database,
		c.Database.SSLMode,
		c.Database.ConnectTimeout,
	)
}

// GetRedisAddress returns the Redis connection address
func (c *Config) GetRedisAddress() string {
	return fmt.Sprintf("%s:%d", c.Redis.Host, c.Redis.Port)
}

// IsProduction returns true if the environment is production
func (c *Config) IsProduction() bool {
	return normalizeEnvironment(c.Environment) == Production
}

// IsDevelopment returns true if the environment is development
func (c *Config) IsDevelopment() bool {
	return normalizeEnvironment(c.Environment) == Development
}

// GetLogrusLevel converts log level string to logrus level
func (c *Config) GetLogrusLevel() logrus.Level {
	level, err := logrus.ParseLevel(c.Logging.Level)
	if err != nil {
		logrus.Warnf("Invalid log level '%s', using 'info'", c.Logging.Level)
		return logrus.InfoLevel
	}
	return level
}
