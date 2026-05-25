package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/viper"
)

// resetViper clears global viper state between tests so env+config bindings
// from a prior test do not leak.
func resetViper() {
	viper.Reset()
}

func clearEnv(t *testing.T, names ...string) {
	t.Helper()
	saved := make(map[string]string, len(names))
	for _, n := range names {
		if v, ok := os.LookupEnv(n); ok {
			saved[n] = v
		}
		_ = os.Unsetenv(n)
	}
	t.Cleanup(func() {
		for n, v := range saved {
			_ = os.Setenv(n, v)
		}
	})
}

func TestLoadConfig_DefaultsApplied(t *testing.T) {
	resetViper()
	clearEnv(t,
		"CLAUDE_API_KEY", "ANTHROPIC_API_KEY", "PIPEWARDEN_ANTHROPIC_APIKEY",
		"VAULT_ENCRYPTION_KEY", "PIPEWARDEN_VAULT_KEY",
		"DATABASE_URL", "PIPEWARDEN_DATABASE_URL",
		"PIPEWARDEN_HOSTED_MODE",
	)

	conf, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if conf.Environment != "development" {
		t.Errorf("environment default: got %q, want development", conf.Environment)
	}
	if conf.Server.Host != "0.0.0.0" {
		t.Errorf("server.host default: got %q", conf.Server.Host)
	}
	if conf.Server.Port != 8080 {
		t.Errorf("server.port default: got %d", conf.Server.Port)
	}
	if conf.Database.Driver != "sqlite" {
		t.Errorf("database.driver default: got %q", conf.Database.Driver)
	}
	if conf.Database.Path != "pipewarden.db" {
		t.Errorf("database.path default: got %q", conf.Database.Path)
	}
	if !conf.Database.WALMode {
		t.Error("database.walMode default should be true")
	}
	if conf.Logging.Level != "info" {
		t.Errorf("logging.level default: got %q", conf.Logging.Level)
	}
	if !conf.Analysis.HeuristicEnabled || !conf.Analysis.DLPEnabled || !conf.Analysis.PolicyEnabled {
		t.Errorf("analysis flags default true; got %+v", conf.Analysis)
	}
	if !conf.Auth.Disabled {
		t.Error("auth.disabled default should be true")
	}
	if conf.Auth.GitHubApp.APIBaseURL != "https://api.github.com" {
		t.Errorf("github api base default: got %q", conf.Auth.GitHubApp.APIBaseURL)
	}
}

func TestLoadConfig_FromYAMLFile(t *testing.T) {
	resetViper()

	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yml")
	body := `
environment: production
server:
  host: 127.0.0.1
  port: 9090
database:
  driver: sqlite
  path: /tmp/pw.db
logging:
  level: warn
  json: true
vault:
  encryptionKey: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}

	conf, err := LoadConfig(cfgPath)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if conf.Environment != "production" {
		t.Errorf("environment: got %q", conf.Environment)
	}
	if conf.Server.Host != "127.0.0.1" || conf.Server.Port != 9090 {
		t.Errorf("server overrides not applied: %+v", conf.Server)
	}
	if conf.Logging.Level != "warn" || !conf.Logging.JSON {
		t.Errorf("logging overrides not applied: %+v", conf.Logging)
	}
	if conf.Vault.EncryptionKey == "" {
		t.Error("vault key should be loaded from file")
	}
}

func TestLoadConfig_BadConfigPath(t *testing.T) {
	resetViper()
	_, err := LoadConfig("/nonexistent/definitely-not-here.yml")
	if err == nil {
		t.Fatal("expected error for missing config file")
	}
}

func TestLoadConfig_LegacyEnvBinding_AnthropicKey(t *testing.T) {
	resetViper()
	clearEnv(t, "CLAUDE_API_KEY", "ANTHROPIC_API_KEY", "PIPEWARDEN_ANTHROPIC_APIKEY")

	t.Setenv("ANTHROPIC_API_KEY", "sk-ant-test-12345")

	conf, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if conf.Analysis.ClaudeAPIKey != "sk-ant-test-12345" {
		t.Errorf("ANTHROPIC_API_KEY not bound; got %q", conf.Analysis.ClaudeAPIKey)
	}
}

func TestLoadConfig_LegacyEnvBinding_VaultKey(t *testing.T) {
	resetViper()
	clearEnv(t, "VAULT_ENCRYPTION_KEY", "PIPEWARDEN_VAULT_KEY")

	t.Setenv("VAULT_ENCRYPTION_KEY", "vaultkey-from-env")

	conf, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if conf.Vault.EncryptionKey != "vaultkey-from-env" {
		t.Errorf("vault key not bound; got %q", conf.Vault.EncryptionKey)
	}
}

func TestLoadConfig_VaultKeyOSEnvFallback(t *testing.T) {
	resetViper()
	clearEnv(t, "VAULT_ENCRYPTION_KEY", "PIPEWARDEN_VAULT_KEY")

	t.Setenv("PIPEWARDEN_VAULT_KEY", "fallback-vault-key")

	conf, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if conf.Vault.EncryptionKey != "fallback-vault-key" {
		t.Errorf("vault fallback not applied; got %q", conf.Vault.EncryptionKey)
	}
}

func TestLoadConfig_DatabaseDriverInferredPostgres(t *testing.T) {
	resetViper()
	clearEnv(t, "DATABASE_URL", "PIPEWARDEN_DATABASE_URL")

	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yml")
	body := `
database:
  driver: ""
  url: "postgres://user:pass@localhost:5432/db"
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}

	conf, err := LoadConfig(cfgPath)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if conf.Database.Driver != "postgres" {
		t.Errorf("driver should infer postgres from url; got %q", conf.Database.Driver)
	}
}

