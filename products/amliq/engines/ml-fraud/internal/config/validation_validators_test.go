package config

import (
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
)

func TestValidateDBURL(t *testing.T) {
	tests := []struct {
		name  string
		url   string
		valid bool
	}{
		{"postgres scheme", "postgres://user:pass@host:5432/db", true},
		{"postgresql scheme", "postgresql://user:pass@host/db", true},
		{"generic dsn", "mysql://root@localhost/test", true},
		{"empty string", "", false},
		{"plain text", "not-a-url", false},
	}
	v := validator.New()
	_ = v.RegisterValidation("db_url", validateDBURL)
	type w struct {
		URL string `validate:"db_url"`
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := v.Struct(w{URL: tc.url})
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestValidateURL_Validator(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("url", validateURL)
	type w struct {
		URL string `validate:"url"`
	}
	tests := []struct {
		name  string
		url   string
		valid bool
	}{
		{"https", "https://api.example.com", true},
		{"http", "http://localhost:8080/path", true},
		{"ftp", "ftp://files.example.com", false},
		{"empty", "", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := v.Struct(w{URL: tc.url})
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestValidateAPIKeyFormat(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("api_key_format", validateAPIKeyFormat)
	type w struct {
		Key string `validate:"api_key_format"`
	}
	tests := []struct {
		name  string
		key   string
		valid bool
	}{
		{"valid 16 chars", "abcdefghij123456", true},
		{"valid with underscore", "api_key_12345678", true},
		{"too short", "short", false},
		{"special chars", "key@invalid!char", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := v.Struct(w{Key: tc.key})
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestValidateJWTSecret(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("jwt_secret", validateJWTSecret)
	type w struct {
		Secret string `validate:"jwt_secret"`
	}
	assert.NoError(t, v.Struct(w{Secret: "this-is-a-valid-secret-key-that-is-at-least-32"}))
	assert.Error(t, v.Struct(w{Secret: "short"}))
}

func TestValidateEncryptionKey(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("encryption_key", validateEncryptionKey)
	type w struct {
		Key string `validate:"encryption_key"`
	}
	hexKey := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" // 64 hex
	base64Key := "dGhpcyBpcyBhIHRlc3Qgb2YgdGhlIGtleSBiYXNlNjQ=" // >=44 base64
	assert.NoError(t, v.Struct(w{Key: hexKey}))
	assert.NoError(t, v.Struct(w{Key: base64Key}))
	assert.Error(t, v.Struct(w{Key: "too-short"}))
}

func TestValidateFeaturePercentage(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("feature_percentage", validateFeaturePercentage)
	type w struct {
		Pct int `validate:"feature_percentage"`
	}
	assert.NoError(t, v.Struct(w{Pct: 0}))
	assert.NoError(t, v.Struct(w{Pct: 50}))
	assert.NoError(t, v.Struct(w{Pct: 100}))
	assert.Error(t, v.Struct(w{Pct: -1}))
	assert.Error(t, v.Struct(w{Pct: 101}))
}

func TestValidatePortRange(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("port_range", validatePortRange)
	type w struct {
		Port int `validate:"port_range"`
	}
	assert.NoError(t, v.Struct(w{Port: 1}))
	assert.NoError(t, v.Struct(w{Port: 65535}))
	assert.Error(t, v.Struct(w{Port: 0}))
	assert.Error(t, v.Struct(w{Port: 65536}))
}

func TestValidateFeatureName(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("feature_name", validateFeatureName)
	type w struct {
		Name string `validate:"feature_name"`
	}
	assert.NoError(t, v.Struct(w{Name: "fraud_detection"}))
	assert.NoError(t, v.Struct(w{Name: "abc"}))
	assert.Error(t, v.Struct(w{Name: "ab"}))  // too short
	assert.Error(t, v.Struct(w{Name: "UPPER"})) // uppercase
}

func TestValidateEmailDomain(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("email_domain", validateEmailDomain)
	type w struct {
		Domain string `validate:"email_domain"`
	}
	assert.NoError(t, v.Struct(w{Domain: "example.com"}))
	assert.NoError(t, v.Struct(w{Domain: ""})) // optional
	assert.Error(t, v.Struct(w{Domain: "no-tld"}))
}

func TestValidateCachePrefix(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("cache_prefix", validateCachePrefix)
	type w struct {
		Prefix string `validate:"cache_prefix"`
	}
	assert.NoError(t, v.Struct(w{Prefix: "app:cache"}))
	assert.NoError(t, v.Struct(w{Prefix: ""})) // optional
	assert.Error(t, v.Struct(w{Prefix: "UPPER_CASE"}))
}

func TestValidateCSPPolicy(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("csp_policy", validateCSPPolicy)
	type w struct {
		Policy string `validate:"csp_policy"`
	}
	assert.NoError(t, v.Struct(w{Policy: "default-src 'self'"}))
	assert.NoError(t, v.Struct(w{Policy: ""})) // optional
}

func TestRegisterCustomValidations(t *testing.T) {
	v := validator.New()
	err := registerCustomValidations(v)
	assert.NoError(t, err)
}
