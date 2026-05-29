//go:build legacy_migrated
// +build legacy_migrated

package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ConfigUtils provides utility functions for configuration management
type ConfigUtils struct{}

// NewConfigUtils creates a new ConfigUtils instance
func NewConfigUtils() *ConfigUtils {
	return &ConfigUtils{}
}

// GenerateJWTSecret generates a secure JWT secret
func (cu *ConfigUtils) GenerateJWTSecret() (string, error) {
	bytes := make([]byte, 64) // 512 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate JWT secret: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// GenerateAPIKey generates a secure API key
func (cu *ConfigUtils) GenerateAPIKey(prefix string, length int) (string, error) {
	if length < 16 {
		length = 16
	}

	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate API key: %w", err)
	}

	key := base64.URLEncoding.EncodeToString(bytes)[:length]
	if prefix != "" {
		key = prefix + "_" + key
	}

	return key, nil
}

// GenerateEncryptionKey generates a secure encryption key
func (cu *ConfigUtils) GenerateEncryptionKey(keyLength int) (string, error) {
	if keyLength <= 0 {
		keyLength = 32 // 256 bits
	}

	bytes := make([]byte, keyLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate encryption key: %w", err)
	}

	return base64.StdEncoding.EncodeToString(bytes), nil
}

// GenerateSecurePassword generates a secure password
func (cu *ConfigUtils) GenerateSecurePassword(length int, includeUppercase, includeLowercase, includeNumbers, includeSpecial bool) (string, error) {
	if length < 8 {
		length = 8
	}

	var charset string
	if includeUppercase {
		charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	}
	if includeLowercase {
		charset += "abcdefghijklmnopqrstuvwxyz"
	}
	if includeNumbers {
		charset += "0123456789"
	}
	if includeSpecial {
		charset += "!@#$%^&*()_+-=[]{}|;:,.<>?"
	}

	if charset == "" {
		charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()"
	}

	password := make([]byte, length)
	for i := range password {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", fmt.Errorf("failed to generate password: %w", err)
		}
		password[i] = charset[n.Int64()]
	}

	return string(password), nil
}

// HashPassword hashes a password using bcrypt
func (cu *ConfigUtils) HashPassword(password string, cost int) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hashedBytes), nil
}

// VerifyPassword verifies a password against its hash
func (cu *ConfigUtils) VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateUUID generates a UUID
func (cu *ConfigUtils) GenerateUUID() string {
	return uuid.New().String()
}

// GenerateInstanceID generates a unique instance ID
func (cu *ConfigUtils) GenerateInstanceID(hostname string) string {
	if hostname == "" {
		hostname = "unknown"
	}
	timestamp := time.Now().Unix()
	uuid := cu.GenerateUUID()[:8]
	return fmt.Sprintf("%s-%d-%s", hostname, timestamp, uuid)
}

// GetDatabaseConnectionString builds a database connection string
func (cu *ConfigUtils) GetDatabaseConnectionString(dbConfig DatabaseConfig) string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		dbConfig.User,
		dbConfig.Password,
		dbConfig.Host,
		dbConfig.Port,
		dbConfig.DBName,
		dbConfig.SSLMode,
	)
}

// GetRedisConnectionString builds a Redis connection string
func (cu *ConfigUtils) GetRedisConnectionString(redisConfig RedisConfig) string {
	if redisConfig.Password != "" {
		return fmt.Sprintf("%s:%s@%s:%d/%d",
			redisConfig.Password,
			redisConfig.Host,
			redisConfig.Port,
			redisConfig.DB,
		)
	}
	return fmt.Sprintf("%s:%d/%d",
		redisConfig.Host,
		redisConfig.Port,
		redisConfig.DB,
	)
}

