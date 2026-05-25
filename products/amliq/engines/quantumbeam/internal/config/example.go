package config

import (
	"fmt"
	"log"
	"os"
	"time"
)

// Example demonstrates how to use the configuration system
func Example() {
	// Example 1: Load configuration with environment detection
	config, err := LoadConfig("", "")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	fmt.Printf("Loaded configuration for environment: %s\n", config.Environment.Name)
	fmt.Printf("Server will listen on port: %d\n", config.Server.Port)
	fmt.Printf("Database: %s:%d/%s\n", config.Database.Host, config.Database.Port, config.Database.DBName)

	// Example 2: Load configuration from specific file
	config, err = LoadConfig("/path/to/config.yaml", "production")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Example 3: Create configuration manager
	configManager := NewConfigManager()
	config, err = configManager.LoadConfig("config/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Example 4: Generate a secure JWT secret
	utils := NewConfigUtils()
	jwtSecret, err := utils.GenerateJWTSecret()
	if err != nil {
		log.Fatalf("Failed to generate JWT secret: %v", err)
	}
	fmt.Printf("Generated JWT secret: %s\n", jwtSecret)

	// Example 5: Generate API key
	apiKey, err := utils.GenerateAPIKey("qb", 32)
	if err != nil {
		log.Fatalf("Failed to generate API key: %v", err)
	}
	fmt.Printf("Generated API key: %s\n", apiKey)

	// Example 6: Hash a password
	password := "securePassword123"
	hashedPassword, err := utils.HashPassword(password, 12)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}
	fmt.Printf("Hashed password: %s\n", hashedPassword)

	// Example 7: Verify password
	isValid := utils.VerifyPassword(password, hashedPassword)
	fmt.Printf("Password verification: %v\n", isValid)

	// Example 8: Generate configuration template
	templateConfig, err := GenerateConfigTemplate()
	if err != nil {
		log.Fatalf("Failed to generate config template: %v", err)
	}

	// Example 9: Save configuration to file
	err = SaveConfig(templateConfig, "config.example.yaml")
	if err != nil {
		log.Fatalf("Failed to save configuration: %v", err)
	}
	fmt.Println("Configuration template saved to config.example.yaml")

	// Example 10: Validate configuration file
	err = ValidateConfigFile("config/config.yaml")
	if err != nil {
		log.Printf("Configuration validation failed: %v", err)
	} else {
		fmt.Println("Configuration validation passed")
	}

	// Example 11: Get configuration health report
	healthReport := utils.CheckConfigHealth(config)
	fmt.Printf("Configuration health: %v\n", healthReport["status"])

	// Example 12: Generate configuration report
	configReport := utils.GenerateConfigReport(config)
	fmt.Printf("Configuration report generated with %d sections\n", len(configReport))

	// Example 13: Sanitize configuration for export
	sanitizedConfig := utils.SanitizeConfigForExport(config)
	fmt.Printf("Sanitized configuration has %d top-level keys\n", len(sanitizedConfig))

	// Example 14: Export configuration to JSON
	jsonData, err := ExportConfig(config, "json")
	if err != nil {
		log.Fatalf("Failed to export configuration: %v", err)
	}
	fmt.Printf("Exported configuration (%d bytes)\n", len(jsonData))

	// Example 15: Use environment variable helpers
	dbPassword := utils.GetEnvVarWithDefault("DB_PASSWORD", "defaultPassword")
	enableDebug := utils.GetEnvVarAsBool("DEBUG", false)
	maxConnections := utils.GetEnvVarAsInt("MAX_CONNECTIONS", 20)
	requestTimeout := utils.GetEnvVarAsDuration("REQUEST_TIMEOUT", 30*time.Second)

	fmt.Printf("Environment variables - DB: %s, Debug: %v, MaxConn: %d, Timeout: %v\n",
		dbPassword, enableDebug, maxConnections, requestTimeout)
}

// ExampleProductionConfig shows how to set up configuration for production
func ExampleProductionConfig() {
	// Set production environment variables
	os.Setenv("QUANTUMBEAM_ENVIRONMENT", "production")
	os.Setenv("QUANTUMBEAM_DATABASE_PASSWORD", "secure-db-password")
	os.Setenv("QUANTUMBEAM_REDIS_PASSWORD", "secure-redis-password")
	os.Setenv("QUANTUMBEAM_SECURITY_JWT_SECRET", "very-secure-jwt-secret-32-chars-long")
	os.Setenv("QUANTUMBEAM_AI_API_KEY", "your-openai-api-key")
	os.Setenv("QUANTUMBEAM_QUANTUM_API_KEY", "your-quantum-api-key")
	os.Setenv("QUANTUMBEAM_WEBHOOK_SECRET", "secure-webhook-secret")

	// Load configuration
	config, err := LoadConfig("config/config.production.yaml", "production")
	if err != nil {
		log.Fatalf("Failed to load production configuration: %v", err)
	}

	// Verify production-specific settings
	if !config.Server.TLS.Enabled {
		log.Fatal("TLS must be enabled in production")
	}

	if config.Database.SSLMode == "disable" {
		log.Fatal("Database SSL must be enabled in production")
	}

	if !config.Security.Session.Secure {
		log.Fatal("Session secure flag must be enabled in production")
	}

	fmt.Println("Production configuration loaded and validated successfully")
}

