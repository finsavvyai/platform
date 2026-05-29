//go:build legacy_migrated
// +build legacy_migrated

package config

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

// Custom validation functions
func registerCustomValidations(v *validator.Validate) error {
	// Register custom validation tags
	if err := v.RegisterValidation("db_url", validateDBURL); err != nil {
		return fmt.Errorf("failed to register db_url validation: %w", err)
	}

	if err := v.RegisterValidation("url", validateURL); err != nil {
		return fmt.Errorf("failed to register url validation: %w", err)
	}

	if err := v.RegisterValidation("api_key_format", validateAPIKeyFormat); err != nil {
		return fmt.Errorf("failed to register api_key_format validation: %w", err)
	}

	if err := v.RegisterValidation("jwt_secret", validateJWTSecret); err != nil {
		return fmt.Errorf("failed to register jwt_secret validation: %w", err)
	}

	if err := v.RegisterValidation("encryption_key", validateEncryptionKey); err != nil {
		return fmt.Errorf("failed to register encryption_key validation: %w", err)
	}

	if err := v.RegisterValidation("feature_percentage", validateFeaturePercentage); err != nil {
		return fmt.Errorf("failed to register feature_percentage validation: %w", err)
	}

	if err := v.RegisterValidation("port_range", validatePortRange); err != nil {
		return fmt.Errorf("failed to register port_range validation: %w", err)
	}

	if err := v.RegisterValidation("duration_positive", validatePositiveDuration); err != nil {
		return fmt.Errorf("failed to register duration_positive validation: %w", err)
	}

	if err := v.RegisterValidation("password_strength", validatePasswordStrength); err != nil {
		return fmt.Errorf("failed to register password_strength validation: %w", err)
	}

	if err := v.RegisterValidation("email_domain", validateEmailDomain); err != nil {
		return fmt.Errorf("failed to register email_domain validation: %w", err)
	}

	if err := v.RegisterValidation("csp_policy", validateCSPPolicy); err != nil {
		return fmt.Errorf("failed to register csp_policy validation: %w", err)
	}

	if err := v.RegisterValidation("feature_name", validateFeatureName); err != nil {
		return fmt.Errorf("failed to register feature_name validation: %w", err)
	}

	if err := v.RegisterValidation("rate_limit_window", validateRateLimitWindow); err != nil {
		return fmt.Errorf("failed to register rate_limit_window validation: %w", err)
	}

	if err := v.RegisterValidation("cache_prefix", validateCachePrefix); err != nil {
		return fmt.Errorf("failed to register cache_prefix validation: %w", err)
	}

	return nil
}

// validateDBURL validates database URL format
func validateDBURL(fl validator.FieldLevel) bool {
	url := fl.Field().String()

	// PostgreSQL connection string patterns
	dbPatterns := []string{
		`^postgres://[^\s]+$`,
		`^postgresql://[^\s]+$`,
		`^[a-zA-Z0-9]+://[^\s]+$`, // Generic DSN
	}

	for _, pattern := range dbPatterns {
		if matched, _ := regexp.MatchString(pattern, url); matched {
			return true
		}
	}

	return false
}

// validateURL validates URL format
func validateURL(fl validator.FieldLevel) bool {
	url := fl.Field().String()

	urlPattern := `^https?://[^\s/$.?#].[^\s]*$`
	matched, _ := regexp.MatchString(urlPattern, url)

	return matched
}

// validateAPIKeyFormat validates API key format
func validateAPIKeyFormat(fl validator.FieldLevel) bool {
	key := fl.Field().String()

	// API keys should be alphanumeric with optional underscores and hyphens
	keyPattern := `^[a-zA-Z0-9_-]+$`
	matched, _ := regexp.MatchString(keyPattern, key)

	return matched && len(key) >= 16
}

// validateJWTSecret validates JWT secret strength
func validateJWTSecret(fl validator.FieldLevel) bool {
	secret := fl.Field().String()

	// JWT secrets should be at least 32 characters for HS256
	return len(secret) >= 32
}