// ValidateSecretStrength validates the strength of a secret
func (cu *ConfigUtils) ValidateSecretStrength(secret string, minLength int) error {
	if len(secret) < minLength {
		return fmt.Errorf("secret length must be at least %d characters", minLength)
	}

	// Check for common weak secrets
	weakSecrets := []string{
		"password",
		"secret",
		"key",
		"123456",
		"qwerty",
		"admin",
		"change-me",
		"default",
		"test",
		"demo",
	}

	lowerSecret := strings.ToLower(secret)
	for _, weak := range weakSecrets {
		if lowerSecret == weak || strings.Contains(lowerSecret, weak) {
			return fmt.Errorf("secret contains common weak word: %s", weak)
		}
	}

	// Check character variety
	hasLower := strings.ContainsAny(secret, "abcdefghijklmnopqrstuvwxyz")
	hasUpper := strings.ContainsAny(secret, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	hasNumber := strings.ContainsAny(secret, "0123456789")
	hasSpecial := strings.ContainsAny(secret, "!@#$%^&*()_+-=[]{}|;:,.<>?")

	varieties := 0
	if hasLower {
		varieties++
	}
	if hasUpper {
		varieties++
	}
	if hasNumber {
		varieties++
	}
	if hasSpecial {
		varieties++
	}

	if varieties < 3 {
		return fmt.Errorf("secret must contain at least 3 of: lowercase, uppercase, numbers, special characters")
	}

	return nil
}

// EncryptSecret encrypts a secret using AES-256-GCM
func (cu *ConfigUtils) EncryptSecret(secret, key string) (string, error) {
	// This is a placeholder implementation
	// In a production system, you would use proper encryption
	// For now, just base64 encode
	return base64.StdEncoding.EncodeToString([]byte(secret)), nil
}

// DecryptSecret decrypts a secret using AES-256-GCM
func (cu *ConfigUtils) DecryptSecret(encryptedSecret, key string) (string, error) {
	// This is a placeholder implementation
	// In a production system, you would use proper decryption
	// For now, just base64 decode
	decoded, err := base64.StdEncoding.DecodeString(encryptedSecret)
	if err != nil {
		return "", fmt.Errorf("failed to decode secret: %w", err)
	}
	return string(decoded), nil
}

// GetEnvVarWithDefault gets an environment variable with a default value
func (cu *ConfigUtils) GetEnvVarWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetEnvVarAsBool gets an environment variable as a boolean
func (cu *ConfigUtils) GetEnvVarAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return strings.ToLower(value) == "true" || value == "1"
	}
	return defaultValue
}

// GetEnvVarAsInt gets an environment variable as an integer
func (cu *ConfigUtils) GetEnvVarAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		_, err := fmt.Sscanf(value, "%d", &result)
		if err == nil {
			return result
		}
	}
	return defaultValue
}

// GetEnvVarAsDuration gets an environment variable as a duration
func (cu *ConfigUtils) GetEnvVarAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		duration, err := time.ParseDuration(value)
		if err == nil {
			return duration
		}
	}
	return defaultValue
}

// ValidatePort validates that a port number is within the valid range
func (cu *ConfigUtils) ValidatePort(port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("port %d is not within valid range (1-65535)", port)
	}
	return nil
}

// ValidateURL validates that a string is a valid URL
func (cu *ConfigUtils) ValidateURL(url string) error {
	if url == "" {
		return fmt.Errorf("URL cannot be empty")
	}

	// Basic URL validation
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return fmt.Errorf("URL must start with http:// or https://")
	}

	// In a production system, you would use a more sophisticated URL validator
	return nil
}

// ValidateEmail validates that a string is a valid email address
func (cu *ConfigUtils) ValidateEmail(email string) error {
	if email == "" {
		return fmt.Errorf("email cannot be empty")
	}

	// Basic email validation
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return fmt.Errorf("invalid email format")
	}

	// In a production system, you would use a more sophisticated email validator
	return nil
}