// ExampleDevelopmentConfig shows how to set up configuration for development
func ExampleDevelopmentConfig() {
	// Create a development configuration
	config := &Config{}

	// Set development-specific values
	config.Environment.Name = "development"
	config.Environment.Debug = true
	config.Server.Host = "localhost"
	config.Server.Port = 8080
	config.Server.TLS.Enabled = false

	// Database configuration for development
	config.Database.Host = "localhost"
	config.Database.Port = 5432
	config.Database.User = "postgres"
	config.Database.Password = "password"
	config.Database.DBName = "quantumbeam_dev"
	config.Database.SSLMode = "disable"
	config.Database.EnableQueryLogger = true

	// Enable development features
	config.Monitoring.Profiling.Enabled = true
	config.Security.RateLimit.Enabled = false
	config.Logging.Level = "debug"

	// Validate configuration
	validator, err := NewConfigValidator()
	if err != nil {
		log.Fatalf("Failed to create validator: %v", err)
	}

	if err := validator.Validate(config); err != nil {
		log.Fatalf("Configuration validation failed: %v", err)
	}

	// Save development configuration
	err = SaveConfig(config, "config/config.development.yaml")
	if err != nil {
		log.Fatalf("Failed to save development configuration: %v", err)
	}

	fmt.Println("Development configuration created and saved successfully")
}

// ExampleEnvironmentOverrides shows how environment-specific overrides work
func ExampleEnvironmentOverrides() {
	utils := NewConfigUtils()

	// Create base configuration
	baseConfig := &Config{}
	baseConfig.Environment.Name = "base"
	baseConfig.Server.Port = 8080
	baseConfig.Logging.Level = "info"
	baseConfig.Monitoring.Tracing.SampleRate = 0.1

	// Create development override config
	devConfig := &Config{}
	devConfig.Environment.Name = "development"
	devConfig.Environment.Debug = true
	devConfig.Logging.Level = "debug"
	devConfig.Monitoring.Tracing.SampleRate = 1.0
	devConfig.Server.TLS.Enabled = false

	// Create production override config
	prodConfig := &Config{}
	prodConfig.Environment.Name = "production"
	prodConfig.Environment.Debug = false
	prodConfig.Logging.Level = "warn"
	prodConfig.Monitoring.Tracing.SampleRate = 0.01
	prodConfig.Server.TLS.Enabled = true

	// Apply overrides for different environments
	environments := []struct {
		name     string
		override *Config
	}{
		{"development", devConfig},
		{"production", prodConfig},
	}

	for _, env := range environments {
		mergedConfig := MergeConfigs(baseConfig, env.override)

		fmt.Printf("Environment: %s\n", mergedConfig.Environment.Name)
		fmt.Printf("  Debug: %v\n", mergedConfig.Environment.Debug)
		fmt.Printf("  Logging Level: %s\n", mergedConfig.Logging.Level)
		fmt.Printf("  Tracing Sample Rate: %.2f\n", mergedConfig.Monitoring.Tracing.SampleRate)
		fmt.Printf("  TLS Enabled: %v\n", mergedConfig.Server.TLS.Enabled)
		fmt.Println()
	}
}

// ExampleSecretManagement shows how to manage secrets securely
func ExampleSecretManagement() {
	utils := NewConfigUtils()

	// Generate various secrets
	jwtSecret, err := utils.GenerateJWTSecret()
	if err != nil {
		log.Fatalf("Failed to generate JWT secret: %v", err)
	}

	apiKey, err := utils.GenerateAPIKey("prod", 40)
	if err != nil {
		log.Fatalf("Failed to generate API key: %v", err)
	}

	encryptionKey, err := utils.GenerateEncryptionKey(32)
	if err != nil {
		log.Fatalf("Failed to generate encryption key: %v", err)
	}

	// Validate secret strength
	err = utils.ValidateSecretStrength(jwtSecret, 32)
	if err != nil {
		log.Printf("JWT secret validation warning: %v", err)
	}

	// Encrypt and decrypt secrets (placeholder implementation)
	encryptedJWT, err := utils.EncryptSecret(jwtSecret, "master-key")
	if err != nil {
		log.Fatalf("Failed to encrypt JWT secret: %v", err)
	}

	decryptedJWT, err := utils.DecryptSecret(encryptedJWT, "master-key")
	if err != nil {
		log.Fatalf("Failed to decrypt JWT secret: %v", err)
	}

	fmt.Printf("Secret Management Example:\n")
	fmt.Printf("  JWT Secret (first 8 chars): %s...\n", jwtSecret[:8])
	fmt.Printf("  API Key: %s\n", apiKey)
	fmt.Printf("  Encryption Key (first 8 chars): %s...\n", encryptionKey[:8])
	fmt.Printf("  Encrypted JWT (first 8 chars): %s...\n", encryptedJWT[:8])
	fmt.Printf("  Decryption successful: %v\n", decryptedJWT == jwtSecret)
}

