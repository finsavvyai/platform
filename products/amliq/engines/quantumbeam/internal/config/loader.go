package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// LoadConfig loads configuration from multiple sources
func LoadConfig(configPath string, env string) (*Config, error) {
	v := viper.New()

	// Set environment variable prefix
	v.SetEnvPrefix("QUANTUMBEAM")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Load base configuration
	if err := loadBaseConfig(v, configPath); err != nil {
		return nil, fmt.Errorf("failed to load base config: %w", err)
	}

	// Load environment-specific configuration
	if env == "" {
		env = getEnvironment()
	}
	if err := loadEnvironmentConfig(v, env); err != nil {
		return nil, fmt.Errorf("failed to load environment config for %s: %w", env, err)
	}

	// Set defaults
	setDefaults(v)

	// Read configuration
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Unmarshal configuration
	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Apply environment-specific overrides
	if err := applyEnvironmentOverrides(&config, env); err != nil {
		return nil, fmt.Errorf("error applying environment overrides: %w", err)
	}

	// Validate configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	// Post-process configuration
	if err := postProcessConfig(&config); err != nil {
		return nil, fmt.Errorf("error post-processing config: %w", err)
	}

	return &config, nil
}

// loadBaseConfig loads the base configuration file
func loadBaseConfig(v *viper.Viper, configPath string) error {
	// Set config name and type
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Add search paths
	if configPath != "" {
		// If specific config path provided, use its directory
		dir := filepath.Dir(configPath)
		v.AddConfigPath(dir)
	} else {
		// Default search paths
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
		v.AddConfigPath("/etc/quantumbeam")
		v.AddConfigPath("$HOME/.quantumbeam")
	}

	return nil
}

// loadEnvironmentConfig loads environment-specific configuration
func loadEnvironmentConfig(v *viper.Viper, env string) error {
	// Set environment-specific config name
	envConfigName := fmt.Sprintf("config.%s", env)
	v.SetConfigName(envConfigName)

	// Try to load environment-specific config
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Environment-specific config not found, that's okay
			return nil
		}
		return err
	}

	return nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// Environment defaults
	v.SetDefault("environment.name", "development")
	v.SetDefault("environment.debug", true)
	v.SetDefault("environment.region", "us-east-1")
	v.SetDefault("environment.version", "1.0.0")

	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.read_timeout", "30s")
	v.SetDefault("server.write_timeout", "30s")
	v.SetDefault("server.idle_timeout", "60s")
	v.SetDefault("server.shutdown_timeout", "30s")

	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.dbname", "quantumbeam")
	v.SetDefault("database.sslmode", "prefer")
	v.SetDefault("database.max_connections", 20)
	v.SetDefault("database.min_connections", 5)
	v.SetDefault("database.max_lifetime", "1h")
	v.SetDefault("database.max_idle_time", "30m")
	v.SetDefault("database.connect_timeout", "10s")
	v.SetDefault("database.query_timeout", "30s")
	v.SetDefault("database.slow_query_threshold", "100ms")

	// Redis defaults
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.pool_size", 10)
	v.SetDefault("redis.min_idle_conns", 3)
	v.SetDefault("redis.max_retries", 3)
	v.SetDefault("redis.dial_timeout", "5s")
	v.SetDefault("redis.read_timeout", "3s")
	v.SetDefault("redis.write_timeout", "3s")

	// Security defaults
	v.SetDefault("security.jwt.secret", "change-me-in-production")
	v.SetDefault("security.jwt.access_expiration", "15m")
	v.SetDefault("security.jwt.refresh_expiration", "7d")
	v.SetDefault("security.jwt.issuer", "quantumbeam")

	v.SetDefault("security.password.min_length", 8)
	v.SetDefault("security.password.require_uppercase", true)
	v.SetDefault("security.password.require_lowercase", true)
	v.SetDefault("security.password.require_numbers", true)
	v.SetDefault("security.password.require_special", true)

	// AI defaults
	v.SetDefault("ai.enabled", true)
	v.SetDefault("ai.provider", "openai")
	v.SetDefault("ai.model", "gpt-4")
	v.SetDefault("ai.timeout", "30s")
	v.SetDefault("ai.max_tokens", 4096)
	v.SetDefault("ai.temperature", 0.7)
	v.SetDefault("ai.cache_enabled", true)
	v.SetDefault("ai.cache_ttl", "1h")

	// Monitoring defaults
	v.SetDefault("monitoring.enabled", true)
	v.SetDefault("monitoring.metrics.enabled", true)
	v.SetDefault("monitoring.metrics.provider", "prometheus")
	v.SetDefault("monitoring.metrics.port", 9090)
	v.SetDefault("monitoring.metrics.path", "/metrics")

	v.SetDefault("monitoring.tracing.enabled", true)
	v.SetDefault("monitoring.tracing.provider", "jaeger")
	v.SetDefault("monitoring.tracing.sample_rate", 0.1)

	v.SetDefault("monitoring.health_check.enabled", true)
	v.SetDefault("monitoring.health_check.port", 8081)
	v.SetDefault("monitoring.health_check.path", "/health")

	// Logging defaults
	v.SetDefault("logging.level", "info")
	v.SetDefault("logging.format", "json")
	v.SetDefault("logging.output", []string{"stdout"})
	v.SetDefault("logging.structured", true)

	// Cache defaults
	v.SetDefault("cache.enabled", true)
	v.SetDefault("cache.provider", "redis")
	v.SetDefault("cache.default_ttl", "1h")
	v.SetDefault("cache.max_entries", 10000)
	v.SetDefault("cache.eviction", "lru")

	// Rate limiting defaults
	v.SetDefault("rate_limiting.global.enabled", true)
	v.SetDefault("rate_limiting.global.limit", 1000)
	v.SetDefault("rate_limiting.global.window", "1m")
	v.SetDefault("rate_limiting.global.burst", 100)

	// Feature flags defaults
	v.SetDefault("features.fraud_detection.enabled", true)
	v.SetDefault("features.fraud_detection.percentage", 100)
	v.SetDefault("features.ai_analysis.enabled", true)
	v.SetDefault("features.ai_analysis.percentage", 100)
	v.SetDefault("features.quantum_analysis.enabled", false)
	v.SetDefault("features.quantum_analysis.percentage", 0)
}