func TestLoadConfig_GitHubAppPrivateKeyFromPath(t *testing.T) {
	resetViper()
	clearEnv(t,
		"GITHUB_PRIVATE_KEY", "GITHUB_PRIVATE_KEY_PATH",
		"GITHUB_APP_ID", "GITHUB_CLIENT_ID",
	)

	dir := t.TempDir()
	keyPath := filepath.Join(dir, "app.pem")
	keyBody := "-----BEGIN RSA PRIVATE KEY-----\nFAKEKEY\n-----END RSA PRIVATE KEY-----\n"
	if err := os.WriteFile(keyPath, []byte(keyBody), 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}

	cfgPath := filepath.Join(dir, "config.yml")
	body := `
auth:
  githubApp:
    appId: 12345
    clientId: Iv1.abc
    privateKeyPath: ` + keyPath + `
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}

	conf, err := LoadConfig(cfgPath)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if conf.Auth.GitHubApp.PrivateKey != keyBody {
		t.Errorf("private key not loaded from path; got %q", conf.Auth.GitHubApp.PrivateKey)
	}
	if !conf.Auth.GitHubApp.Enabled {
		t.Error("github app should auto-enable when appId+key+clientId present")
	}
}

func TestLoadConfig_GitHubAppPrivateKeyMissingPath(t *testing.T) {
	resetViper()
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yml")
	body := `
auth:
  githubApp:
    privateKeyPath: /no/such/file.pem
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}
	if _, err := LoadConfig(cfgPath); err == nil {
		t.Fatal("expected error reading missing private key file")
	}
}

func TestLoadConfig_HostedModeRequiresPostgres(t *testing.T) {
	resetViper()
	clearEnv(t, "PIPEWARDEN_HOSTED_MODE", "DATABASE_URL", "PIPEWARDEN_DATABASE_URL")

	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yml")
	body := `
features:
  hostedMode: true
database:
  driver: sqlite
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}
	_, err := LoadConfig(cfgPath)
	if err == nil {
		t.Fatal("hosted mode + sqlite should fail")
	}
}

func TestLoadConfig_HostedModeWithPostgresOK(t *testing.T) {
	resetViper()
	clearEnv(t, "PIPEWARDEN_HOSTED_MODE", "DATABASE_URL", "PIPEWARDEN_DATABASE_URL")

	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yml")
	body := `
features:
  hostedMode: true
database:
  driver: postgres
  url: postgres://x@h/db
`
	if err := os.WriteFile(cfgPath, []byte(body), 0o600); err != nil {
		t.Fatalf("write cfg: %v", err)
	}
	conf, err := LoadConfig(cfgPath)
	if err != nil {
		t.Fatalf("hosted+postgres should be OK: %v", err)
	}
	if !conf.Features.HostedMode {
		t.Error("hostedMode flag not set")
	}
}

func TestMustBindEnv_Idempotent(t *testing.T) {
	resetViper()
	mustBindEnv("foo.bar", "FOO_BAR_ONE", "FOO_BAR_TWO")
	mustBindEnv("foo.bar", "FOO_BAR_ONE")
}