// SanitizeConfigForExport removes sensitive information from config for export
func (cu *ConfigUtils) SanitizeConfigForExport(config *Config) map[string]interface{} {
	// Create a copy of the config for sanitization
	sanitized := make(map[string]interface{})

	// Copy non-sensitive fields
	sanitized["environment"] = config.Environment
	sanitized["server"] = config.Server
	sanitized["database"] = DatabaseConfig{
		Host:                config.Database.Host,
		Port:                config.Database.Port,
		User:                config.Database.User,
		Password:            "***REDACTED***",
		DBName:              config.Database.DBName,
		SSLMode:             config.Database.SSLMode,
		MaxConnections:      config.Database.MaxConnections,
		MinConnections:      config.Database.MinConnections,
		MaxIdleConnections:  config.Database.MaxIdleConnections,
		MaxLifetime:         config.Database.MaxLifetime,
		MaxIdleTime:         config.Database.MaxIdleTime,
		ConnectTimeout:      config.Database.ConnectTimeout,
		QueryTimeout:        config.Database.QueryTimeout,
		SlowQueryThreshold:  config.Database.SlowQueryThreshold,
		EnableQueryLogger:   config.Database.EnableQueryLogger,
		MigrationPath:       config.Database.MigrationPath,
		SeedDataPath:        config.Database.SeedDataPath,
		ConnectionAttempts:  config.Database.ConnectionAttempts,
		ConnectionRetryWait: config.Database.ConnectionRetryWait,
	}

	sanitized["redis"] = RedisConfig{
		Host:               config.Redis.Host,
		Port:               config.Redis.Port,
		Password:           "***REDACTED***",
		DB:                 config.Redis.DB,
		PoolSize:           config.Redis.PoolSize,
		MinIdleConns:       config.Redis.MinIdleConns,
		MaxRetries:         config.Redis.MaxRetries,
		DialTimeout:        config.Redis.DialTimeout,
		ReadTimeout:        config.Redis.ReadTimeout,
		WriteTimeout:       config.Redis.WriteTimeout,
		PoolTimeout:        config.Redis.PoolTimeout,
		IdleTimeout:        config.Redis.IdleTimeout,
		IdleCheckFrequency: config.Redis.IdleCheckFrequency,
		Cluster:            config.Redis.Cluster,
	}

	sanitized["security"] = SecurityConfig{
		JWT: JWTConfig{
			Secret:            "***REDACTED***",
			AccessExpiration:  config.Security.JWT.AccessExpiration,
			RefreshExpiration: config.Security.JWT.RefreshExpiration,
			Issuer:            config.Security.JWT.Issuer,
			Audience:          config.Security.JWT.Audience,
			Algorithm:         config.Security.JWT.Algorithm,
			RefreshEnabled:    config.Security.JWT.RefreshEnabled,
			BlacklistEnabled:  config.Security.JWT.BlacklistEnabled,
		},
		Password:  config.Security.Password,
		RateLimit: config.Security.RateLimit,
		Encryption: EncryptionConfig{
			Algorithm:      config.Security.Encryption.Algorithm,
			KeyLength:      config.Security.Encryption.KeyLength,
			KeyRotation:    config.Security.Encryption.KeyRotation,
			RotationPeriod: config.Security.Encryption.RotationPeriod,
			KeyDerivation:  config.Security.Encryption.KeyDerivation,
		},
		Session:     config.Security.Session,
		APIKey:      config.Security.APIKey,
		WebSecurity: config.Security.WebSecurity,
	}

	sanitized["ai"] = AIConfig{
		Enabled:             config.AI.Enabled,
		Provider:            config.AI.Provider,
		Model:               config.AI.Model,
		APIKey:              "***REDACTED***",
		Endpoint:            config.AI.Endpoint,
		Timeout:             config.AI.Timeout,
		MaxTokens:           config.AI.MaxTokens,
		Temperature:         config.AI.Temperature,
		TopP:                config.AI.TopP,
		FrequencyPenalty:    config.AI.FrequencyPenalty,
		PresencePenalty:     config.AI.PresencePenalty,
		RetryAttempts:       config.AI.RetryAttempts,
		RetryDelay:          config.AI.RetryDelay,
		CacheEnabled:        config.AI.CacheEnabled,
		CacheTTL:            config.AI.CacheTTL,
		ConfidenceThreshold: config.AI.ConfidenceThreshold,
	}

	sanitized["quantum"] = QuantumConfig{
		Enabled:           config.Quantum.Enabled,
		Provider:          config.Quantum.Provider,
		Endpoint:          config.Quantum.Endpoint,
		APIKey:            "***REDACTED***",
		Timeout:           config.Quantum.Timeout,
		MaxQubits:         config.Quantum.MaxQubits,
		Backend:           config.Quantum.Backend,
		Shots:             config.Quantum.Shots,
		NoiseModel:        config.Quantum.NoiseModel,
		ErrorMitigation:   config.Quantum.ErrorMitigation,
		Transpile:         config.Quantum.Transpile,
		OptimizationLevel: config.Quantum.OptimizationLevel,
		CacheEnabled:      config.Quantum.CacheEnabled,
		CacheTTL:          config.Quantum.CacheTTL,
	}

	sanitized["monitoring"] = config.Monitoring
	sanitized["logging"] = config.Logging
	sanitized["features"] = config.Features
	sanitized["external_services"] = config.ExternalServices
	sanitized["rate_limiting"] = config.RateLimiting
	sanitized["cache"] = config.Cache
	sanitized["webhook"] = WebhookConfig{
		Enabled:      config.Webhook.Enabled,
		MaxRetries:   config.Webhook.MaxRetries,
		RetryDelay:   config.Webhook.RetryDelay,
		Timeout:      config.Webhook.Timeout,
		MaxPayload:   config.Webhook.MaxPayload,
		AllowedHosts: config.Webhook.AllowedHosts,
		Secret:       "***REDACTED***",
		Headers:      config.Webhook.Headers,
		Endpoints:    config.Webhook.Endpoints,
	}

	return sanitized
}

