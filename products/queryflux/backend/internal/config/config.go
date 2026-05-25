package config

import (
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	// Server configuration
	Port     string        `mapstructure:"PORT"`
	Host     string        `mapstructure:"HOST"`
	LogLevel string        `mapstructure:"LOG_LEVEL"`
	Timeout  time.Duration `mapstructure:"TIMEOUT"`

	// Database configuration
	DatabaseURL      string        `mapstructure:"DATABASE_URL"`
	RedisURL         string        `mapstructure:"REDIS_URL"`
	DatabasePoolSize int           `mapstructure:"DATABASE_POOL_SIZE"`
	DatabaseTimeout  time.Duration `mapstructure:"DATABASE_TIMEOUT"`

	// JWT configuration
	JWTSecret        string        `mapstructure:"JWT_SECRET"`
	JWTExpiration    time.Duration `mapstructure:"JWT_EXPIRATION"`
	JWTRefreshExpiry time.Duration `mapstructure:"JWT_REFRESH_EXPIRY"`
	JWTIssuer        string        `mapstructure:"JWT_ISSUER"`

	// AI Service configuration
	OpenAIAPIKey   string        `mapstructure:"OPENAI_API_KEY"`
	ClaudeAPIKey   string        `mapstructure:"CLAUDE_API_KEY"`
	OpenAIBaseURL  string        `mapstructure:"OPENAI_BASE_URL"`
	ClaudeBaseURL  string        `mapstructure:"CLAUDE_BASE_URL"`
	AITimeout      time.Duration `mapstructure:"AI_TIMEOUT"`
	AIRateLimitRPS int           `mapstructure:"AI_RATE_LIMIT_RPS"`
	AIModel        string        `mapstructure:"AI_MODEL"`
	OpenHandsURL   string        `mapstructure:"OPENHANDS_URL"`

	// External services
	LemonSqueezyAPIKey        string `mapstructure:"LEMONSQUEEZY_API_KEY"`
	LemonSqueezyStoreID       string `mapstructure:"LEMONSQUEEZY_STORE_ID"`
	LemonSqueezyWebhookSecret string `mapstructure:"LEMONSQUEEZY_WEBHOOK_SECRET"`

	// Security configuration
	CORSOrigins          []string `mapstructure:"CORS_ORIGINS"`
	RateLimitRPS         int      `mapstructure:"RATE_LIMIT_RPS"`
	MaxRequestSizeMB     int      `mapstructure:"MAX_REQUEST_SIZE_MB"`
	EnableRequestLogging bool     `mapstructure:"ENABLE_REQUEST_LOGGING"`

	// Environment
	Environment string `mapstructure:"ENVIRONMENT"`
	Debug       bool   `mapstructure:"DEBUG"`
}