// ExampleFeatureFlags shows how to use feature flags
func ExampleFeatureFlags() {
	config := &Config{}

	// Enable different features based on environment
	if config.Environment.Name == "development" {
		config.Features.FraudDetection.Enabled = true
		config.Features.FraudDetection.Percentage = 100
		config.Features.AIAnalysis.Enabled = true
		config.Features.AIAnalysis.Percentage = 100
		config.Features.QuantumAnalysis.Enabled = false // Disabled in dev
		config.Features.QuantumAnalysis.Percentage = 0
		config.Features.RealTimeMonitoring.Enabled = true
		config.Features.RealTimeMonitoring.Percentage = 100
	} else if config.Environment.Name == "production" {
		config.Features.FraudDetection.Enabled = true
		config.Features.FraudDetection.Percentage = 100
		config.Features.AIAnalysis.Enabled = true
		config.Features.AIAnalysis.Percentage = 100
		config.Features.QuantumAnalysis.Enabled = true
		config.Features.QuantumAnalysis.Percentage = 100
		config.Features.RealTimeMonitoring.Enabled = true
		config.Features.RealTimeMonitoring.Percentage = 100
	}

	// Check if features are enabled
	fmt.Printf("Feature Flags Status:\n")
	fmt.Printf("  Fraud Detection: %v (%d%%)\n",
		config.Features.FraudDetection.Enabled,
		config.Features.FraudDetection.Percentage)
	fmt.Printf("  AI Analysis: %v (%d%%)\n",
		config.Features.AIAnalysis.Enabled,
		config.Features.AIAnalysis.Percentage)
	fmt.Printf("  Quantum Analysis: %v (%d%%)\n",
		config.Features.QuantumAnalysis.Enabled,
		config.Features.QuantumAnalysis.Percentage)
	fmt.Printf("  Real-time Monitoring: %v (%d%%)\n",
		config.Features.RealTimeMonitoring.Enabled,
		config.Features.RealTimeMonitoring.Percentage)
}

// ExampleMonitoringSetup shows how to configure monitoring
func ExampleMonitoringSetup() {
	config := &Config{}

	// Configure monitoring based on environment
	if config.Environment.Name == "production" {
		config.Monitoring.Enabled = true
		config.Monitoring.Metrics.Enabled = true
		config.Monitoring.Metrics.Provider = "prometheus"
		config.Monitoring.Metrics.Port = 9090
		config.Monitoring.Metrics.Namespace = "quantumbeam"
		config.Monitoring.Metrics.Subsystem = "production"

		config.Monitoring.Tracing.Enabled = true
		config.Monitoring.Tracing.Provider = "jaeger"
		config.Monitoring.Tracing.SampleRate = 0.01 // Low sample rate in production
		config.Monitoring.Tracing.ServiceName = "quantumbeam-api-prod"

		config.Monitoring.HealthCheck.Enabled = true
		config.Monitoring.HealthCheck.Port = 8081
		config.Monitoring.HealthCheck.Interval = 15 * time.Second

		config.Monitoring.Profiling.Enabled = false // Disabled in production
	} else {
		config.Monitoring.Enabled = true
		config.Monitoring.Metrics.Enabled = true
		config.Monitoring.Metrics.Port = 9090
		config.Monitoring.Tracing.SampleRate = 1.0 // Full sampling in development
		config.Monitoring.Profiling.Enabled = true // Enable profiling in dev
	}

	fmt.Printf("Monitoring Configuration:\n")
	fmt.Printf("  Enabled: %v\n", config.Monitoring.Enabled)
	fmt.Printf("  Metrics: %v (Provider: %s, Port: %d)\n",
		config.Monitoring.Metrics.Enabled,
		config.Monitoring.Metrics.Provider,
		config.Monitoring.Metrics.Port)
	fmt.Printf("  Tracing: %v (Sample Rate: %.2f)\n",
		config.Monitoring.Tracing.Enabled,
		config.Monitoring.Tracing.SampleRate)
	fmt.Printf("  Health Check: %v (Port: %d)\n",
		config.Monitoring.HealthCheck.Enabled,
		config.Monitoring.HealthCheck.Port)
	fmt.Printf("  Profiling: %v\n", config.Monitoring.Profiling.Enabled)
}

// RunAllExamples runs all configuration examples
func RunAllExamples() {
	fmt.Println("=== Configuration System Examples ===\n")

	fmt.Println("1. Basic Configuration Loading:")
	Example()

	fmt.Println("\n2. Production Configuration Setup:")
	ExampleProductionConfig()

	fmt.Println("\n3. Development Configuration Setup:")
	ExampleDevelopmentConfig()

	fmt.Println("\n4. Environment Overrides:")
	ExampleEnvironmentOverrides()

	fmt.Println("\n5. Secret Management:")
	ExampleSecretManagement()

	fmt.Println("\n6. Feature Flags:")
	ExampleFeatureFlags()

	fmt.Println("\n7. Monitoring Setup:")
	ExampleMonitoringSetup()

	fmt.Println("\n=== All examples completed successfully ===")
}
