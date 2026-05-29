package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_AllEnvironmentVariablesSet(t *testing.T) {
	// Arrange
	os.Setenv("PORT", "9090")
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("ENCRYPTION_KEY", "01234567890123456789012345678901")
	defer clearEnv()

	// Act
	cfg, err := Load()

	// Assert
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("Expected port 9090, got %s", cfg.Port)
	}

	if cfg.DatabaseURL != "postgres://test@localhost/testdb" {
		t.Errorf("Expected database URL, got %s", cfg.DatabaseURL)
	}

	if cfg.LogLevel != "debug" {
		t.Errorf("Expected log level debug, got %s", cfg.LogLevel)
	}

	if cfg.JWTSecret != "test-secret" {
		t.Errorf("Expected JWT secret, got %s", cfg.JWTSecret)
	}

	if cfg.Environment != "production" {
		t.Errorf("Expected environment production, got %s", cfg.Environment)
	}

	if len(cfg.EncryptionKey) < 32 {
		t.Errorf("Expected encryption key length >= 32, got %d", len(cfg.EncryptionKey))
	}
}

func TestLoad_DefaultValues(t *testing.T) {
	// Arrange
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	defer clearEnv()

	// Act
	cfg, err := Load()

	// Assert
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Expected default port 8080, got %s", cfg.Port)
	}

	if cfg.LogLevel != "info" {
		t.Errorf("Expected default log level info, got %s", cfg.LogLevel)
	}

	if cfg.Environment != "development" {
		t.Errorf("Expected default environment development, got %s", cfg.Environment)
	}

	if cfg.EncryptionKey == "" {
		t.Error("Expected default dev ENCRYPTION_KEY when unset in development")
	}
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	// Arrange
	clearEnv()

	// Act
	_, err := Load()

	// Assert
	if err == nil {
		t.Fatal("Expected error for missing DATABASE_URL, got nil")
	}

	expectedError := "DATABASE_URL is required"
	if err.Error() != expectedError {
		t.Errorf("Expected error %q, got %q", expectedError, err.Error())
	}
}

func TestLoad_MissingJWTSecretInProduction(t *testing.T) {
	// Arrange
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("ENCRYPTION_KEY", "01234567890123456789012345678901")
	defer clearEnv()

	// Act
	_, err := Load()

	// Assert
	if err == nil {
		t.Fatal("Expected error for missing JWT_SECRET in production, got nil")
	}

	expectedError := "JWT_SECRET is required in production"
	if err.Error() != expectedError {
		t.Errorf("Expected error %q, got %q", expectedError, err.Error())
	}
}