// validateEncryptionKey validates encryption key format
func validateEncryptionKey(fl validator.FieldLevel) bool {
	key := fl.Field().String()

	// Encryption keys should be base64 encoded or hex
	hexPattern := `^[0-9a-fA-F]+$`
	base64Pattern := `^[A-Za-z0-9+/]*={0,2}$`

	matchedHex, _ := regexp.MatchString(hexPattern, key)
	matchedBase64, _ := regexp.MatchString(base64Pattern, key)

	return (matchedHex && len(key) >= 64) || (matchedBase64 && len(key) >= 44)
}

// validateFeaturePercentage validates feature flag percentage
func validateFeaturePercentage(fl validator.FieldLevel) bool {
	percentage := fl.Field().Int()

	return percentage >= 0 && percentage <= 100
}

// validatePortRange validates port range
func validatePortRange(fl validator.FieldLevel) bool {
	port := fl.Field().Int()

	return port >= 1 && port <= 65535
}

// validatePositiveDuration validates positive duration
func validatePositiveDuration(fl validator.FieldLevel) bool {
	duration := fl.Field().Interface().(time.Duration)

	return duration > 0
}

// validatePasswordStrength validates password policy
func validatePasswordStrength(fl validator.FieldLevel) bool {
	policy := fl.Field().Interface().(PasswordConfig)

	// Basic validation
	if policy.MinLength > policy.MaxLength {
		return false
	}

	if policy.MinLength < 6 {
		return false
	}

	if policy.MaxLength > 128 {
		return false
	}

	// If special characters are required, ensure at least one is defined
	if policy.RequireSpecial && policy.SpecialChars == "" {
		policy.SpecialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
	}

	return true
}

