package config

import (
	"errors"
	"strings"
	"testing"
)

// setProdEnv sets the env vars validate.go reads directly so the
// vault/billing/github cases can be tested in isolation. Each value
// is non-placeholder; tests that exercise a missing-env case override
// just the var under test.
func setProdEnv(t *testing.T) {
	t.Helper()
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "long-random-session-secret-32+bytes-aaaa")
	t.Setenv("PIPEWARDEN_SMTP_HOST", "smtp.example.com")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "pipewarden.io")
}

func TestValidateRequiredConfig_NilConfig(t *testing.T) {
	if err := ValidateRequiredConfig(nil); err == nil {
		t.Fatal("expected error for nil config")
	}
}

func TestValidateRequiredConfig_DevEnvSkipsValidation(t *testing.T) {
	for _, env := range []string{"", "development", "dev", "test", "TEST"} {
		c := &Config{Environment: env}
		if err := ValidateRequiredConfig(c); err != nil {
			t.Errorf("env=%q should skip validation, got: %v", env, err)
		}
	}
}

func TestValidateRequiredConfig_ProductionEmptyVault(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for empty vault key in production")
	}
	if !errors.Is(err, ErrInsecureConfig) {
		t.Errorf("expected ErrInsecureConfig, got %v", err)
	}
	if !strings.Contains(err.Error(), "vault.encryptionKey") {
		t.Errorf("error should mention vault.encryptionKey: %v", err)
	}
}

func TestValidateRequiredConfig_ProductionPlaceholderVault(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = placeholderVaultKey
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for placeholder vault key")
	}
	if !strings.Contains(err.Error(), "placeholder") {
		t.Errorf("error should call out placeholder: %v", err)
	}
}

func TestValidateRequiredConfig_ProductionBillingMissingSecret(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.Billing = true
	c.Billing.LemonSqueezyAPIKey = "ls-test-key"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for missing webhook secret with billing enabled")
	}
	if !strings.Contains(err.Error(), "lemonsqueezyWebhookSecret") {
		t.Errorf("error should mention webhook secret: %v", err)
	}
}

func TestValidateRequiredConfig_ProductionBillingDisabledNoSecretOK(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.Billing = false
	if err := ValidateRequiredConfig(c); err != nil {
		t.Errorf("billing disabled should not require webhook secret: %v", err)
	}
}

func TestValidateRequiredConfig_GitHubAppMissingKey(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Auth.GitHubApp.Enabled = true
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for enabled GitHub App with no key")
	}
	if !strings.Contains(err.Error(), "githubApp.privateKey") {
		t.Errorf("error should mention private key: %v", err)
	}
	if !strings.Contains(err.Error(), "githubApp.webhookSecret") {
		t.Errorf("error should mention webhook secret: %v", err)
	}
}

func TestValidateRequiredConfig_HostedModeNonPostgres(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "staging"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.HostedMode = true
	c.Database.Driver = "sqlite"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for hostedMode with sqlite")
	}
	if !strings.Contains(err.Error(), "postgres") {
		t.Errorf("error should mention postgres: %v", err)
	}
}

func TestValidateRequiredConfig_AllValidProduction(t *testing.T) {
	setProdEnv(t)
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.Billing = true
	c.Billing.LemonSqueezyAPIKey = "ls-test"
	c.Billing.LemonSqueezyWebhookSecret = "whsec-test"
	if err := ValidateRequiredConfig(c); err != nil {
		t.Errorf("valid production config should pass: %v", err)
	}
}

func TestValidateRequiredConfig_MissingSessionSecret(t *testing.T) {
	setProdEnv(t)
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "")
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for missing PIPEWARDEN_SESSION_SECRET")
	}
	if !strings.Contains(err.Error(), "PIPEWARDEN_SESSION_SECRET") {
		t.Errorf("error should mention session secret: %v", err)
	}
}

func TestValidateRequiredConfig_MissingSMTPHostInHostedMode(t *testing.T) {
	setProdEnv(t)
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.HostedMode = true
	c.Database.Driver = "postgres"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for missing PIPEWARDEN_SMTP_HOST in hosted mode")
	}
	if !strings.Contains(err.Error(), "PIPEWARDEN_SMTP_HOST") {
		t.Errorf("error should mention SMTP host: %v", err)
	}
}

func TestValidateRequiredConfig_MissingSMTPHostSelfHostedOK(t *testing.T) {
	setProdEnv(t)
	t.Setenv("PIPEWARDEN_SMTP_HOST", "")
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	c.Features.HostedMode = false
	if err := ValidateRequiredConfig(c); err != nil {
		t.Fatalf("self-hosted boot should not require SMTP: %v", err)
	}
}

func TestValidateRequiredConfig_WebAuthnRPIDLocalhost(t *testing.T) {
	setProdEnv(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "localhost")
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for WebAuthn RPID=localhost in production")
	}
	if !strings.Contains(err.Error(), "PIPEWARDEN_WEBAUTHN_RPID") {
		t.Errorf("error should mention WebAuthn RPID: %v", err)
	}
}

func TestValidateRequiredConfig_WebAuthnRPIDEmpty(t *testing.T) {
	setProdEnv(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RPID", "")
	c := &Config{Environment: "production"}
	c.Vault.EncryptionKey = "real-32-byte-key-for-aes-256-gcm"
	err := ValidateRequiredConfig(c)
	if err == nil {
		t.Fatal("expected error for empty WebAuthn RPID in production")
	}
	if !strings.Contains(err.Error(), "PIPEWARDEN_WEBAUTHN_RPID") {
		t.Errorf("error should mention WebAuthn RPID: %v", err)
	}
}