// applyEnvironmentOverrides applies environment-specific configuration overrides
func applyEnvironmentOverrides(config *Config, env string) error {
	switch env {
	case "production":
		return applyProductionOverrides(config)
	case "staging":
		return applyStagingOverrides(config)
	case "development":
		return applyDevelopmentOverrides(config)
	default:
		return nil
	}
}

// applyProductionOverrides applies production-specific overrides
func applyProductionOverrides(config *Config) error {
	// Security overrides
	if config.Environment.Debug {
		config.Environment.Debug = false
	}
	if config.Logging.Level == "debug" || config.Logging.Level == "trace" {
		config.Logging.Level = "info"
	}
	if !config.Server.TLS.Enabled {
		config.Server.TLS.Enabled = true
	}
	if !config.Security.Session.Secure {
		config.Security.Session.Secure = true
	}
	if config.Security.Session.SameSite != "Strict" {
		config.Security.Session.SameSite = "Strict"
	}

	// Database overrides
	if config.Database.SSLMode == "disable" {
		config.Database.SSLMode = "require"
	}
	if config.Database.MaxConnections < 50 {
		config.Database.MaxConnections = 50
	}

	// Performance overrides
	if config.Monitoring.Tracing.SampleRate > 0.01 {
		config.Monitoring.Tracing.SampleRate = 0.01
	}
	if config.Server.ReadTimeout > time.Minute {
		config.Server.ReadTimeout = time.Minute
	}
	if config.Server.WriteTimeout > time.Minute {
		config.Server.WriteTimeout = time.Minute
	}

	// Disable development features
	config.Database.EnableQueryLogger = false
	config.Monitoring.Profiling.Enabled = false

	return nil
}

