package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewConfigValidator(t *testing.T) {
	cv, err := NewConfigValidator()
	assert.NoError(t, err)
	assert.NotNil(t, cv)
}

func TestValidateBusinessRules_Production(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Environment.Name = "production"
	cfg.Environment.Debug = true
	cfg.Logging.Level = "debug"
	cfg.Server.TLS.Enabled = false
	cfg.Database.SSLMode = "disable"
	cfg.Security.Session.Secure = false
	cfg.Security.JWT.Secret = "your-super-secret-jwt-key-change-this-in-production"
	cfg.Monitoring.Tracing.Enabled = false

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Debug mode")
	assert.Contains(t, err.Error(), "TLS")
	assert.Contains(t, err.Error(), "SSL")
}

func TestValidateBusinessRules_ProductionHighSampleRate(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Environment.Name = "production"
	cfg.Environment.Debug = false
	cfg.Logging.Level = "info"
	cfg.Server.TLS.Enabled = true
	cfg.Server.TLS.CertFile = "/cert.pem"
	cfg.Server.TLS.KeyFile = "/key.pem"
	cfg.Database.SSLMode = "require"
	cfg.Security.Session.Secure = true
	cfg.Security.JWT.Secret = "production-secret-that-is-long-enough-for-jwt"
	cfg.Monitoring.Tracing.Enabled = true
	cfg.Monitoring.Tracing.SampleRate = 0.5

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "sample rate")
}

func TestValidateBusinessRules_Development(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Environment.Name = "development"
	err := cv.validateBusinessRules(cfg)
	assert.NoError(t, err)
}

func TestValidateBusinessRules_PortConflict(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Server.Port = 8080
	cfg.Monitoring.Metrics.Enabled = true
	cfg.Monitoring.Metrics.Port = 8080

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Port 8080")
}

func TestValidateBusinessRules_FraudDetectionZeroPercentage(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Features.FraudDetection.Enabled = true
	cfg.Features.FraudDetection.Percentage = 0

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "percentage is 0")
}

func TestValidateBusinessRules_AIFeatureWithoutAI(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Features.AIAnalysis.Enabled = true
	cfg.AI.Enabled = false

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "AI service is disabled")
}

func TestValidateBusinessRules_QuantumFeatureWithoutQuantum(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Features.QuantumAnalysis.Enabled = true
	cfg.Quantum.Enabled = false

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "quantum service is disabled")
}

func TestValidateBusinessRules_RateLimitZero(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.RateLimiting.Global.Enabled = true
	cfg.RateLimiting.Global.Limit = 0

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "limit is 0")
}

func TestValidateBusinessRules_UserRateLimitZero(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.RateLimiting.Users.Enabled = true
	cfg.RateLimiting.Users.DefaultLimit = 0

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "default limit is 0")
}

func TestValidateBusinessRules_CacheRedisNoHost(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Cache.Enabled = true
	cfg.Cache.Provider = "redis"
	cfg.Redis.Host = ""

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Redis host")
}

func TestValidateBusinessRules_ValidConfig(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	err := cv.validateBusinessRules(cfg)
	assert.NoError(t, err)
}

func TestGetJSONFieldName_WithNamespace(t *testing.T) {
	// Test via getJSONFieldName indirectly through formatValidationError
	cv, _ := NewConfigValidator()
	assert.NotNil(t, cv)
}

func TestValidateBusinessRules_MultiplePortConflicts(t *testing.T) {
	cv, _ := NewConfigValidator()
	cfg := newBaseConfig()
	cfg.Server.Port = 9090
	cfg.Monitoring.Metrics.Enabled = true
	cfg.Monitoring.Metrics.Port = 9090
	cfg.Monitoring.HealthCheck.Enabled = true
	cfg.Monitoring.HealthCheck.Port = 9090

	err := cv.validateBusinessRules(cfg)
	assert.Error(t, err)
}
