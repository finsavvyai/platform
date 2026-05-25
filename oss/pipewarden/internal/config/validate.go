package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

// ErrInsecureConfig wraps any production-config validation failure.
var ErrInsecureConfig = errors.New("insecure production configuration")

const placeholderVaultKey = "change-me-in-production"

// envLookup is overridable in tests; defaults to os.LookupEnv. Some
// security values (session secret, SMTP, WebAuthn RPID) live only in
// env vars — never the YAML — so validation must read them directly.
var envLookup = os.LookupEnv

// ValidateRequiredConfig fails fast on production startup when security-critical
// values are empty or contain known placeholders. Skipped when Environment is
// "development" or "test" so local dev keeps its zero-friction loop.
func ValidateRequiredConfig(c *Config) error {
	if c == nil {
		return fmt.Errorf("%w: nil config", ErrInsecureConfig)
	}

	env := strings.ToLower(strings.TrimSpace(c.Environment))
	if env == "" || env == "development" || env == "dev" || env == "test" {
		return nil
	}

	var problems []string

	switch c.Vault.EncryptionKey {
	case "":
		problems = append(problems, "vault.encryptionKey (PIPEWARDEN_VAULT_KEY) is empty — credentials cannot be encrypted")
	case placeholderVaultKey:
		problems = append(problems, "vault.encryptionKey is the development placeholder — rotate before production")
	}

	if c.Features.Billing && c.Billing.LemonSqueezyAPIKey != "" && c.Billing.LemonSqueezyWebhookSecret == "" {
		problems = append(problems, "billing.lemonsqueezyWebhookSecret (LEMONSQUEEZY_WEBHOOK_SECRET) is empty — webhook HMAC verification will reject all callbacks")
	}

	if c.Auth.GitHubApp.Enabled {
		if c.Auth.GitHubApp.PrivateKey == "" {
			problems = append(problems, "auth.githubApp.privateKey is empty while GitHub App auth is enabled")
		}
		if c.Auth.GitHubApp.WebhookSecret == "" {
			problems = append(problems, "auth.githubApp.webhookSecret is empty — GitHub webhook signatures cannot be verified")
		}
	}

	if c.Features.HostedMode && c.Database.Driver != "postgres" {
		problems = append(problems, "features.hostedMode=true requires database.driver=postgres")
	}

	if v, _ := envLookup("PIPEWARDEN_SESSION_SECRET"); strings.TrimSpace(v) == "" {
		problems = append(problems, "PIPEWARDEN_SESSION_SECRET is empty — every login attempt will 500 (sessions cannot be signed)")
	}

	// SMTP is only mission-critical in hosted/SaaS mode where email verify
	// and password reset are user-visible flows. Self-hosted / single-tenant
	// deploys can boot without it; email pkg falls back to stderr logs.
	if c.Features.HostedMode {
		if v, _ := envLookup("PIPEWARDEN_SMTP_HOST"); strings.TrimSpace(v) == "" {
			problems = append(problems, "PIPEWARDEN_SMTP_HOST is empty — email verify + password reset would silently log to stderr instead of delivering")
		}
	}

	rpID, _ := envLookup("PIPEWARDEN_WEBAUTHN_RPID")
	if strings.TrimSpace(rpID) == "" || rpID == "localhost" {
		problems = append(problems, "PIPEWARDEN_WEBAUTHN_RPID is unset or 'localhost' — passkey registration will fail in production")
	}

	if len(problems) == 0 {
		return nil
	}

	return fmt.Errorf("%w:\n  - %s", ErrInsecureConfig, strings.Join(problems, "\n  - "))
}
