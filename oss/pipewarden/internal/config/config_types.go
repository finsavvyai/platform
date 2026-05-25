package config

import "time"

// ServerConfig holds all server related configuration.
type ServerConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"readTimeout"`
	WriteTimeout time.Duration `mapstructure:"writeTimeout"`
	IdleTimeout  time.Duration `mapstructure:"idleTimeout"`
	CORSOrigins  []string      `mapstructure:"corsOrigins"`
	PublicURL    string        `mapstructure:"publicUrl"`
}

// DatabaseConfig holds all database related configuration.
type DatabaseConfig struct {
	Driver          string        `mapstructure:"driver"`
	Path            string        `mapstructure:"path"`
	URL             string        `mapstructure:"url"`
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Username        string        `mapstructure:"username"`
	Password        string        `mapstructure:"password"`
	Name            string        `mapstructure:"name"`
	SSLMode         string        `mapstructure:"sslMode"`
	WALMode         bool          `mapstructure:"walMode"`
	MaxOpenConns    int           `mapstructure:"maxOpenConns"`
	MaxIdleConns    int           `mapstructure:"maxIdleConns"`
	ConnMaxLifetime time.Duration `mapstructure:"connMaxLifetime"`
}

// AuthConfig holds all auth related configuration.
type AuthConfig struct {
	Disabled      bool            `mapstructure:"disabled"`
	Token         string          `mapstructure:"token"`
	JWTSecret     string          `mapstructure:"jwtSecret"`
	TokenDuration time.Duration   `mapstructure:"tokenDuration"`
	OpenSyber     OpenSyberConfig `mapstructure:"opensyber"`
	GitHubApp     GitHubAppConfig `mapstructure:"githubApp"`
	// GitLabWebhookSecret is the shared X-Gitlab-Token value the inbound
	// webhook handler accepts. When unset the handler refuses every
	// incoming GitLab event (fail-closed). Mirrors GitHubApp.WebhookSecret.
	GitLabWebhookSecret string `mapstructure:"gitlabWebhookSecret"`
}

// OpenSyberConfig holds OpenSyber auth integration config.
type OpenSyberConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	JWKSURL string `mapstructure:"jwksUrl"`
}

// GitHubAppConfig holds GitHub App OAuth config.
type GitHubAppConfig struct {
	Enabled        bool   `mapstructure:"enabled"`
	Slug           string `mapstructure:"slug"`
	AppID          int64  `mapstructure:"appId"`
	PrivateKey     string `mapstructure:"privateKey"`
	PrivateKeyPath string `mapstructure:"privateKeyPath"`
	ClientID       string `mapstructure:"clientId"`
	ClientSecret   string `mapstructure:"clientSecret"`
	WebhookSecret  string `mapstructure:"webhookSecret"`
	APIBaseURL     string `mapstructure:"apiBaseUrl"`
}

// LoggingConfig holds all logging related configuration.
type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	JSON   bool   `mapstructure:"json"`
	Format string `mapstructure:"format"`
}

// AnalysisConfig holds all AI analysis configuration.
type AnalysisConfig struct {
	ClaudeAPIKey     string `mapstructure:"claudeApiKey"`
	ClaudeModel      string `mapstructure:"claudeModel"`
	ClaudeBaseURL    string `mapstructure:"claudeBaseUrl"`
	HeuristicEnabled bool   `mapstructure:"heuristicEnabled"`
	DLPEnabled       bool   `mapstructure:"dlpEnabled"`
	PolicyEnabled    bool   `mapstructure:"policyEnabled"`
}

// ClawConfig holds ClawPipe cost optimization config.
type ClawConfig struct {
	APIKey           string   `mapstructure:"apiKey"`
	ProjectID        string   `mapstructure:"projectId"`
	Endpoint         string   `mapstructure:"endpoint"`
	OfflineMode      bool     `mapstructure:"offlineMode"`
	OfflineProviders []string `mapstructure:"offlineProviders"`
}

// VaultConfig holds credential vault configuration.
type VaultConfig struct {
	EncryptionKey string `mapstructure:"encryptionKey"`
}

// BillingConfig holds LemonSqueezy billing configuration.
type BillingConfig struct {
	LemonSqueezyAPIKey        string `mapstructure:"lemonsqueezyApiKey"`
	LemonSqueezyStoreID       string `mapstructure:"lemonsqueezyStoreId"`
	LemonSqueezyWebhookSecret string `mapstructure:"lemonsqueezyWebhookSecret"`
}

// FeatureConfig holds rollout and GA feature flags.
type FeatureConfig struct {
	ExperimentalProviders bool `mapstructure:"experimentalProviders"`
	Billing               bool `mapstructure:"billing"`
	DLP                   bool `mapstructure:"dlp"`
	Policy                bool `mapstructure:"policy"`
	HostedMode            bool `mapstructure:"hostedMode"`
}

// SIEMConfig holds all SIEM routing destination configuration.
type SIEMConfig struct {
	DashboardURL    string `mapstructure:"dashboardUrl"`
	SlackWebhookURL string `mapstructure:"slackWebhookUrl"`
	SlackChannel    string `mapstructure:"slackChannel"`
	PagerDutyKey    string `mapstructure:"pagerdutyKey"`
	JiraBaseURL     string `mapstructure:"jiraBaseUrl"`
	JiraEmail       string `mapstructure:"jiraEmail"`
	JiraAPIToken    string `mapstructure:"jiraApiToken"`
	JiraProjectKey  string `mapstructure:"jiraProjectKey"`
}

// PushCIConfig holds PushCI auto-fix bridge configuration.
type PushCIConfig struct {
	APIKey  string `mapstructure:"apiKey"`
	BaseURL string `mapstructure:"baseUrl"`
}

// AuditConfig holds tamper-proof audit-log webhook configuration.
// When endpoint+token are non-empty the AuditSender posts events to the
// configured OpenSyber audit endpoint. Empty values disable remote audit
// (zap structured logs continue regardless).
type AuditConfig struct {
	Endpoint string `mapstructure:"endpoint"`
	Token    string `mapstructure:"token"`
}

// OpenSREConfig holds the bridge to an OpenSRE incident-response instance.
// When URL+Secret are non-empty, every persisted finding is forwarded to
// OpenSRE's /alerts/ingest endpoint signed with HMAC-SHA256. Empty values
// disable the bridge with no error.
type OpenSREConfig struct {
	URL    string `mapstructure:"url"`
	Secret string `mapstructure:"secret"`
}
