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
	SmartRouterEnabled bool                    `mapstructure:"smart_router_enabled"`
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
