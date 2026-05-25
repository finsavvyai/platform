package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewConfigUtils(t *testing.T) {
	cu := NewConfigUtils()
	assert.NotNil(t, cu)
}

func TestGenerateJWTSecret(t *testing.T) {
	cu := NewConfigUtils()
	secret, err := cu.GenerateJWTSecret()
	assert.NoError(t, err)
	assert.NotEmpty(t, secret)
	assert.Greater(t, len(secret), 60) // base64 of 64 bytes
}

func TestGenerateAPIKey(t *testing.T) {
	cu := NewConfigUtils()
	key, err := cu.GenerateAPIKey("qb", 32)
	assert.NoError(t, err)
	assert.Contains(t, key, "qb_")
	assert.Greater(t, len(key), 32)

	keyNoPrefix, err := cu.GenerateAPIKey("", 16)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(keyNoPrefix), 16)

	keyMinLen, err := cu.GenerateAPIKey("", 5)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(keyMinLen), 16) // minimum enforced
}

func TestGenerateEncryptionKey(t *testing.T) {
	cu := NewConfigUtils()
	key, err := cu.GenerateEncryptionKey(32)
	assert.NoError(t, err)
	assert.NotEmpty(t, key)

	keyDefault, err := cu.GenerateEncryptionKey(0)
	assert.NoError(t, err)
	assert.NotEmpty(t, keyDefault)
}

func TestGenerateSecurePassword(t *testing.T) {
	cu := NewConfigUtils()
	pwd, err := cu.GenerateSecurePassword(16, true, true, true, true)
	assert.NoError(t, err)
	assert.Len(t, pwd, 16)

	pwdMin, err := cu.GenerateSecurePassword(4, true, true, true, true)
	assert.NoError(t, err)
	assert.Len(t, pwdMin, 8) // minimum 8

	pwdEmpty, err := cu.GenerateSecurePassword(10, false, false, false, false)
	assert.NoError(t, err)
	assert.Len(t, pwdEmpty, 10) // uses default charset
}

func TestHashPasswordAndVerify(t *testing.T) {
	cu := NewConfigUtils()
	hash, err := cu.HashPassword("MyStr0ng!Pass", 10)
	assert.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.True(t, cu.VerifyPassword("MyStr0ng!Pass", hash))
	assert.False(t, cu.VerifyPassword("wrong_password", hash))
}

func TestGenerateUUID(t *testing.T) {
	cu := NewConfigUtils()
	id := cu.GenerateUUID()
	assert.NotEmpty(t, id)
	assert.Len(t, id, 36) // UUID format
}

func TestGenerateInstanceID(t *testing.T) {
	cu := NewConfigUtils()
	id := cu.GenerateInstanceID("myhost")
	assert.Contains(t, id, "myhost-")

	idEmpty := cu.GenerateInstanceID("")
	assert.Contains(t, idEmpty, "unknown-")
}

func TestGetDatabaseConnectionString(t *testing.T) {
	cu := NewConfigUtils()
	dbCfg := DatabaseConfig{
		Host: "db.example.com", Port: 5432,
		User: "admin", Password: "secret", DBName: "mydb", SSLMode: "require",
	}
	connStr := cu.GetDatabaseConnectionString(dbCfg)
	assert.Equal(t, "postgres://admin:secret@db.example.com:5432/mydb?sslmode=require", connStr)
}

func TestGetRedisConnectionString(t *testing.T) {
	cu := NewConfigUtils()
	redisCfg := RedisConfig{Host: "redis.local", Port: 6379, DB: 0}
	assert.Equal(t, "redis.local:6379/0", cu.GetRedisConnectionString(redisCfg))

	redisCfgAuth := RedisConfig{Host: "redis.local", Port: 6379, DB: 1, Password: "pw"}
	assert.Equal(t, "pw@redis.local:6379/1", cu.GetRedisConnectionString(redisCfgAuth))
}

func TestValidateSecretStrength(t *testing.T) {
	cu := NewConfigUtils()
	assert.Error(t, cu.ValidateSecretStrength("short", 16))
	assert.Error(t, cu.ValidateSecretStrength("password", 4))
	assert.Error(t, cu.ValidateSecretStrength("onlylowercase1234567", 8))
	assert.NoError(t, cu.ValidateSecretStrength("MyStr0ng!Secr3t", 8))
}

