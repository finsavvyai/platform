package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// GenerateConfigTemplate creates configuration templates for different environments
func GenerateConfigTemplate(env, outputPath string) error {
	template := getConfigTemplate(env)

	if outputPath == "" {
		outputPath = fmt.Sprintf("config.%s.yaml", env)
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(outputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Write template to file
	if err := os.WriteFile(outputPath, []byte(template), 0644); err != nil {
		return fmt.Errorf("failed to write config template: %w", err)
	}

	return nil
}

func getConfigTemplate(env string) string {
	switch env {
	case "development":
		return `# QueryFlux Development Configuration
# Copy this file to config.yaml and modify as needed

# Server Configuration
PORT: "8080"
HOST: "0.0.0.0"
LOG_LEVEL: "debug"
TIMEOUT: "30s"
DEBUG: true

# Database Configuration
DATABASE_URL: "postgres://localhost:5432/queryflux_dev?sslmode=disable"
REDIS_URL: "redis://localhost:6379"
DATABASE_POOL_SIZE: 5
DATABASE_TIMEOUT: "10s"

# JWT Configuration
JWT_SECRET: "development-jwt-secret-key-must-be-32-chars-or-more"
JWT_EXPIRATION: "24h"
JWT_REFRESH_EXPIRY: "168h" # 7 days
JWT_ISSUER: "queryflux-dev"

# AI Service Configuration
# Get your API keys from the respective providers
OPENAI_API_KEY: "your-openai-api-key-here"
CLAUDE_API_KEY: "your-claude-api-key-here"
OPENAI_BASE_URL: "https://api.openai.com/v1"
CLAUDE_BASE_URL: "https://api.anthropic.com"
AI_TIMEOUT: "60s"
AI_RATE_LIMIT_RPS: 10
AI_MODEL: "gpt-4"

# Security Configuration
CORS_ORIGINS:
  - "http://localhost:3000"
  - "http://localhost:5173"
  - "http://localhost:8080"
RATE_LIMIT_RPS: 100
MAX_REQUEST_SIZE_MB: 10
ENABLE_REQUEST_LOGGING: true

# External Services
# LemonSqueezy for payments (optional for development)
LEMONSQUEEZY_API_KEY: ""
LEMONSQUEEZY_STORE_ID: ""
LEMONSQUEEZY_WEBHOOK_SECRET: ""

# Environment
ENVIRONMENT: "development"
`

	case "production":
		return `# QueryFlux Production Configuration
# IMPORTANT: Review all values before using in production

# Server Configuration
PORT: "8080"
HOST: "0.0.0.0"
LOG_LEVEL: "info"
TIMEOUT: "30s"
DEBUG: false

# Database Configuration
# Use secure, production-ready databases
DATABASE_URL: "${DATABASE_URL}"
REDIS_URL: "${REDIS_URL}"
DATABASE_POOL_SIZE: 20
DATABASE_TIMEOUT: "10s"

# JWT Configuration
# IMPORTANT: Use a strong, randomly generated secret
JWT_SECRET: "${JWT_SECRET}"
JWT_EXPIRATION: "1h"
JWT_REFRESH_EXPIRY: "168h" # 7 days
JWT_ISSUER: "queryflux"

# AI Service Configuration
# Configure your preferred AI providers
OPENAI_API_KEY: "${OPENAI_API_KEY}"
CLAUDE_API_KEY: "${CLAUDE_API_KEY}"
OPENAI_BASE_URL: "https://api.openai.com/v1"
CLAUDE_BASE_URL: "https://api.anthropic.com"
AI_TIMEOUT: "30s"
AI_RATE_LIMIT_RPS: 20
AI_MODEL: "gpt-4"

# Security Configuration
# IMPORTANT: Configure according to your domain requirements
CORS_ORIGINS:
  - "https://app.queryflux.com"
  - "https://queryflux.com"
RATE_LIMIT_RPS: 1000
MAX_REQUEST_SIZE_MB: 50
ENABLE_REQUEST_LOGGING: true

# External Services
# Required for production if using paid features
LEMONSQUEEZY_API_KEY: "${LEMONSQUEEZY_API_KEY}"
LEMONSQUEEZY_STORE_ID: "${LEMONSQUEEZY_STORE_ID}"
LEMONSQUEEZY_WEBHOOK_SECRET: "${LEMONSQUEEZY_WEBHOOK_SECRET}"

# Environment
ENVIRONMENT: "production"
`

	case "staging":
		return `# QueryFlux Staging Configuration
# Used for testing production-like environments

# Server Configuration
PORT: "8080"
HOST: "0.0.0.0"
LOG_LEVEL: "info"
TIMEOUT: "30s"
DEBUG: false

# Database Configuration
DATABASE_URL: "${DATABASE_URL}"
REDIS_URL: "${REDIS_URL}"
DATABASE_POOL_SIZE: 10
DATABASE_TIMEOUT: "15s"

# JWT Configuration
JWT_SECRET: "${JWT_SECRET}"
JWT_EXPIRATION: "4h"
JWT_REFRESH_EXPIRY: "168h" # 7 days
JWT_ISSUER: "queryflux-staging"

# AI Service Configuration
OPENAI_API_KEY: "${OPENAI_API_KEY}"
CLAUDE_API_KEY: "${CLAUDE_API_KEY}"
OPENAI_BASE_URL: "https://api.openai.com/v1"
CLAUDE_BASE_URL: "https://api.anthropic.com"
AI_TIMEOUT: "45s"
AI_RATE_LIMIT_RPS: 15
AI_MODEL: "gpt-4"

# Security Configuration
CORS_ORIGINS:
  - "https://staging.queryflux.com"
  - "https://dev.queryflux.com"
RATE_LIMIT_RPS: 500
MAX_REQUEST_SIZE_MB: 25
ENABLE_REQUEST_LOGGING: true

# External Services
LEMONSQUEEZY_API_KEY: "${LEMONSQUEEZY_API_KEY}"
LEMONSQUEEZY_STORE_ID: "${LEMONSQUEEZY_STORE_ID}"
LEMONSQUEEZY_WEBHOOK_SECRET: "${LEMONSQUEEZY_WEBHOOK_SECRET}"

# Environment
ENVIRONMENT: "staging"
`

	case "test":
		return `# QueryFlux Test Configuration
# Used for automated testing

# Server Configuration
PORT: "8081"
HOST: "localhost"
LOG_LEVEL: "error"
TIMEOUT: "5s"
DEBUG: false

# Database Configuration
DATABASE_URL: "postgres://localhost:5432/queryflux_test?sslmode=disable"
REDIS_URL: "redis://localhost:6379/1" # Use database 1 for tests
DATABASE_POOL_SIZE: 2
DATABASE_TIMEOUT: "5s"

# JWT Configuration
JWT_SECRET: "test-jwt-secret-key-32-chars-long"
JWT_EXPIRATION: "1h"
JWT_REFRESH_EXPIRY: "2h"
JWT_ISSUER: "queryflux-test"

# AI Service Configuration
# Mock AI services for testing
OPENAI_API_KEY: "test-openai-key"
CLAUDE_API_KEY: "test-claude-key"
OPENAI_BASE_URL: "http://localhost:8082/mock/openai"
CLAUDE_BASE_URL: "http://localhost:8082/mock/claude"
AI_TIMEOUT: "1s"
AI_RATE_LIMIT_RPS: 100
AI_MODEL: "gpt-3.5-turbo"

# Security Configuration
CORS_ORIGINS:
  - "http://localhost:3000"
RATE_LIMIT_RPS: 1000
MAX_REQUEST_SIZE_MB: 1
ENABLE_REQUEST_LOGGING: false

# External Services
LEMONSQUEEZY_API_KEY: "test-key"
LEMONSQUEEZY_STORE_ID: "test-store"
LEMONSQUEEZY_WEBHOOK_SECRET: "test-webhook-secret"

# Environment
ENVIRONMENT: "test"
`

	default:
		return `# QueryFlux Configuration Template
# Modify this file according to your needs

# Server Configuration
PORT: "8080"
HOST: "0.0.0.0"
LOG_LEVEL: "info"
TIMEOUT: "30s"
DEBUG: false

# Database Configuration
DATABASE_URL: "postgres://localhost:5432/queryflux?sslmode=disable"
REDIS_URL: "redis://localhost:6379"
DATABASE_POOL_SIZE: 10
DATABASE_TIMEOUT: "30s"

# JWT Configuration
JWT_SECRET: "your-jwt-secret-key-must-be-32-chars-or-more"
JWT_EXPIRATION: "24h"
JWT_REFRESH_EXPIRY: "168h"
JWT_ISSUER: "queryflux"

# AI Service Configuration
OPENAI_API_KEY: "your-openai-api-key"
CLAUDE_API_KEY: "your-claude-api-key"
OPENAI_BASE_URL: "https://api.openai.com/v1"
CLAUDE_BASE_URL: "https://api.anthropic.com"
AI_TIMEOUT: "60s"
AI_RATE_LIMIT_RPS: 10
AI_MODEL: "gpt-4"

# Security Configuration
CORS_ORIGINS:
  - "http://localhost:3000"
RATE_LIMIT_RPS: 100
MAX_REQUEST_SIZE_MB: 10
ENABLE_REQUEST_LOGGING: true

# External Services
LEMONSQUEEZY_API_KEY: ""
LEMONSQUEEZY_STORE_ID: ""
LEMONSQUEEZY_WEBHOOK_SECRET: ""

# Environment
ENVIRONMENT: "development"
`
	}
}

// GetAllEnvironmentTemplates returns templates for all environments
func GetAllEnvironmentTemplates() map[string]string {
	return map[string]string{
		"development": getConfigTemplate("development"),
		"staging":     getConfigTemplate("staging"),
		"production":  getConfigTemplate("production"),
		"test":        getConfigTemplate("test"),
	}
}