func TestLoad_MissingEncryptionKeyInProduction(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("JWT_SECRET", "test-secret")
	defer clearEnv()

	_, err := Load()
	if err == nil {
		t.Fatal("Expected error for missing ENCRYPTION_KEY in production, got nil")
	}
	if err.Error() != "ENCRYPTION_KEY is required in production" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoad_EncryptionKeyTooShortInProduction(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("ENCRYPTION_KEY", "short")
	defer clearEnv()

	_, err := Load()
	if err == nil {
		t.Fatal("Expected error for short ENCRYPTION_KEY in production, got nil")
	}
	if err.Error() != "ENCRYPTION_KEY must be at least 32 characters in production" {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoad_JWTSecretOptionalInDevelopment(t *testing.T) {
	// Arrange
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("ENVIRONMENT", "development")
	defer clearEnv()

	// Act
	cfg, err := Load()

	// Assert
	if err != nil {
		t.Fatalf("Expected no error in development without JWT_SECRET, got %v", err)
	}

	if cfg.JWTSecret != "" {
		t.Errorf("Expected empty JWT secret, got %s", cfg.JWTSecret)
	}
}

func TestGetEnv_WithValue(t *testing.T) {
	// Arrange
	os.Setenv("TEST_KEY", "test_value")
	defer os.Unsetenv("TEST_KEY")

	// Act
	value := getEnv("TEST_KEY", "default")

	// Assert
	if value != "test_value" {
		t.Errorf("Expected test_value, got %s", value)
	}
}

func TestGetEnv_WithDefault(t *testing.T) {
	// Arrange
	os.Unsetenv("NONEXISTENT_KEY")

	// Act
	value := getEnv("NONEXISTENT_KEY", "default_value")

	// Assert
	if value != "default_value" {
		t.Errorf("Expected default_value, got %s", value)
	}
}

func TestLoad_PoolConfigDefaults(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	defer clearEnv()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Pool.MaxConns != 10 {
		t.Errorf("expected default MaxConns 10, got %d", cfg.Pool.MaxConns)
	}
	if cfg.Pool.MinConns != 2 {
		t.Errorf("expected default MinConns 2, got %d", cfg.Pool.MinConns)
	}
	if cfg.Pool.MaxConnLifetime != time.Hour {
		t.Errorf("expected default MaxConnLifetime 1h, got %v", cfg.Pool.MaxConnLifetime)
	}
	if cfg.Pool.MaxConnIdleTime != 30*time.Minute {
		t.Errorf("expected default MaxConnIdleTime 30m, got %v", cfg.Pool.MaxConnIdleTime)
	}
	if cfg.Pool.QueryTimeout != 30*time.Second {
		t.Errorf("expected default QueryTimeout 30s, got %v", cfg.Pool.QueryTimeout)
	}
}

func TestLoad_PoolConfigFromEnv(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test@localhost/testdb")
	os.Setenv("DB_POOL_MAX_CONNS", "25")
	os.Setenv("DB_POOL_MIN_CONNS", "5")
	os.Setenv("DB_POOL_MAX_CONN_LIFETIME", "2h")
	os.Setenv("DB_POOL_MAX_CONN_IDLE_TIME", "15m")
	os.Setenv("DB_QUERY_TIMEOUT", "45s")
	defer clearEnv()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Pool.MaxConns != 25 {
		t.Errorf("expected MaxConns 25, got %d", cfg.Pool.MaxConns)
	}
	if cfg.Pool.MinConns != 5 {
		t.Errorf("expected MinConns 5, got %d", cfg.Pool.MinConns)
	}
	if cfg.Pool.MaxConnLifetime != 2*time.Hour {
		t.Errorf("expected MaxConnLifetime 2h, got %v", cfg.Pool.MaxConnLifetime)
	}
	if cfg.Pool.MaxConnIdleTime != 15*time.Minute {
		t.Errorf("expected MaxConnIdleTime 15m, got %v", cfg.Pool.MaxConnIdleTime)
	}
	if cfg.Pool.QueryTimeout != 45*time.Second {
		t.Errorf("expected QueryTimeout 45s, got %v", cfg.Pool.QueryTimeout)
	}
}

func TestGetEnvInt_WithValue(t *testing.T) {
	os.Setenv("TEST_INT_KEY", "42")
	defer os.Unsetenv("TEST_INT_KEY")

	if v := getEnvInt("TEST_INT_KEY", 10); v != 42 {
		t.Errorf("expected 42, got %d", v)
	}
}

func TestGetEnvInt_WithDefault(t *testing.T) {
	os.Unsetenv("TEST_INT_KEY_MISSING")
	if v := getEnvInt("TEST_INT_KEY_MISSING", 99); v != 99 {
		t.Errorf("expected default 99, got %d", v)
	}
}

func TestGetEnvInt_InvalidValue(t *testing.T) {
	os.Setenv("TEST_INT_INVALID", "not-a-number")
	defer os.Unsetenv("TEST_INT_INVALID")

	if v := getEnvInt("TEST_INT_INVALID", 7); v != 7 {
		t.Errorf("expected fallback 7 on invalid int, got %d", v)
	}
}

func TestGetEnvDuration_WithValue(t *testing.T) {
	os.Setenv("TEST_DUR_KEY", "5m")
	defer os.Unsetenv("TEST_DUR_KEY")

	if v := getEnvDuration("TEST_DUR_KEY", time.Second); v != 5*time.Minute {
		t.Errorf("expected 5m, got %v", v)
	}
}

func TestGetEnvDuration_WithDefault(t *testing.T) {
	os.Unsetenv("TEST_DUR_MISSING")
	if v := getEnvDuration("TEST_DUR_MISSING", 10*time.Second); v != 10*time.Second {
		t.Errorf("expected default 10s, got %v", v)
	}
}

func TestGetEnvDuration_InvalidValue(t *testing.T) {
	os.Setenv("TEST_DUR_INVALID", "notaduration")
	defer os.Unsetenv("TEST_DUR_INVALID")

	if v := getEnvDuration("TEST_DUR_INVALID", time.Minute); v != time.Minute {
		t.Errorf("expected fallback 1m on invalid duration, got %v", v)
	}
}

// Helper function to clear environment variables
func clearEnv() {
	os.Unsetenv("PORT")
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("LOG_LEVEL")
	os.Unsetenv("JWT_SECRET")
	os.Unsetenv("ENVIRONMENT")
	os.Unsetenv("ENCRYPTION_KEY")
	os.Unsetenv("DB_POOL_MAX_CONNS")
	os.Unsetenv("DB_POOL_MIN_CONNS")
	os.Unsetenv("DB_POOL_MAX_CONN_LIFETIME")
	os.Unsetenv("DB_POOL_MAX_CONN_IDLE_TIME")
	os.Unsetenv("DB_QUERY_TIMEOUT")
}