// Load reads configuration from environment variables and config files
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("$HOME/.queryflux")

	// Set environment-specific config files
	env := os.Getenv("QUERYFLUX_ENVIRONMENT")
	if env != "" {
		viper.SetConfigName(fmt.Sprintf("config.%s", env))
	}

	// Set defaults
	setDefaults()

	// Enable reading from environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read config file if it exists
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		// Log that we're using environment variables only
		fmt.Printf("Warning: No config file found, using environment variables and defaults\n")
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate required fields
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	// Apply environment-specific overrides
	if err := applyEnvironmentOverrides(&config, env); err != nil {
		return nil, fmt.Errorf("failed to apply environment overrides: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("HOST", "0.0.0.0")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("TIMEOUT", "30s")
	viper.SetDefault("ENVIRONMENT", "development")
	viper.SetDefault("DEBUG", false)

	// Database defaults
	viper.SetDefault("DATABASE_URL", "postgres://localhost:5432/queryflux?sslmode=disable")
	viper.SetDefault("REDIS_URL", "redis://localhost:6379")
	viper.SetDefault("DATABASE_POOL_SIZE", 10)
	viper.SetDefault("DATABASE_TIMEOUT", "30s")

	// JWT defaults
	viper.SetDefault("JWT_EXPIRATION", "24h")
	viper.SetDefault("JWT_REFRESH_EXPIRY", "168h") // 7 days
	viper.SetDefault("JWT_ISSUER", "queryflux")

	// AI Service defaults
	viper.SetDefault("OPENAI_BASE_URL", "https://api.openai.com/v1")
	viper.SetDefault("CLAUDE_BASE_URL", "https://api.anthropic.com")
	viper.SetDefault("AI_TIMEOUT", "60s")
	viper.SetDefault("AI_RATE_LIMIT_RPS", 10)
	viper.SetDefault("AI_MODEL", "gpt-4")
	viper.SetDefault("OPENHANDS_URL", "http://localhost:8787")

	// Security defaults
	viper.SetDefault("CORS_ORIGINS", []string{"http://localhost:3000", "http://localhost:5173"})
	viper.SetDefault("RATE_LIMIT_RPS", 100)
	viper.SetDefault("MAX_REQUEST_SIZE_MB", 10)
	viper.SetDefault("ENABLE_REQUEST_LOGGING", true)
}

func validate(config *Config) error {
	// Validate required fields
	if config.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}

	if config.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	// Validate JWT secret length
	if len(config.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters long")
	}

	// Validate database URL format
	if err := validateDatabaseURL(config.DatabaseURL); err != nil {
		return fmt.Errorf("invalid DATABASE_URL: %w", err)
	}

	// Validate Redis URL if provided
	if config.RedisURL != "" {
		if err := validateRedisURL(config.RedisURL); err != nil {
			return fmt.Errorf("invalid REDIS_URL: %w", err)
		}
	}

	// Validate port number
	if config.Port != "" && !isValidPort(config.Port) {
		return fmt.Errorf("invalid PORT: %s", config.Port)
	}

	// Validate log level
	if !isValidLogLevel(config.LogLevel) {
		return fmt.Errorf("invalid LOG_LEVEL: %s", config.LogLevel)
	}

	// Validate environment
	if !isValidEnvironment(config.Environment) {
		return fmt.Errorf("invalid ENVIRONMENT: %s", config.Environment)
	}

	// Validate that at least one AI provider is configured in production
	if config.Environment == "production" && config.OpenAIAPIKey == "" && config.ClaudeAPIKey == "" {
		return fmt.Errorf("at least one AI provider API key must be configured in production")
	}

	return nil
}

func validateDatabaseURL(dbURL string) error {
	// Parse database URL to validate format
	u, err := url.Parse(dbURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	if u.Scheme == "" {
		return fmt.Errorf("database URL must have a scheme (e.g., postgres, mysql)")
	}

	if u.Host == "" {
		return fmt.Errorf("database URL must have a host")
	}

	return nil
}

func validateRedisURL(redisURL string) error {
	u, err := url.Parse(redisURL)
	if err != nil {
		return fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	if u.Scheme != "redis" && u.Scheme != "rediss" {
		return fmt.Errorf("Redis URL must use redis:// or rediss:// scheme")
	}

	return nil
}

func isValidPort(port string) bool {
	re := regexp.MustCompile(`^[0-9]+$`)
	if !re.MatchString(port) {
		return false
	}

	portNum := 0
	fmt.Sscanf(port, "%d", &portNum)
	return portNum > 0 && portNum <= 65535
}

func isValidLogLevel(level string) bool {
	validLevels := []string{"debug", "info", "warn", "error", "fatal"}
	for _, valid := range validLevels {
		if level == valid {
			return true
		}
	}
	return false
}

func isValidEnvironment(env string) bool {
	validEnvs := []string{"development", "staging", "production", "test"}
	for _, valid := range validEnvs {
		if env == valid {
			return true
		}
	}
	return false
}

func applyEnvironmentOverrides(config *Config, env string) error {
	switch env {
	case "production":
		// Production-specific overrides
		if config.LogLevel == "debug" {
			config.LogLevel = "info"
		}
		config.Debug = false

		// Ensure secure defaults
		if config.JWTExpiration > 24*time.Hour {
			config.JWTExpiration = 24 * time.Hour
		}

	case "test":
		// Test environment overrides
		config.LogLevel = "error"
		config.Debug = false
		config.EnableRequestLogging = false

		// Use test databases
		if config.DatabaseURL == "postgres://localhost:5432/queryflux?sslmode=disable" {
			config.DatabaseURL = "postgres://localhost:5432/queryflux_test?sslmode=disable"
		}
	}

	return nil
}
