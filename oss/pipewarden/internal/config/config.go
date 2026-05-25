package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config holds all runtime configuration for PipeWarden.
type Config struct {
	Environment string         `mapstructure:"environment"`
	Server      ServerConfig   `mapstructure:"server"`
	Database    DatabaseConfig `mapstructure:"database"`
	Auth        AuthConfig     `mapstructure:"auth"`
	Logging     LoggingConfig  `mapstructure:"logging"`
	Analysis    AnalysisConfig `mapstructure:"analysis"`
	Claw        ClawConfig     `mapstructure:"clawpipe"`
	Vault       VaultConfig    `mapstructure:"vault"`
	Billing     BillingConfig  `mapstructure:"billing"`
	Features    FeatureConfig  `mapstructure:"features"`
	SIEM        SIEMConfig     `mapstructure:"siem"`
	PushCI      PushCIConfig   `mapstructure:"pushci"`
	Audit       AuditConfig    `mapstructure:"audit"`
	OpenSRE     OpenSREConfig  `mapstructure:"opensre"`
}

// LoadConfig loads config from file and environment variables.
// Loads .env from CWD if present (dev convenience). Production deploys
// rely on real env vars from the orchestrator (systemd/k8s/Railway etc).
func LoadConfig(configPath string) (*Config, error) {
	_ = godotenv.Load() // best-effort; ignore missing .env

	conf := &Config{
		Environment: "development",
	}

	viper.SetDefault("environment", "development")
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.readTimeout", 5*time.Second)
	viper.SetDefault("server.writeTimeout", 10*time.Second)
	viper.SetDefault("server.idleTimeout", 120*time.Second)
	viper.SetDefault("server.corsOrigins", []string{"*"})
	viper.SetDefault("database.driver", "sqlite")
	viper.SetDefault("database.path", "pipewarden.db")
	viper.SetDefault("database.sslMode", "disable")
	viper.SetDefault("database.walMode", true)
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.json", false)
	viper.SetDefault("analysis.claudeModel", "claude-sonnet-4-20250514")
	viper.SetDefault("analysis.claudeBaseUrl", "https://api.anthropic.com")
	viper.SetDefault("analysis.heuristicEnabled", true)
	viper.SetDefault("analysis.dlpEnabled", true)
	viper.SetDefault("analysis.policyEnabled", true)
	viper.SetDefault("features.billing", true)
	viper.SetDefault("features.dlp", true)
	viper.SetDefault("features.policy", true)
	viper.SetDefault("auth.disabled", true)
	viper.SetDefault("auth.githubApp.apiBaseUrl", "https://api.github.com")
	viper.SetDefault("clawpipe.endpoint", "https://api.clawpipe.dev")

	if configPath != "" {
		viper.SetConfigFile(configPath)
		if err := viper.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	viper.SetEnvPrefix("PIPEWARDEN")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()
	bindLegacyEnv()

	if err := viper.Unmarshal(conf); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if conf.Database.Driver == "" {
		if conf.Database.URL != "" || conf.Database.Host != "" {
			conf.Database.Driver = "postgres"
		} else {
			conf.Database.Driver = "sqlite"
		}
	}

	if conf.Database.Driver == "sqlite" && conf.Database.Path == "" {
		conf.Database.Path = "pipewarden.db"
	}

	if conf.Vault.EncryptionKey == "" {
		conf.Vault.EncryptionKey = os.Getenv("PIPEWARDEN_VAULT_KEY")
	}

	if conf.Auth.GitHubApp.PrivateKey == "" && conf.Auth.GitHubApp.PrivateKeyPath != "" {
		privateKey, err := os.ReadFile(conf.Auth.GitHubApp.PrivateKeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read GitHub App private key: %w", err)
		}
		conf.Auth.GitHubApp.PrivateKey = string(privateKey)
	}

	if !conf.Auth.GitHubApp.Enabled {
		conf.Auth.GitHubApp.Enabled = conf.Auth.GitHubApp.AppID != 0 &&
			conf.Auth.GitHubApp.PrivateKey != "" &&
			conf.Auth.GitHubApp.ClientID != ""
	}

	if conf.Features.HostedMode && conf.Database.Driver != "postgres" {
		return nil, fmt.Errorf("hosted mode requires database.driver=postgres")
	}

	return conf, nil
}

func bindLegacyEnv() {
	mustBindEnv("analysis.claudeApiKey", "CLAUDE_API_KEY", "ANTHROPIC_API_KEY", "PIPEWARDEN_ANTHROPIC_APIKEY")
	mustBindEnv("analysis.claudeModel", "PIPEWARDEN_ANTHROPIC_MODEL")
	mustBindEnv("analysis.claudeBaseUrl", "PIPEWARDEN_ANTHROPIC_BASEURL")
	mustBindEnv("vault.encryptionKey", "VAULT_ENCRYPTION_KEY", "PIPEWARDEN_VAULT_KEY")
	mustBindEnv("billing.lemonsqueezyApiKey", "LEMONSQUEEZY_API_KEY")
	mustBindEnv("billing.lemonsqueezyStoreId", "LEMONSQUEEZY_STORE_ID")
	mustBindEnv("billing.lemonsqueezyWebhookSecret", "LEMONSQUEEZY_WEBHOOK_SECRET")
	mustBindEnv("auth.githubApp.slug", "GITHUB_APP_SLUG")
	mustBindEnv("auth.githubApp.appId", "GITHUB_APP_ID")
	mustBindEnv("auth.githubApp.privateKey", "GITHUB_PRIVATE_KEY")
	mustBindEnv("auth.githubApp.privateKeyPath", "GITHUB_PRIVATE_KEY_PATH")
	mustBindEnv("auth.githubApp.clientId", "GITHUB_CLIENT_ID")
	mustBindEnv("auth.githubApp.clientSecret", "GITHUB_CLIENT_SECRET")
	mustBindEnv("auth.githubApp.webhookSecret", "GITHUB_WEBHOOK_SECRET")
	mustBindEnv("auth.githubApp.apiBaseUrl", "GITHUB_API_BASE_URL")
	mustBindEnv("auth.gitlabWebhookSecret", "GITLAB_WEBHOOK_SECRET")
	mustBindEnv("clawpipe.apiKey", "CLAW_API_KEY")
	mustBindEnv("clawpipe.projectId", "CLAW_PROJECT_ID")
	mustBindEnv("audit.endpoint", "PIPEWARDEN_AUDIT_ENDPOINT", "OPENSYBER_AUDIT_ENDPOINT")
	mustBindEnv("audit.token", "PIPEWARDEN_AUDIT_TOKEN", "OPENSYBER_AUDIT_TOKEN")
	mustBindEnv("opensre.url", "PIPEWARDEN_OPENSRE_URL")
	mustBindEnv("opensre.secret", "PIPEWARDEN_OPENSRE_SECRET")
	mustBindEnv("database.url", "DATABASE_URL", "PIPEWARDEN_DATABASE_URL")
	mustBindEnv("features.hostedMode", "PIPEWARDEN_HOSTED_MODE")
	mustBindEnv("features.experimentalProviders", "PIPEWARDEN_EXPERIMENTAL_PROVIDERS")
	mustBindEnv("siem.slackWebhookUrl", "SLACK_WEBHOOK_URL")
	mustBindEnv("siem.slackChannel", "SLACK_CHANNEL")
	mustBindEnv("siem.pagerdutyKey", "PAGERDUTY_INTEGRATION_KEY")
	mustBindEnv("siem.jiraBaseUrl", "JIRA_BASE_URL")
	mustBindEnv("siem.jiraEmail", "JIRA_EMAIL")
	mustBindEnv("siem.jiraApiToken", "JIRA_API_TOKEN")
	mustBindEnv("siem.jiraProjectKey", "JIRA_PROJECT_KEY")
	mustBindEnv("siem.dashboardUrl", "PIPEWARDEN_DASHBOARD_URL")
	mustBindEnv("pushci.apiKey", "PUSHCI_API_KEY")
	mustBindEnv("pushci.baseUrl", "PUSHCI_BASE_URL")
}

func mustBindEnv(key string, envNames ...string) {
	args := append([]string{key}, envNames...)
	_ = viper.BindEnv(args...)
}
