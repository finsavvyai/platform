package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// CLI provides command-line interface for configuration management
type CLI struct{}

// NewCLI creates a new CLI instance
func NewCLI() *CLI {
	return &CLI{}
}

// GenerateConfigs generates configuration files for all environments
func (cli *CLI) GenerateConfigs(outputDir string) error {
	if outputDir == "" {
		outputDir = "./config"
	}

	environments := []string{"development", "staging", "production", "test"}

	fmt.Printf("Generating configuration files in %s...\n", outputDir)

	for _, env := range environments {
		filename := fmt.Sprintf("config.%s.yaml", env)
		outputPath := filepath.Join(outputDir, filename)

		if err := GenerateConfigTemplate(env, outputPath); err != nil {
			return fmt.Errorf("failed to generate %s config: %w", env, err)
		}

		fmt.Printf("✓ Generated %s\n", filename)
	}

	fmt.Println("\nConfiguration files generated successfully!")
	fmt.Println("Review and modify the files according to your environment.")
	fmt.Println("\nTo use the configuration:")
	fmt.Println("1. Copy config.development.yaml to config.yaml")
	fmt.Println("2. Modify the values as needed")
	fmt.Println("3. Set environment variables for sensitive data")

	return nil
}

// ValidateConfig validates the current configuration
func (cli *CLI) ValidateConfig() error {
	config, err := Load()
	if err != nil {
		return fmt.Errorf("configuration validation failed: %w", err)
	}

	fmt.Println("✓ Configuration is valid!")
	fmt.Printf("Environment: %s\n", config.Environment)
	fmt.Printf("Database: %s\n", maskSensitiveData(config.DatabaseURL))
	fmt.Printf("Redis: %s\n", maskSensitiveData(config.RedisURL))
	fmt.Printf("AI Providers: OpenAI=%t Claude=%t\n",
		config.OpenAIAPIKey != "",
		config.ClaudeAPIKey != "")

	if config.Environment == "production" {
		fmt.Println("\n⚠️  Production environment detected:")
		if config.Debug {
			fmt.Println("  - Debug mode should be disabled in production")
		}
		if len(config.JWTSecret) < 64 {
			fmt.Println("  - JWT secret should be at least 64 characters in production")
		}
	}

	return nil
}

// ShowConfig displays the current configuration (with masked sensitive data)
func (cli *CLI) ShowConfig() error {
	config, err := Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	fmt.Printf("QueryFlux Configuration (%s)\n", config.Environment)
	fmt.Println("============================================")

	fmt.Printf("\nServer:\n")
	fmt.Printf("  Host: %s\n", config.Host)
	fmt.Printf("  Port: %s\n", config.Port)
	fmt.Printf("  Log Level: %s\n", config.LogLevel)
	fmt.Printf("  Timeout: %s\n", config.Timeout)
	fmt.Printf("  Debug: %t\n", config.Debug)

	fmt.Printf("\nDatabase:\n")
	fmt.Printf("  URL: %s\n", maskSensitiveData(config.DatabaseURL))
	fmt.Printf("  Pool Size: %d\n", config.DatabasePoolSize)
	fmt.Printf("  Timeout: %s\n", config.DatabaseTimeout)

	fmt.Printf("\nRedis:\n")
	fmt.Printf("  URL: %s\n", maskSensitiveData(config.RedisURL))

	fmt.Printf("\nJWT:\n")
	fmt.Printf("  Expiration: %s\n", config.JWTExpiration)
	fmt.Printf("  Refresh Expiry: %s\n", config.JWTRefreshExpiry)
	fmt.Printf("  Issuer: %s\n", config.JWTIssuer)

	fmt.Printf("\nAI Services:\n")
	fmt.Printf("  OpenAI Configured: %t\n", config.OpenAIAPIKey != "")
	fmt.Printf("  Claude Configured: %t\n", config.ClaudeAPIKey != "")
	fmt.Printf("  AI Timeout: %s\n", config.AITimeout)
	fmt.Printf("  Rate Limit: %d RPS\n", config.AIRateLimitRPS)
	fmt.Printf("  Model: %s\n", config.AIModel)

	fmt.Printf("\nSecurity:\n")
	fmt.Printf("  Rate Limit: %d RPS\n", config.RateLimitRPS)
	fmt.Printf("  Max Request Size: %d MB\n", config.MaxRequestSizeMB)
	fmt.Printf("  Request Logging: %t\n", config.EnableRequestLogging)
	fmt.Printf("  CORS Origins: %v\n", config.CORSOrigins)

	return nil
}

// maskSensitiveData masks sensitive information in URLs and keys
func maskSensitiveData(data string) string {
	if data == "" {
		return "<not set>"
	}

	// Simple masking - show first and last few characters
	if len(data) <= 8 {
		return "***"
	}

	return data[:4] + "***" + data[len(data)-4:]
}

// GenerateEnvFile generates a .env file template
func (cli *CLI) GenerateEnvFile(env, outputPath string) error {
	template := getEnvFileTemplate(env)

	if outputPath == "" {
		outputPath = ".env." + env
	}

	if err := os.WriteFile(outputPath, []byte(template), 0644); err != nil {
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	fmt.Printf("Generated environment file: %s\n", outputPath)
	return nil
}

func getEnvFileTemplate(env string) string {
	switch env {
	case "development":
		return `# QueryFlux Development Environment Variables
# Copy this file to .env and modify the values

# Server
QUERYFLUX_ENVIRONMENT=development
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=debug

# Database
DATABASE_URL=postgres://localhost:5432/queryflux_dev?sslmode=disable
REDIS_URL=redis://localhost:6379

# JWT (generate a strong secret for production)
JWT_SECRET=development-jwt-secret-key-must-be-32-chars-or-more

# AI Services
OPENAI_API_KEY=your-openai-api-key-here
CLAUDE_API_KEY=your-claude-api-key-here

# External Services
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
`

	case "production":
		return `# QueryFlux Production Environment Variables
# IMPORTANT: Use strong, randomly generated values

# Environment
QUERYFLUX_ENVIRONMENT=production
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info

# Database (use secure connection strings)
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

# Security (use strong secrets)
JWT_SECRET=${JWT_SECRET}

# AI Services
OPENAI_API_KEY=${OPENAI_API_KEY}
CLAUDE_API_KEY=${CLAUDE_API_KEY}

# External Services
LEMONSQUEEZY_API_KEY=${LEMONSQUEEZY_API_KEY}
LEMONSQUEEZY_STORE_ID=${LEMONSQUEEZY_STORE_ID}
LEMONSQUEEZY_WEBHOOK_SECRET=${LEMONSQUEEZY_WEBHOOK_SECRET}
`

	default:
		return `# QueryFlux Environment Variables
QUERYFLUX_ENVIRONMENT=development
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
DATABASE_URL=postgres://localhost:5432/queryflux?sslmode=disable
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-key-here
OPENAI_API_KEY=your-openai-api-key-here
CLAUDE_API_KEY=your-claude-api-key-here
`
	}
}