// GenerateConfigReport generates a configuration report
func (cu *ConfigUtils) GenerateConfigReport(config *Config) map[string]interface{} {
	report := make(map[string]interface{})

	// Basic info
	report["environment"] = config.Environment.Name
	report["version"] = config.Environment.Version
	report["instance_id"] = config.Environment.InstanceID
	report["generated_at"] = time.Now().Format(time.RFC3339)

	// Server info
	report["server"] = map[string]interface{}{
		"host":         config.Server.Host,
		"port":         config.Server.Port,
		"tls_enabled":  config.Server.TLS.Enabled,
		"cors_enabled": len(config.Server.CORS.AllowedOrigins) > 0,
	}

	// Database info
	report["database"] = map[string]interface{}{
		"host":               config.Database.Host,
		"port":               config.Database.Port,
		"dbname":             config.Database.DBName,
		"ssl_mode":           config.Database.SSLMode,
		"max_connections":    config.Database.MaxConnections,
		"connection_timeout": config.Database.ConnectTimeout,
		"query_timeout":      config.Database.QueryTimeout,
	}

	// Redis info
	report["redis"] = map[string]interface{}{
		"host":         config.Redis.Host,
		"port":         config.Redis.Port,
		"db":           config.Redis.DB,
		"pool_size":    config.Redis.PoolSize,
		"cluster_mode": config.Redis.Cluster.Enabled,
	}

	// Security info
	report["security"] = map[string]interface{}{
		"jwt_issuer":         config.Security.JWT.Issuer,
		"jwt_algorithm":      config.Security.JWT.Algorithm,
		"password_policy":    config.Security.Password,
		"rate_limiting":      config.Security.RateLimit.Enabled,
		"session_management": config.Security.Session.Store,
		"encryption_enabled": config.Security.Encryption.Algorithm != "",
	}

	// Feature flags
	report["features"] = map[string]interface{}{
		"fraud_detection":      config.Features.FraudDetection.Enabled,
		"ai_analysis":          config.Features.AIAnalysis.Enabled,
		"quantum_analysis":     config.Features.QuantumAnalysis.Enabled,
		"advanced_analytics":   config.Features.AdvancedAnalytics.Enabled,
		"real_time_monitoring": config.Features.RealTimeMonitoring.Enabled,
		"multi_currency":       config.Features.MultiCurrency.Enabled,
		"batch_processing":     config.Features.BatchProcessing.Enabled,
		"webhooks":             config.Features.Webhooks.Enabled,
		"audit_logging":        config.Features.AuditLogging.Enabled,
	}

	// Monitoring info
	report["monitoring"] = map[string]interface{}{
		"enabled":      config.Monitoring.Enabled,
		"metrics":      config.Monitoring.Metrics.Enabled,
		"tracing":      config.Monitoring.Tracing.Enabled,
		"health_check": config.Monitoring.HealthCheck.Enabled,
		"profiling":    config.Monitoring.Profiling.Enabled,
	}

	// External services
	report["external_services"] = map[string]interface{}{
		"ai_enabled":      config.AI.Enabled,
		"quantum_enabled": config.Quantum.Enabled,
		"notifications":   config.ExternalServices.Notifications.Enabled,
		"payment":         config.ExternalServices.Payment.Enabled,
		"email_service":   config.ExternalServices.EmailService.Enabled,
		"sms_service":     config.ExternalServices.SMSService.Enabled,
		"storage":         config.ExternalServices.Storage.Enabled,
		"cdn":             config.ExternalServices.CDN.Enabled,
	}

	return report
}