// applyStagingOverrides applies staging-specific overrides
func applyStagingOverrides(config *Config) error {
	// Security overrides
	if config.Environment.Debug {
		config.Environment.Debug = false
	}
	if config.Logging.Level == "debug" || config.Logging.Level == "trace" {
		config.Logging.Level = "info"
	}
	if !config.Server.TLS.Enabled {
		config.Server.TLS.Enabled = true
	}
	if !config.Security.Session.Secure {
		config.Security.Session.Secure = true
	}

	// Database overrides
	if config.Database.SSLMode == "disable" {
		config.Database.SSLMode = "require"
	}

	// Performance overrides
	if config.Monitoring.Tracing.SampleRate > 0.1 {
		config.Monitoring.Tracing.SampleRate = 0.1
	}

	// Enable some development features for testing
	config.Database.EnableQueryLogger = true
	config.Monitoring.Profiling.Enabled = true

	return nil
}

// applyDevelopmentOverrides applies development-specific overrides
func applyDevelopmentOverrides(config *Config) error {
	// Enable development features
	if !config.Environment.Debug {
		config.Environment.Debug = true
	}
	if config.Logging.Level != "debug" && config.Logging.Level != "trace" {
		config.Logging.Level = "debug"
	}
	if config.Server.TLS.Enabled {
		config.Server.TLS.Enabled = false
	}
	if config.Security.Session.Secure {
		config.Security.Session.Secure = false
	}

	// Database overrides
	if config.Database.SSLMode == "require" || config.Database.SSLMode == "verify-ca" || config.Database.SSLMode == "verify-full" {
		config.Database.SSLMode = "disable"
	}

	// Performance overrides
	if !config.Database.EnableQueryLogger {
		config.Database.EnableQueryLogger = true
	}
	if !config.Monitoring.Profiling.Enabled {
		config.Monitoring.Profiling.Enabled = true
	}
	if config.Monitoring.Tracing.SampleRate < 1.0 {
		config.Monitoring.Tracing.SampleRate = 1.0
	}

	// Disable rate limiting for easier development
	config.Security.RateLimit.Enabled = false
	config.RateLimiting.Global.Enabled = false
	config.RateLimiting.Users.Enabled = false
	config.RateLimiting.APIKeys.Enabled = false
	config.RateLimiting.IPs.Enabled = false

	return nil
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	validator, err := NewConfigValidator()
	if err != nil {
		return err
	}

	return validator.Validate(config)
}

// postProcessConfig performs post-processing on the configuration
func postProcessConfig(config *Config) error {
	// Set instance ID if not provided
	if config.Environment.InstanceID == "" {
		hostname, _ := os.Hostname()
		config.Environment.InstanceID = fmt.Sprintf("%s-%d", hostname, time.Now().Unix())
	}

	// Set build time if not provided
	if config.Environment.BuildTime == "" {
		if buildTime := os.Getenv("BUILD_TIME"); buildTime != "" {
			config.Environment.BuildTime = buildTime
		} else {
			config.Environment.BuildTime = time.Now().Format(time.RFC3339)
		}
	}

	// Set git commit if not provided
	if config.Environment.GitCommit == "" {
		if gitCommit := os.Getenv("GIT_COMMIT"); gitCommit != "" {
			config.Environment.GitCommit = gitCommit
		}
	}

	// Load secrets from environment
	loadSecretsFromEnv(config)

	// Set default ports if not specified
	if config.Server.Port == 0 {
		if config.Server.TLS.Enabled {
			config.Server.Port = 443
		} else {
			config.Server.Port = 8080
		}
	}

	if config.Monitoring.Metrics.Port == 0 {
		config.Monitoring.Metrics.Port = 9090
	}

	if config.Monitoring.HealthCheck.Port == 0 {
		config.Monitoring.HealthCheck.Port = 8081
	}

	if config.Monitoring.Profiling.Port == 0 {
		config.Monitoring.Profiling.Port = 6060
	}

	// Set default URLs if not provided
	if config.AI.Endpoint == "" && config.AI.Provider == "openai" {
		config.AI.Endpoint = "https://api.openai.com/v1"
	}

	if config.Quantum.Endpoint == "" && config.Quantum.Provider == "ibm" {
		config.Quantum.Endpoint = "https://quantum-computing.ibm.com"
	}

	return nil
}

