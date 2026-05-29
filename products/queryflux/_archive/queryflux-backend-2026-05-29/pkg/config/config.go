package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// PoolConfig holds pgxpool tuning parameters.
type PoolConfig struct {
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
	QueryTimeout    time.Duration
}

type Config struct {
	Port           string
	DatabaseURL    string
	LogLevel       string
	JWTSecret      string
	Environment    string
	AllowedOrigins string
	EncryptionKey  string
	Pool           PoolConfig
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		Environment:    getEnv("ENVIRONMENT", "development"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
		EncryptionKey:  getEnv("ENCRYPTION_KEY", ""),
		Pool: PoolConfig{
			MaxConns:        int32(getEnvInt("DB_POOL_MAX_CONNS", 10)),
			MinConns:        int32(getEnvInt("DB_POOL_MIN_CONNS", 2)),
			MaxConnLifetime: getEnvDuration("DB_POOL_MAX_CONN_LIFETIME", time.Hour),
			MaxConnIdleTime: getEnvDuration("DB_POOL_MAX_CONN_IDLE_TIME", 30*time.Minute),
			QueryTimeout:    getEnvDuration("DB_QUERY_TIMEOUT", 30*time.Second),
		},
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	if cfg.JWTSecret == "" && cfg.Environment == "production" {
		return nil, fmt.Errorf("JWT_SECRET is required in production")
	}

	if cfg.Environment == "production" {
		if cfg.EncryptionKey == "" {
			return nil, fmt.Errorf("ENCRYPTION_KEY is required in production")
		}
		if len(cfg.EncryptionKey) < 32 {
			return nil, fmt.Errorf("ENCRYPTION_KEY must be at least 32 characters in production")
		}
	} else if cfg.EncryptionKey == "" {
		cfg.EncryptionKey = "queryflux-default-dev-key-32b!"
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
