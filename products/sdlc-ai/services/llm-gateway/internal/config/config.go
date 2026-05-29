package config

import (
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	LLM        LLMConfig        `mapstructure:"llm"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Redis      RedisConfig      `mapstructure:"redis"`
	Auth       AuthConfig       `mapstructure:"auth"`
	Monitoring MonitoringConfig `mapstructure:"monitoring"`
	Logging    LoggingConfig    `mapstructure:"logging"`
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
	GinMode      string        `mapstructure:"gin_mode"`
}

// LLMConfig holds LLM gateway configuration
type LLMConfig struct {
	DefaultProvider    string                  `mapstructure:"default_provider"`
	MaxRetries         int                     `mapstructure:"max_retries"`
	RetryDelay         time.Duration           `mapstructure:"retry_delay"`
	Timeout            time.Duration           `mapstructure:"timeout"`
	EnableFailover     bool                    `mapstructure:"enable_failover"`
	EnableCostTracking bool                    `mapstructure:"enable_cost_tracking"`
	EnableValidation   bool                    `mapstructure:"enable_validation"`
	Security           models.SecurityConfig   `mapstructure:"security"`
	Budgets            models.BudgetConfig     `mapstructure:"budgets"`
	Providers          []models.ProviderConfig `mapstructure:"providers"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	DBName          string        `mapstructure:"dbname"`
	SSLMode         string        `mapstructure:"sslmode"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	JWTSecret  string `mapstructure:"jwt_secret"`
	JWTExpiry  string `mapstructure:"jwt_expiry"`
	AuthHeader string `mapstructure:"auth_header"`
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Enabled   bool   `mapstructure:"enabled"`
	Port      int    `mapstructure:"port"`
	Path      string `mapstructure:"path"`
	Namespace string `mapstructure:"namespace"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
	Output string `mapstructure:"output"`
}

// LoadConfig loads configuration from file and environment
func LoadConfig(configPath string) (*Config, error) {
	// Set default values
	setDefaults()

	// Configure viper
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/llm-gateway")

	if configPath != "" {
		viper.SetConfigFile(configPath)
	}

	// Enable environment variable support
	viper.AutomaticEnv()
	viper.SetEnvPrefix("LLM_GATEWAY")

	// Bind environment variables
	viper.BindEnv("server.port", "PORT")
	viper.BindEnv("database.host", "DB_HOST")
	viper.BindEnv("database.port", "DB_PORT")
	viper.BindEnv("database.user", "DB_USER")
	viper.BindEnv("database.password", "DB_PASSWORD")
	viper.BindEnv("database.dbname", "DB_NAME")
	viper.BindEnv("redis.host", "REDIS_HOST")
	viper.BindEnv("redis.port", "REDIS_PORT")
	viper.BindEnv("redis.password", "REDIS_PASSWORD")
	viper.BindEnv("auth.jwt_secret", "JWT_SECRET")

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found, use defaults and env vars
		} else {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Unmarshal config
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate config
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "120s")
	viper.SetDefault("server.gin_mode", "release")

	// LLM defaults
	viper.SetDefault("llm.default_provider", "openai")
	viper.SetDefault("llm.max_retries", 3)
	viper.SetDefault("llm.retry_delay", "1s")
	viper.SetDefault("llm.timeout", "60s")
	viper.SetDefault("llm.enable_failover", true)
	viper.SetDefault("llm.enable_cost_tracking", true)
	viper.SetDefault("llm.enable_validation", true)

	// Security defaults
	viper.SetDefault("llm.security.prompt_injection_detection", true)
	viper.SetDefault("llm.security.response_sanitization", true)
	viper.SetDefault("llm.security.jailbreak_protection", true)
	viper.SetDefault("llm.security.max_response_length", 4000)

	// Budget defaults
	viper.SetDefault("llm.budgets.default_monthly_limit", 1000.0)
	viper.SetDefault("llm.budgets.default_daily_limit", 50.0)
	viper.SetDefault("llm.budgets.alert_threshold", 80.0)
	viper.SetDefault("llm.budgets.currency", "USD")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "")
	viper.SetDefault("database.dbname", "llm_gateway")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", "5m")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)

	// Auth defaults
	viper.SetDefault("auth.enabled", true)
	viper.SetDefault("auth.jwt_expiry", "24h")
	viper.SetDefault("auth.auth_header", "Authorization")

	// Monitoring defaults
	viper.SetDefault("monitoring.enabled", true)
	viper.SetDefault("monitoring.port", 9090)
	viper.SetDefault("monitoring.path", "/metrics")
	viper.SetDefault("monitoring.namespace", "llm_gateway")

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output", "stdout")
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	// Validate server config
	if config.Server.Port < 1 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	// Validate LLM config
	if config.LLM.DefaultProvider == "" {
		return fmt.Errorf("default provider is required")
	}

	if config.LLM.MaxRetries < 0 {
		return fmt.Errorf("max_retries must be non-negative")
	}

	// Validate providers
	if len(config.LLM.Providers) == 0 {
		return fmt.Errorf("at least one provider must be configured")
	}

	// Check if default provider exists
	found := false
	for _, provider := range config.LLM.Providers {
		if provider.Name == config.LLM.DefaultProvider {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("default provider '%s' not found in providers list", config.LLM.DefaultProvider)
	}

	// Validate each provider
	for _, provider := range config.LLM.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if provider.Type == "" {
			return fmt.Errorf("provider type is required for provider '%s'", provider.Name)
		}
		if provider.APIKey == "" {
			return fmt.Errorf("API key is required for provider '%s'", provider.Name)
		}
	}

	// Validate database config
	if config.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if config.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if config.Database.DBName == "" {
		return fmt.Errorf("database name is required")
	}

	// Validate auth config
	if config.Auth.Enabled && config.Auth.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required when auth is enabled")
	}

	return nil
}