// loadSecretsFromEnv loads secrets from environment variables
func loadSecretsFromEnv(config *Config) {
	if dbPassword := os.Getenv("DB_PASSWORD"); dbPassword != "" {
		config.Database.Password = dbPassword
	}

	if redisPassword := os.Getenv("REDIS_PASSWORD"); redisPassword != "" {
		config.Redis.Password = redisPassword
	}

	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		config.Security.JWT.Secret = jwtSecret
	}

	if aiAPIKey := os.Getenv("AI_API_KEY"); aiAPIKey != "" {
		config.AI.APIKey = aiAPIKey
	}

	if quantumAPIKey := os.Getenv("QUANTUM_API_KEY"); quantumAPIKey != "" {
		config.Quantum.APIKey = quantumAPIKey
	}

	if webhookSecret := os.Getenv("WEBHOOK_SECRET"); webhookSecret != "" {
		config.Webhook.Secret = webhookSecret
	}

	if encryptionKey := os.Getenv("ENCRYPTION_KEY"); encryptionKey != "" {
		// Set encryption key (this would need proper implementation)
		_ = encryptionKey
	}
}

// SaveConfig saves configuration to file
func SaveConfig(config *Config, filePath string) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Marshal configuration to YAML
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// MergeConfigs merges multiple configurations
func MergeConfigs(base, override *Config) *Config {
	// This is a simplified merge implementation
	// In a production system, you'd want more sophisticated merging logic
	merged := *base

	// Override environment
	if override.Environment.Name != "" {
		merged.Environment.Name = override.Environment.Name
	}
	if override.Environment.Debug {
		merged.Environment.Debug = override.Environment.Debug
	}
	if override.Environment.Region != "" {
		merged.Environment.Region = override.Environment.Region
	}

	// Override server settings
	if override.Server.Host != "" {
		merged.Server.Host = override.Server.Host
	}
	if override.Server.Port != 0 {
		merged.Server.Port = override.Server.Port
	}

	// Override database settings
	if override.Database.Host != "" {
		merged.Database.Host = override.Database.Host
	}
	if override.Database.Port != 0 {
		merged.Database.Port = override.Database.Port
	}
	if override.Database.User != "" {
		merged.Database.User = override.Database.User
	}
	if override.Database.Password != "" {
		merged.Database.Password = override.Database.Password
	}
	if override.Database.DBName != "" {
		merged.Database.DBName = override.Database.DBName
	}

	// Override security settings
	if override.Security.JWT.Secret != "" {
		merged.Security.JWT.Secret = override.Security.JWT.Secret
	}

	// Override monitoring settings
	if override.Monitoring.Enabled != merged.Monitoring.Enabled {
		merged.Monitoring.Enabled = override.Monitoring.Enabled
	}

	// Override logging settings
	if override.Logging.Level != "" {
		merged.Logging.Level = override.Logging.Level
	}
	if override.Logging.Format != "" {
		merged.Logging.Format = override.Logging.Format
	}

	// Override AI settings
	if override.AI.Enabled != merged.AI.Enabled {
		merged.AI.Enabled = override.AI.Enabled
	}
	if override.AI.Provider != "" {
		merged.AI.Provider = override.AI.Provider
	}
	if override.AI.Model != "" {
		merged.AI.Model = override.AI.Model
	}
	if override.AI.APIKey != "" {
		merged.AI.APIKey = override.AI.APIKey
	}

	// Override quantum settings
	if override.Quantum.Enabled != merged.Quantum.Enabled {
		merged.Quantum.Enabled = override.Quantum.Enabled
	}
	if override.Quantum.Provider != "" {
		merged.Quantum.Provider = override.Quantum.Provider
	}
	if override.Quantum.APIKey != "" {
		merged.Quantum.APIKey = override.Quantum.APIKey
	}

	// Override feature flags
	if override.Features.FraudDetection.Enabled != merged.Features.FraudDetection.Enabled {
		merged.Features.FraudDetection.Enabled = override.Features.FraudDetection.Enabled
	}
	if override.Features.AIAnalysis.Enabled != merged.Features.AIAnalysis.Enabled {
		merged.Features.AIAnalysis.Enabled = override.Features.AIAnalysis.Enabled
	}
	if override.Features.QuantumAnalysis.Enabled != merged.Features.QuantumAnalysis.Enabled {
		merged.Features.QuantumAnalysis.Enabled = override.Features.QuantumAnalysis.Enabled
	}

	return &merged
}