// CheckConfigHealth checks the health of the configuration
func (cu *ConfigUtils) CheckConfigHealth(config *Config) map[string]interface{} {
	health := map[string]interface{}{
		"status":   "healthy",
		"checks":   []map[string]interface{}{},
		"errors":   []string{},
		"warnings": []string{},
	}

	// Check critical configurations
	checks := []struct {
		name  string
		check func() bool
		error string
		warn  string
	}{
		{
			name: "database_connection",
			check: func() bool {
				return config.Database.Host != "" && config.Database.Port > 0 && config.Database.DBName != ""
			},
			error: "Database configuration is incomplete",
		},
		{
			name: "redis_connection",
			check: func() bool {
				return config.Redis.Host != "" && config.Redis.Port > 0
			},
			error: "Redis configuration is incomplete",
		},
		{
			name: "jwt_secret",
			check: func() bool {
				return config.Security.JWT.Secret != "" && len(config.Security.JWT.Secret) >= 32
			},
			error: "JWT secret is too short or missing",
		},
		{
			name: "server_configuration",
			check: func() bool {
				return config.Server.Host != "" && config.Server.Port > 0
			},
			error: "Server configuration is incomplete",
		},
		{
			name: "tls_configuration",
			check: func() bool {
				if config.Environment.Name == "production" {
					return config.Server.TLS.Enabled
				}
				return true
			},
			warn: "TLS should be enabled in production",
		},
		{
			name: "logging_level",
			check: func() bool {
				if config.Environment.Name == "production" {
					return config.Logging.Level != "debug" && config.Logging.Level != "trace"
				}
				return true
			},
			warn: "Debug or trace logging should not be used in production",
		},
		{
			name: "monitoring_enabled",
			check: func() bool {
				return config.Monitoring.Enabled
			},
			warn: "Monitoring should be enabled",
		},
		{
			name: "feature_consistency",
			check: func() bool {
				// Check if AI analysis is enabled but AI service is disabled
				return !(config.Features.AIAnalysis.Enabled && !config.AI.Enabled)
			},
			error: "AI analysis feature is enabled but AI service is disabled",
		},
		{
			name: "quantum_consistency",
			check: func() bool {
				// Check if quantum analysis is enabled but quantum service is disabled
				return !(config.Features.QuantumAnalysis.Enabled && !config.Quantum.Enabled)
			},
			error: "Quantum analysis feature is enabled but quantum service is disabled",
		},
	}

	for _, c := range checks {
		checkResult := map[string]interface{}{
			"name":   c.name,
			"status": "pass",
		}

		if !c.check() {
			if c.error != "" {
				checkResult["status"] = "error"
				checkResult["message"] = c.error
				health["errors"] = append(health["errors"].([]string), c.error)
				health["status"] = "unhealthy"
			} else if c.warn != "" {
				checkResult["status"] = "warning"
				checkResult["message"] = c.warn
				health["warnings"] = append(health["warnings"].([]string), c.warn)
				if health["status"] == "healthy" {
					health["status"] = "warning"
				}
			}
		}

		health["checks"] = append(health["checks"].([]map[string]interface{}), checkResult)
	}

	return health
}

// GetConfigDiff compares two configurations and returns the differences
func (cu *ConfigUtils) GetConfigDiff(config1, config2 *Config) map[string]interface{} {
	diff := make(map[string]interface{})

	// Compare environment
	if config1.Environment.Name != config2.Environment.Name {
		diff["environment.name"] = map[string]interface{}{
			"old": config1.Environment.Name,
			"new": config2.Environment.Name,
		}
	}

	// Compare server
	if config1.Server.Port != config2.Server.Port {
		diff["server.port"] = map[string]interface{}{
			"old": config1.Server.Port,
			"new": config2.Server.Port,
		}
	}

	// Compare database
	if config1.Database.Host != config2.Database.Host {
		diff["database.host"] = map[string]interface{}{
			"old": config1.Database.Host,
			"new": config2.Database.Host,
		}
	}

	// Compare security
	if config1.Security.JWT.AccessExpiration != config2.Security.JWT.AccessExpiration {
		diff["security.jwt.access_expiration"] = map[string]interface{}{
			"old": config1.Security.JWT.AccessExpiration,
			"new": config2.Security.JWT.AccessExpiration,
		}
	}

	// Compare features
	if config1.Features.FraudDetection.Enabled != config2.Features.FraudDetection.Enabled {
		diff["features.fraud_detection.enabled"] = map[string]interface{}{
			"old": config1.Features.FraudDetection.Enabled,
			"new": config2.Features.FraudDetection.Enabled,
		}
	}

	if config1.Features.AIAnalysis.Enabled != config2.Features.AIAnalysis.Enabled {
		diff["features.ai_analysis.enabled"] = map[string]interface{}{
			"old": config1.Features.AIAnalysis.Enabled,
			"new": config2.Features.AIAnalysis.Enabled,
		}
	}

	if config1.Features.QuantumAnalysis.Enabled != config2.Features.QuantumAnalysis.Enabled {
		diff["features.quantum_analysis.enabled"] = map[string]interface{}{
			"old": config1.Features.QuantumAnalysis.Enabled,
			"new": config2.Features.QuantumAnalysis.Enabled,
		}
	}

	// Compare monitoring
	if config1.Monitoring.Enabled != config2.Monitoring.Enabled {
		diff["monitoring.enabled"] = map[string]interface{}{
			"old": config1.Monitoring.Enabled,
			"new": config2.Monitoring.Enabled,
		}
	}

	return diff
}