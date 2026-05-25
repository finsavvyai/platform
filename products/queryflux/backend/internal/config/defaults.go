package config

import (
	"os"
	"time"
)

// defaultConfigurations for different environments
var defaultConfig = map[string]Config{
	"development": {
		Port:          "8080",
		Host:          "0.0.0.0",
		LogLevel:      "debug",
		DatabaseURL:   "postgres://localhost:5432/queryflux_dev?sslmode=disable",
		RedisURL:      "redis://localhost:6379",
		JWTSecret:     "dev-jwt-secret-key-32-chars",
		JWTExpiration: 24 * time.Hour,
		OpenAIAPIKey:  "",
		ClaudeAPIKey:  "",
		Environment:   "development",
	},
	"production": {
		DatabaseURL:   "postgres://prod-db.example.com:5432/queryflux?sslmode=require",
		RedisURL:      "redis://prod-redis.example.com:6379",
		JWTSecret:     "${QUERYFLUX_JWT_SECRET}",
		JWTExpiration: 168 * time.Hour, // 7 days
		Environment:   "production",
	},
}

// DefaultConfigLoader provides a method to load configuration based on environment
type DefaultConfigLoader interface {
	LoadDefaultConfig() *Config
}

// DevelopmentConfigLoader implements DefaultConfigLoader for development
type DevelopmentConfigLoader struct{}

func (d DevelopmentConfigLoader) LoadDefaultConfig() *Config {
	return &Config{
		Port:          defaultConfig["development"].Port,
		Host:          defaultConfig["development"].Host,
		LogLevel:      defaultConfig["development"].LogLevel,
		DatabaseURL:   defaultConfig["development"].DatabaseURL,
		RedisURL:      defaultConfig["development"].RedisURL,
		JWTSecret:     defaultConfig["development"].JWTSecret,
		JWTExpiration: defaultConfig["development"].JWTExpiration,
		OpenAIAPIKey:  defaultConfig["development"].OpenAIAPIKey,
		ClaudeAPIKey:  defaultConfig["development"].ClaudeAPIKey,
		Environment:   defaultConfig["development"].Environment,
	}
}

// ProductionConfigLoader implements DefaultConfigLoader for production
type ProductionConfigLoader struct{}

func (p ProductionConfigLoader) LoadDefaultConfig() *Config {
	return &Config{
		Port:          defaultConfig["production"].Port,
		Host:          defaultConfig["production"].Host,
		LogLevel:      defaultConfig["production"].LogLevel,
		DatabaseURL:   defaultConfig["production"].DatabaseURL,
		RedisURL:      defaultConfig["production"].RedisURL,
		JWTSecret:     defaultConfig["production"].JWTSecret,
		JWTExpiration: defaultConfig["production"].JWTExpiration,
		OpenAIAPIKey:  defaultConfig["production"].OpenAIAPIKey,
		ClaudeAPIKey:  defaultConfig["production"].ClaudeAPIKey,
		Environment:   defaultConfig["production"].Environment,
	}
}

// GetConfigLoader returns appropriate config loader based on environment
func GetConfigLoader() DefaultConfigLoader {
	env := os.Getenv("QUERYFLUX_ENVIRONMENT")

	switch env {
	case "production":
		return &ProductionConfigLoader{}
	case "staging":
		return &ProductionConfigLoader{}
	default:
		return &DevelopmentConfigLoader{}
	}
}