// GetConfigFromEnv loads configuration from environment variables only
func GetConfigFromEnv() (*Config, error) {
	v := viper.New()
	v.SetEnvPrefix("QUANTUMBEAM")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Set defaults
	setDefaults(v)

	// Unmarshal configuration
	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Determine environment
	env := getEnvironment()
	config.Environment.Name = env

	// Apply environment overrides
	if err := applyEnvironmentOverrides(&config, env); err != nil {
		return nil, fmt.Errorf("error applying environment overrides: %w", err)
	}

	// Validate configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	// Post-process configuration
	if err := postProcessConfig(&config); err != nil {
		return nil, fmt.Errorf("error post-processing config: %w", err)
	}

	return &config, nil
}

// GenerateConfigTemplate generates a configuration template
func GenerateConfigTemplate() (*Config, error) {
	config := &Config{}

	// Set default values
	config.Environment.Name = "development"
	config.Environment.Debug = true
	config.Environment.Region = "us-east-1"
	config.Environment.Version = "1.0.0"

	config.Server.Host = "0.0.0.0"
	config.Server.Port = 8080
	config.Server.ReadTimeout = 30 * time.Second
	config.Server.WriteTimeout = 30 * time.Second
	config.Server.IdleTimeout = 60 * time.Second
	config.Server.ShutdownTimeout = 30 * time.Second

	config.Database.Host = "localhost"
	config.Database.Port = 5432
	config.Database.User = "postgres"
	config.Database.DBName = "quantumbeam"
	config.Database.SSLMode = "prefer"
	config.Database.MaxConnections = 20
	config.Database.MinConnections = 5
	config.Database.MaxIdleConnections = 10
	config.Database.MaxLifetime = time.Hour
	config.Database.MaxIdleTime = 30 * time.Minute
	config.Database.ConnectTimeout = 10 * time.Second
	config.Database.QueryTimeout = 30 * time.Second
	config.Database.SlowQueryThreshold = 100 * time.Millisecond
	config.Database.EnableQueryLogger = false

	config.Redis.Host = "localhost"
	config.Redis.Port = 6379
	config.Redis.PoolSize = 10
	config.Redis.MinIdleConns = 3
	config.Redis.MaxRetries = 3
	config.Redis.DialTimeout = 5 * time.Second
	config.Redis.ReadTimeout = 3 * time.Second
	config.Redis.WriteTimeout = 3 * time.Second

	config.Security.JWT.Secret = "your-super-secret-jwt-key-change-this-in-production"
	config.Security.JWT.AccessExpiration = 15 * time.Minute
	config.Security.JWT.RefreshExpiration = 7 * 24 * time.Hour
	config.Security.JWT.Issuer = "quantumbeam"
	config.Security.JWT.Algorithm = "HS256"
	config.Security.JWT.RefreshEnabled = true
	config.Security.JWT.BlacklistEnabled = true

	config.Security.Password.MinLength = 8
	config.Security.Password.RequireUppercase = true
	config.Security.Password.RequireLowercase = true
	config.Security.Password.RequireNumbers = true
	config.Security.Password.RequireSpecial = true
	config.Security.Password.HashAlgorithm = "bcrypt"
	config.Security.Password.HashIterations = 12
	config.Security.Password.HashSaltLength = 16

	config.Security.RateLimit.Enabled = true
	config.Security.RateLimit.Algorithm = "token_bucket"
	config.Security.RateLimit.GlobalLimit = 1000
	config.Security.RateLimit.Window = time.Minute
	config.Security.RateLimit.BurstSize = 100
	config.Security.RateLimit.Storage = "redis"

	config.Security.Encryption.Algorithm = "AES256-GCM"
	config.Security.Encryption.KeyLength = 256
	config.Security.Encryption.KeyRotation = true
	config.Security.Encryption.RotationPeriod = 90 * 24 * time.Hour
	config.Security.Encryption.KeyDerivation = "PBKDF2"

	config.Security.Session.Store = "redis"
	config.Security.Session.CookieName = "quantumbeam_session"
	config.Security.Session.MaxAge = 24 * time.Hour
	config.Security.Session.Path = "/"
	config.Security.Session.Secure = true
	config.Security.Session.HTTPOnly = true
	config.Security.Session.SameSite = "Lax"

	config.AI.Enabled = true
	config.AI.Provider = "openai"
	config.AI.Model = "gpt-4"
	config.AI.Timeout = 30 * time.Second
	config.AI.MaxTokens = 4096
	config.AI.Temperature = 0.7
	config.AI.TopP = 1.0
	config.AI.FrequencyPenalty = 0.0
	config.AI.PresencePenalty = 0.0
	config.AI.RetryAttempts = 3
	config.AI.RetryDelay = time.Second
	config.AI.CacheEnabled = true
	config.AI.CacheTTL = time.Hour
	config.AI.ConfidenceThreshold = 0.8

	config.Quantum.Enabled = false
	config.Quantum.Provider = "ibm"
	config.Quantum.Timeout = 300 * time.Second
	config.Quantum.MaxQubits = 32
	config.Quantum.Shots = 1024
	config.Quantum.ErrorMitigation = true
	config.Quantum.Transpile = true
	config.Quantum.OptimizationLevel = 2
	config.Quantum.CacheEnabled = true
	config.Quantum.CacheTTL = 24 * time.Hour

	config.Monitoring.Enabled = true
	config.Monitoring.Metrics.Enabled = true
	config.Monitoring.Metrics.Provider = "prometheus"
	config.Monitoring.Metrics.Port = 9090
	config.Monitoring.Metrics.Path = "/metrics"
	config.Monitoring.Metrics.Namespace = "quantumbeam"
	config.Monitoring.Metrics.Histogram = true
	config.Monitoring.Metrics.Summary = true
	config.Monitoring.Metrics.Gauge = true
	config.Monitoring.Metrics.Counter = true

	config.Monitoring.Tracing.Enabled = true
	config.Monitoring.Tracing.Provider = "jaeger"
	config.Monitoring.Tracing.ServiceName = "quantumbeam-api"
	config.Monitoring.Tracing.SampleRate = 0.1
	config.Monitoring.Tracing.Timeout = 5 * time.Second
	config.Monitoring.Tracing.MaxPayloadSize = 10240

	config.Monitoring.HealthCheck.Enabled = true
	config.Monitoring.HealthCheck.Port = 8081
	config.Monitoring.HealthCheck.Path = "/health"
	config.Monitoring.HealthCheck.Interval = 30 * time.Second
	config.Monitoring.HealthCheck.Timeout = 5 * time.Second
	config.Monitoring.HealthCheck.FailureThreshold = 3
	config.Monitoring.HealthCheck.SuccessThreshold = 1

	config.Logging.Level = "info"
	config.Logging.Format = "json"
	config.Logging.Output = []string{"stdout"}
	config.Logging.Structured = true

	config.Features.FraudDetection.Enabled = true
	config.Features.FraudDetection.Percentage = 100
	config.Features.AIAnalysis.Enabled = true
	config.Features.AIAnalysis.Percentage = 100
	config.Features.QuantumAnalysis.Enabled = false
	config.Features.QuantumAnalysis.Percentage = 0

	config.Cache.Enabled = true
	config.Cache.Provider = "redis"
	config.Cache.DefaultTTL = time.Hour
	config.Cache.MaxEntries = 10000
	config.Cache.Eviction = "lru"
	config.Cache.Compression = false
	config.Cache.Encryption = false
	config.Cache.Prefix = "qb:"

	config.Webhook.Enabled = true
	config.Webhook.MaxRetries = 3
	config.Webhook.RetryDelay = time.Second
	config.Webhook.Timeout = 30 * time.Second
	config.Webhook.MaxPayload = 1048576

	return config, nil
}

// ValidateConfigFile validates a configuration file
func ValidateConfigFile(configPath string) error {
	v := viper.New()

	// Set config file
	v.SetConfigFile(configPath)

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		return fmt.Errorf("error reading config file: %w", err)
	}

	// Unmarshal configuration
	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	validator, err := NewConfigValidator()
	if err != nil {
		return err
	}

	return validator.Validate(&config)
}

// ExportConfig exports configuration in the specified format
func ExportConfig(config *Config, format string) ([]byte, error) {
	switch format {
	case "yaml":
		return yaml.Marshal(config)
	case "json":
		return yaml.Marshal(config) // Marshal as YAML then convert to JSON if needed
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}