// validateEmailDomain validates email domain format
func validateEmailDomain(fl validator.FieldLevel) bool {
	domain := fl.Field().String()

	if domain == "" {
		return true // Optional field
	}

	domainPattern := `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
	matched, _ := regexp.MatchString(domainPattern, domain)

	return matched
}

// validateCSPPolicy validates CSP policy format
func validateCSPPolicy(fl validator.FieldLevel) bool {
	policy := fl.Field().String()

	if policy == "" {
		return true // Optional field
	}

	// Basic CSP policy validation - should contain at least one directive
	cspPattern := `^[a-zA-Z-]+\s+[^;]+(;[a-zA-Z-]+\s+[^;]+)*$`
	matched, _ := regexp.MatchString(cspPattern, policy)

	return matched
}

// validateFeatureName validates feature name format
func validateFeatureName(fl validator.FieldLevel) bool {
	name := fl.Field().String()

	// Feature names should be lowercase with underscores
	pattern := `^[a-z][a-z0-9_]*$`
	matched, _ := regexp.MatchString(pattern, name)

	return matched && len(name) >= 3 && len(name) <= 50
}

// validateRateLimitWindow validates rate limiting window
func validateRateLimitWindow(fl validator.FieldLevel) bool {
	window := fl.Field().Interface().(time.Duration)

	// Rate limit windows should be reasonable (between 1 second and 1 hour)
	return window >= time.Second && window <= time.Hour
}

// validateCachePrefix validates cache key prefix
func validateCachePrefix(fl validator.FieldLevel) bool {
	prefix := fl.Field().String()

	if prefix == "" {
		return true // Optional field
	}

	// Cache prefixes should be lowercase with optional colon separator
	pattern := `^[a-z][a-z0-9_:]*$`
	matched, _ := regexp.MatchString(pattern, prefix)

	return matched && len(prefix) <= 20
}

// ConfigValidator handles comprehensive configuration validation
type ConfigValidator struct {
	validator *validator.Validate
}

// NewConfigValidator creates a new configuration validator
func NewConfigValidator() (*ConfigValidator, error) {
	v := validator.New()

	// Register custom validations
	if err := registerCustomValidations(v); err != nil {
		return nil, err
	}

	// Register custom validation functions for complex types
	v.RegisterStructValidation(validateServerConfig, ServerConfig{})
	v.RegisterStructValidation(validateDatabaseConfig, DatabaseConfig{})
	v.RegisterStructValidation(validateSecurityConfig, SecurityConfig{})
	v.RegisterStructValidation(validateMonitoringConfig, MonitoringConfig{})
	v.RegisterStructValidation(validateFeaturesConfig, FeaturesConfig{})

	return &ConfigValidator{
		validator: v,
	}, nil
}

// Validate performs comprehensive configuration validation
func (cv *ConfigValidator) Validate(config *Config) error {
	if err := cv.validator.Struct(config); err != nil {
		return cv.formatValidationError(err)
	}

	// Perform custom business logic validations
	if err := cv.validateBusinessRules(config); err != nil {
		return err
	}

	return nil
}

// validateServerConfig validates server configuration
func validateServerConfig(sl validator.StructLevel) {
	server := sl.Current().Interface().(ServerConfig)

	// Validate TLS configuration
	if server.TLS.Enabled {
		if server.TLS.CertFile == "" || server.TLS.KeyFile == "" {
			sl.ReportError(server.TLS, "TLS", "cert_or_key_missing", "TLS is enabled but cert_file or key_file is missing")
		}

		// Check if files exist (optional, may fail in containerized environments)
		// This is commented out as file existence checks may not be appropriate during validation
		/*
			if _, err := os.Stat(server.TLS.CertFile); os.IsNotExist(err) {
				sl.ReportError(server.TLS, "TLS", "cert_file_not_found", fmt.Sprintf("TLS cert file not found: %s", server.TLS.CertFile))
			}
			if _, err := os.Stat(server.TLS.KeyFile); os.IsNotExist(err) {
				sl.ReportError(server.TLS, "TLS", "key_file_not_found", fmt.Sprintf("TLS key file not found: %s", server.TLS.KeyFile))
			}
		*/
	}

	// Validate timeouts
	if server.ReadTimeout < time.Second {
		sl.ReportError(server.ReadTimeout, "ReadTimeout", "too_short", "Read timeout should be at least 1 second")
	}

	if server.WriteTimeout < time.Second {
		sl.ReportError(server.WriteTimeout, "WriteTimeout", "too_short", "Write timeout should be at least 1 second")
	}

	if server.IdleTimeout < server.ReadTimeout {
		sl.ReportError(server.IdleTimeout, "IdleTimeout", "too_short", "Idle timeout should be greater than or equal to read timeout")
	}

	// Validate CORS configuration
	if len(server.CORS.AllowedOrigins) == 0 {
		sl.ReportError(server.CORS, "CORS", "no_origins", "At least one allowed origin should be specified")
	}

	// Validate limits
	if server.Limits.MaxBodyBytes < 1024 {
		sl.ReportError(server.Limits, "Limits", "body_too_small", "Max body size should be at least 1KB")
	}

	if server.Limits.MaxHeaderBytes < 1024 {
		sl.ReportError(server.Limits, "Limits", "headers_too_small", "Max header size should be at least 1KB")
	}
}

// validateDatabaseConfig validates database configuration
func validateDatabaseConfig(sl validator.StructLevel) {
	db := sl.Current().Interface().(DatabaseConfig)

	// Validate connection pool settings
	if db.MinConnections > db.MaxConnections {
		sl.ReportError(db.MinConnections, "MinConnections", "greater_than_max", "Min connections cannot be greater than max connections")
	}

	if db.MaxIdleConnections > db.MaxConnections {
		sl.ReportError(db.MaxIdleConnections, "MaxIdleConnections", "greater_than_max", "Max idle connections cannot be greater than max connections")
	}

	// Validate timeouts
	if db.ConnectTimeout < time.Second {
		sl.ReportError(db.ConnectTimeout, "ConnectTimeout", "too_short", "Connect timeout should be at least 1 second")
	}

	if db.QueryTimeout < time.Second {
		sl.ReportError(db.QueryTimeout, "QueryTimeout", "too_short", "Query timeout should be at least 1 second")
	}

	if db.MaxLifetime < time.Minute {
		sl.ReportError(db.MaxLifetime, "MaxLifetime", "too_short", "Connection max lifetime should be at least 1 minute")
	}

	// Validate slow query threshold
	if db.SlowQueryThreshold < time.Millisecond {
		sl.ReportError(db.SlowQueryThreshold, "SlowQueryThreshold", "too_short", "Slow query threshold should be at least 1 millisecond")
	}

	// Validate SSL mode based on environment
	if db.SSLMode == "disable" {
		// This might be acceptable in development but should be validated elsewhere for production
	}
}

// validateSecurityConfig validates security configuration
func validateSecurityConfig(sl validator.StructLevel) {
	security := sl.Current().Interface().(SecurityConfig)

	// Validate JWT configuration
	if security.JWT.AccessExpiration > security.JWT.RefreshExpiration {
		sl.ReportError(security.JWT.AccessExpiration, "AccessExpiration", "greater_than_refresh", "Access expiration cannot be greater than refresh expiration")
	}

	if security.JWT.AccessExpiration < time.Minute {
		sl.ReportError(security.JWT.AccessExpiration, "AccessExpiration", "too_short", "Access expiration should be at least 1 minute")
	}

	// Validate session configuration
	if security.Session.MaxAge < time.Minute {
		sl.ReportError(security.Session.MaxAge, "MaxAge", "too_short", "Session max age should be at least 1 minute")
	}

	// Validate API key configuration
	if security.APIKey.DefaultExpiration > security.APIKey.MaxExpiration {
		sl.ReportError(security.APIKey.DefaultExpiration, "DefaultExpiration", "greater_than_max", "Default API key expiration cannot be greater than max expiration")
	}

	if security.APIKey.MaxExpiration < time.Hour {
		sl.ReportError(security.APIKey.MaxExpiration, "MaxExpiration", "too_short", "Max API key expiration should be at least 1 hour")
	}

	// Validate rate limiting configuration
	if security.RateLimit.BurstSize > security.RateLimit.GlobalLimit {
		sl.ReportError(security.RateLimit.BurstSize, "BurstSize", "greater_than_limit", "Burst size cannot be greater than global limit")
	}

	if security.RateLimit.Window < time.Second {
		sl.ReportError(security.RateLimit.Window, "Window", "too_short", "Rate limit window should be at least 1 second")
	}
}

// validateMonitoringConfig validates monitoring configuration
func validateMonitoringConfig(sl validator.StructLevel) {
	monitoring := sl.Current().Interface().(MonitoringConfig)

	// Validate metrics configuration
	if monitoring.Metrics.Enabled {
		if monitoring.Metrics.Port == monitoring.HealthCheck.Port && monitoring.Metrics.Port != 0 {
			sl.ReportError(monitoring.Metrics.Port, "Port", "port_conflict", "Metrics port conflicts with health check port")
		}
	}

	// Validate tracing configuration
	if monitoring.Tracing.Enabled {
		if monitoring.Tracing.SampleRate < 0 || monitoring.Tracing.SampleRate > 1 {
			sl.ReportError(monitoring.Tracing.SampleRate, "SampleRate", "invalid_range", "Sample rate must be between 0 and 1")
		}

		if monitoring.Tracing.Timeout < time.Second {
			sl.ReportError(monitoring.Tracing.Timeout, "Timeout", "too_short", "Tracing timeout should be at least 1 second")
		}
	}

	// Validate health check configuration
	if monitoring.HealthCheck.Enabled {
		if monitoring.HealthCheck.Interval < time.Second {
			sl.ReportError(monitoring.HealthCheck.Interval, "Interval", "too_short", "Health check interval should be at least 1 second")
		}

		if monitoring.HealthCheck.Timeout > monitoring.HealthCheck.Interval {
			sl.ReportError(monitoring.HealthCheck.Timeout, "Timeout", "too_long", "Health check timeout should be less than interval")
		}

		if monitoring.HealthCheck.FailureThreshold < 1 {
			sl.ReportError(monitoring.HealthCheck.FailureThreshold, "FailureThreshold", "too_low", "Failure threshold should be at least 1")
		}
	}

	// Validate profiling configuration
	if monitoring.Profiling.Enabled {
		if monitoring.Profiling.SampleRate < 0 || monitoring.Profiling.SampleRate > 1 {
			sl.ReportError(monitoring.Profiling.SampleRate, "SampleRate", "invalid_range", "Profiling sample rate must be between 0 and 1")
		}
	}
}

// validateFeaturesConfig validates features configuration
func validateFeaturesConfig(sl validator.StructLevel) {
	features := sl.Current().Interface().(FeaturesConfig)

	// Validate each feature configuration
	featureValues := reflect.ValueOf(features)
	featureType := reflect.TypeOf(features)

	for i := 0; i < featureValues.NumField(); i++ {
		field := featureValues.Field(i)
		fieldType := featureType.Field(i)

		if field.Kind() == reflect.Struct {
			featureConfig := field.Interface().(FeatureConfig)
			fieldName := fieldType.Name

			// Validate percentage
			if featureConfig.Percentage < 0 || featureConfig.Percentage > 100 {
				sl.ReportError(featureConfig.Percentage, fieldName, "invalid_percentage", "Feature percentage must be between 0 and 100")
			}

			// Validate conditions
			for _, condition := range featureConfig.Conditions {
				if condition.Type == "" || condition.Property == "" || condition.Operator == "" {
					sl.ReportError(condition, fieldName, "invalid_condition", "Feature conditions must have type, property, and operator")
				}
			}
		}
	}
}

// validateBusinessRules performs business logic validation
func (cv *ConfigValidator) validateBusinessRules(config *Config) error {
	var errors []string

	// Production environment validations
	if config.Environment.Name == "production" {
		if config.Environment.Debug {
			errors = append(errors, "Debug mode should be disabled in production")
		}

		if config.Logging.Level == "debug" || config.Logging.Level == "trace" {
			errors = append(errors, "Debug or trace logging should not be used in production")
		}

		if !config.Server.TLS.Enabled {
			errors = append(errors, "TLS should be enabled in production")
		}

		if config.Database.SSLMode == "disable" {
			errors = append(errors, "Database SSL should not be disabled in production")
		}

		if !config.Security.Session.Secure {
			errors = append(errors, "Session secure flag should be enabled in production")
		}

		if config.Security.JWT.Secret == "your-super-secret-jwt-key-change-this-in-production" {
			errors = append(errors, "Default JWT secret should be changed in production")
		}

		if !config.Monitoring.Tracing.Enabled {
			errors = append(errors, "Tracing should be enabled in production")
		}

		if config.Monitoring.Tracing.SampleRate > 0.1 {
			errors = append(errors, "Tracing sample rate should be reduced in production")
		}
	}

	// Development environment validations
	if config.Environment.Name == "development" {
		if config.Database.SSLMode == "require" || config.Database.SSLMode == "verify-ca" || config.Database.SSLMode == "verify-full" {
			// This is acceptable but might be noted
		}
	}

	// Port conflict validations
	usedPorts := make(map[int]string)

	if config.Server.Port != 0 {
		if existing, exists := usedPorts[config.Server.Port]; exists {
			errors = append(errors, fmt.Sprintf("Port %d is already used by %s", config.Server.Port, existing))
		}
		usedPorts[config.Server.Port] = "server"
	}

	if config.Monitoring.Metrics.Enabled && config.Monitoring.Metrics.Port != 0 {
		if existing, exists := usedPorts[config.Monitoring.Metrics.Port]; exists {
			errors = append(errors, fmt.Sprintf("Port %d is already used by %s", config.Monitoring.Metrics.Port, existing))
		}
		usedPorts[config.Monitoring.Metrics.Port] = "metrics"
	}

	if config.Monitoring.HealthCheck.Enabled && config.Monitoring.HealthCheck.Port != 0 {
		if existing, exists := usedPorts[config.Monitoring.HealthCheck.Port]; exists {
			errors = append(errors, fmt.Sprintf("Port %d is already used by %s", config.Monitoring.HealthCheck.Port, existing))
		}
		usedPorts[config.Monitoring.HealthCheck.Port] = "health_check"
	}

	if config.Monitoring.Profiling.Enabled && config.Monitoring.Profiling.Port != 0 {
		if existing, exists := usedPorts[config.Monitoring.Profiling.Port]; exists {
			errors = append(errors, fmt.Sprintf("Port %d is already used by %s", config.Monitoring.Profiling.Port, existing))
		}
		usedPorts[config.Monitoring.Profiling.Port] = "profiling"
	}

	// Feature flag consistency validations
	if config.Features.FraudDetection.Enabled && config.Features.FraudDetection.Percentage == 0 {
		errors = append(errors, "Fraud detection is enabled but percentage is 0")
	}

	if config.Features.AIAnalysis.Enabled && !config.AI.Enabled {
		errors = append(errors, "AI analysis feature is enabled but AI service is disabled")
	}

	if config.Features.QuantumAnalysis.Enabled && !config.Quantum.Enabled {
		errors = append(errors, "Quantum analysis feature is enabled but quantum service is disabled")
	}

	// Rate limiting consistency validations
	if config.RateLimiting.Global.Enabled && config.RateLimiting.Global.Limit == 0 {
		errors = append(errors, "Global rate limiting is enabled but limit is 0")
	}

	if config.RateLimiting.Users.Enabled && config.RateLimiting.Users.DefaultLimit == 0 {
		errors = append(errors, "User rate limiting is enabled but default limit is 0")
	}

	// Cache consistency validations
	if config.Cache.Enabled && config.Cache.Provider == "redis" && config.Redis.Host == "" {
		errors = append(errors, "Cache is enabled with Redis provider but Redis host is not configured")
	}

	if len(errors) > 0 {
		return fmt.Errorf("business rule validation failed:\n%s", strings.Join(errors, "\n"))
	}

	return nil
}

// formatValidationError formats validation errors for better readability
func (cv *ConfigValidator) formatValidationError(err error) error {
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		var errorMessages []string

		for _, e := range validationErrors {
			errorMessage := fmt.Sprintf(
				"%s: %s",
				getJSONFieldName(e),
				getErrorMessage(e),
			)
			errorMessages = append(errorMessages, errorMessage)
		}

		return fmt.Errorf("configuration validation failed:\n%s", strings.Join(errorMessages, "\n"))
	}

	return err
}

// getJSONFieldName gets the JSON field name from validation error
func getJSONFieldName(e validator.FieldError) string {
	field := e.Field()
	if e.Namespace() != "" {
		parts := strings.Split(e.Namespace(), ".")
		if len(parts) > 1 {
			field = strings.Join(parts[1:], ".")
		}
	}
	return field
}

// getErrorMessage gets a user-friendly error message
func getErrorMessage(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "is required"
	case "min":
		return fmt.Sprintf("must be at least %s", e.Param())
	case "max":
		return fmt.Sprintf("must be at most %s", e.Param())
	case "email":
		return "must be a valid email address"
	case "url":
		return "must be a valid URL"
	case "oneof":
		return fmt.Sprintf("must be one of: %s", e.Param())
	case "db_url":
		return "must be a valid database URL"
	case "api_key_format":
		return "must be a valid API key format (alphanumeric with underscores/hyphens, min 16 chars)"
	case "jwt_secret":
		return "must be at least 32 characters long"
	case "encryption_key":
		return "must be a valid encryption key (hex or base64 encoded)"
	case "feature_percentage":
		return "must be between 0 and 100"
	case "port_range":
		return "must be between 1 and 65535"
	case "duration_positive":
		return "must be a positive duration"
	case "password_strength":
		return "must have valid password policy settings"
	case "email_domain":
		return "must be a valid domain name"
	case "csp_policy":
		return "must be a valid CSP policy"
	case "feature_name":
		return "must be lowercase with underscores, 3-50 characters"
	case "rate_limit_window":
		return "must be between 1 second and 1 hour"
	case "cache_prefix":
		return "must be lowercase with underscores/colons, max 20 characters"
	default:
		return fmt.Sprintf("failed validation rule: %s", e.Tag())
	}
}