func TestEncryptDecryptSecret(t *testing.T) {
	cu := NewConfigUtils()
	encrypted, err := cu.EncryptSecret("hello_world", "key")
	assert.NoError(t, err)

	decrypted, err := cu.DecryptSecret(encrypted, "key")
	assert.NoError(t, err)
	assert.Equal(t, "hello_world", decrypted)
}

func TestGetEnvVarWithDefault(t *testing.T) {
	cu := NewConfigUtils()
	t.Setenv("TEST_VAR_EXISTS", "found")
	assert.Equal(t, "found", cu.GetEnvVarWithDefault("TEST_VAR_EXISTS", "default"))
	assert.Equal(t, "default", cu.GetEnvVarWithDefault("TEST_VAR_MISSING", "default"))
}

func TestGetEnvVarAsBool(t *testing.T) {
	cu := NewConfigUtils()
	t.Setenv("TEST_BOOL_TRUE", "true")
	t.Setenv("TEST_BOOL_ONE", "1")
	t.Setenv("TEST_BOOL_FALSE", "false")
	assert.True(t, cu.GetEnvVarAsBool("TEST_BOOL_TRUE", false))
	assert.True(t, cu.GetEnvVarAsBool("TEST_BOOL_ONE", false))
	assert.False(t, cu.GetEnvVarAsBool("TEST_BOOL_FALSE", true))
	assert.True(t, cu.GetEnvVarAsBool("TEST_BOOL_MISSING", true))
}

func TestGetEnvVarAsInt(t *testing.T) {
	cu := NewConfigUtils()
	t.Setenv("TEST_INT", "42")
	t.Setenv("TEST_INT_BAD", "abc")
	assert.Equal(t, 42, cu.GetEnvVarAsInt("TEST_INT", 0))
	assert.Equal(t, 99, cu.GetEnvVarAsInt("TEST_INT_BAD", 99))
	assert.Equal(t, 10, cu.GetEnvVarAsInt("TEST_INT_MISSING", 10))
}

func TestGetEnvVarAsDuration(t *testing.T) {
	cu := NewConfigUtils()
	t.Setenv("TEST_DUR", "5s")
	assert.Equal(t, 5*time.Second, cu.GetEnvVarAsDuration("TEST_DUR", time.Minute))
	assert.Equal(t, time.Minute, cu.GetEnvVarAsDuration("TEST_DUR_MISSING", time.Minute))
}

func TestValidatePort(t *testing.T) {
	cu := NewConfigUtils()
	assert.NoError(t, cu.ValidatePort(8080))
	assert.NoError(t, cu.ValidatePort(1))
	assert.NoError(t, cu.ValidatePort(65535))
	assert.Error(t, cu.ValidatePort(0))
	assert.Error(t, cu.ValidatePort(65536))
	assert.Error(t, cu.ValidatePort(-1))
}

func TestValidateURL(t *testing.T) {
	cu := NewConfigUtils()
	assert.NoError(t, cu.ValidateURL("https://api.example.com"))
	assert.NoError(t, cu.ValidateURL("http://localhost:8080"))
	assert.Error(t, cu.ValidateURL(""))
	assert.Error(t, cu.ValidateURL("ftp://example.com"))
}

func TestValidateEmail(t *testing.T) {
	cu := NewConfigUtils()
	assert.NoError(t, cu.ValidateEmail("user@example.com"))
	assert.Error(t, cu.ValidateEmail(""))
	assert.Error(t, cu.ValidateEmail("invalid"))
}

func TestSanitizeConfigForExport(t *testing.T) {
	cu := NewConfigUtils()
	cfg := newBaseConfig()
	cfg.Database.Password = "real_password"
	cfg.Redis.Password = "real_redis_pw"

	sanitized := cu.SanitizeConfigForExport(cfg)
	assert.NotNil(t, sanitized)
	dbCfg := sanitized["database"].(DatabaseConfig)
	assert.Equal(t, "***REDACTED***", dbCfg.Password)
	redisCfg := sanitized["redis"].(RedisConfig)
	assert.Equal(t, "***REDACTED***", redisCfg.Password)
}
