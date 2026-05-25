package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// Config represents the complete application configuration
type Config struct {
	Environment      EnvironmentConfig      `mapstructure:"environment" validate:"required"`
	Server           ServerConfig           `mapstructure:"server" validate:"required"`
	Database         DatabaseConfig         `mapstructure:"database" validate:"required"`
	Redis            RedisConfig            `mapstructure:"redis" validate:"required"`
	Security         SecurityConfig         `mapstructure:"security" validate:"required"`
	AI               AIConfig               `mapstructure:"ai" validate:"required"`
	Quantum          QuantumConfig          `mapstructure:"quantum" validate:"required"`
	Monitoring       MonitoringConfig       `mapstructure:"monitoring" validate:"required"`
	Logging          LoggingConfig          `mapstructure:"logging" validate:"required"`
	Features         FeaturesConfig         `mapstructure:"features" validate:"required"`
	ExternalServices ExternalServicesConfig `mapstructure:"external_services" validate:"required"`
	RateLimiting     RateLimitingConfig     `mapstructure:"rate_limiting" validate:"required"`
	Cache            CacheConfig            `mapstructure:"cache" validate:"required"`
	Webhook          WebhookConfig          `mapstructure:"webhook" validate:"required"`
}

// EnvironmentConfig contains environment-specific settings
type EnvironmentConfig struct {
	Name        string `mapstructure:"name" validate:"required,oneof=development staging production"`
	Debug       bool   `mapstructure:"debug"`
	Region      string `mapstructure:"region" validate:"required"`
	Zone        string `mapstructure:"zone"`
	Version     string `mapstructure:"version" validate:"required"`
	BuildTime   string `mapstructure:"build_time"`
	GitCommit   string `mapstructure:"git_commit"`
	InstanceID  string `mapstructure:"instance_id"`
	ClusterName string `mapstructure:"cluster_name"`
}

// ServerConfig contains HTTP server configuration
type ServerConfig struct {
	Host            string        `mapstructure:"host" validate:"required"`
	Port            int           `mapstructure:"port" validate:"required,min=1,max=65535"`
	ReadTimeout     time.Duration `mapstructure:"read_timeout" validate:"required"`
	WriteTimeout    time.Duration `mapstructure:"write_timeout" validate:"required"`
	IdleTimeout     time.Duration `mapstructure:"idle_timeout" validate:"required"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout" validate:"required"`
	TLS             TLSConfig     `mapstructure:"tls" validate:"required"`
	CORS            CORSConfig    `mapstructure:"cors" validate:"required"`
	Limits          LimitsConfig  `mapstructure:"limits" validate:"required"`
}

// TLSConfig contains TLS/SSL configuration
type TLSConfig struct {
	Enabled    bool     `mapstructure:"enabled"`
	CertFile   string   `mapstructure:"cert_file"`
	KeyFile    string   `mapstructure:"key_file"`
	CAFile     string   `mapstructure:"ca_file"`
	MinVersion string   `mapstructure:"min_version"`
	Ciphers    []string `mapstructure:"ciphers"`
	AutoCert   bool     `mapstructure:"auto_cert"`
	Email      string   `mapstructure:"email"`
	Hosts      []string `mapstructure:"hosts"`
}

// CORSConfig contains CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string `mapstructure:"allowed_origins"`
	AllowedMethods   []string `mapstructure:"allowed_methods"`
	AllowedHeaders   []string `mapstructure:"allowed_headers"`
	ExposedHeaders   []string `mapstructure:"exposed_headers"`
	AllowCredentials bool     `mapstructure:"allow_credentials"`
	MaxAge           int      `mapstructure:"max_age"`
}

// LimitsConfig contains request limits
type LimitsConfig struct {
	MaxHeaderBytes    int64         `mapstructure:"max_header_bytes"`
	MaxBodyBytes      int64         `mapstructure:"max_body_bytes"`
	MaxConnsPerIP     int           `mapstructure:"max_conns_per_ip"`
	MaxConnsPerHost   int           `mapstructure:"max_conns_per_host"`
	MaxRequestSize    int64         `mapstructure:"max_request_size"`
	MaxFileUploadSize int64         `mapstructure:"max_file_upload_size"`
	RequestTimeout    time.Duration `mapstructure:"request_timeout"`
	ReadHeaderTimeout time.Duration `mapstructure:"read_header_timeout"`
}

// DatabaseConfig contains database connection configuration
type DatabaseConfig struct {
	Host                string        `mapstructure:"host" validate:"required"`
	Port                int           `mapstructure:"port" validate:"required,min=1,max=65535"`
	User                string        `mapstructure:"user" validate:"required"`
	Password            string        `mapstructure:"password"`
	DBName              string        `mapstructure:"dbname" validate:"required"`
	SSLMode             string        `mapstructure:"ssl_mode" validate:"required,oneof=disable allow prefer require verify-ca verify-full"`
	MaxConnections      int           `mapstructure:"max_connections" validate:"required,min=1"`
	MinConnections      int           `mapstructure:"min_connections" validate:"min=0"`
	MaxIdleConnections  int           `mapstructure:"max_idle_connections" validate:"min=0"`
	MaxLifetime         time.Duration `mapstructure:"max_lifetime" validate:"required"`
	MaxIdleTime         time.Duration `mapstructure:"max_idle_time" validate:"required"`
	ConnectTimeout      time.Duration `mapstructure:"connect_timeout" validate:"required"`
	QueryTimeout        time.Duration `mapstructure:"query_timeout" validate:"required"`
	SlowQueryThreshold  time.Duration `mapstructure:"slow_query_threshold" validate:"required"`
	EnableQueryLogger   bool          `mapstructure:"enable_query_logger"`
	MigrationPath       string        `mapstructure:"migration_path" validate:"required"`
	SeedDataPath        string        `mapstructure:"seed_data_path"`
	ConnectionAttempts  int           `mapstructure:"connection_attempts" validate:"required,min=1"`
	ConnectionRetryWait time.Duration `mapstructure:"connection_retry_wait" validate:"required"`
}

// RedisConfig contains Redis connection configuration
type RedisConfig struct {
	Host               string        `mapstructure:"host" validate:"required"`
	Port               int           `mapstructure:"port" validate:"required,min=1,max=65535"`
	Password           string        `mapstructure:"password"`
	DB                 int           `mapstructure:"db" validate:"min=0"`
	PoolSize           int           `mapstructure:"pool_size" validate:"required,min=1"`
	MinIdleConns       int           `mapstructure:"min_idle_conns" validate:"min=0"`
	MaxRetries         int           `mapstructure:"max_retries" validate:"min=0"`
	DialTimeout        time.Duration `mapstructure:"dial_timeout" validate:"required"`
	ReadTimeout        time.Duration `mapstructure:"read_timeout" validate:"required"`
	WriteTimeout       time.Duration `mapstructure:"write_timeout" validate:"required"`
	PoolTimeout        time.Duration `mapstructure:"pool_timeout" validate:"required"`
	IdleTimeout        time.Duration `mapstructure:"idle_timeout" validate:"required"`
	IdleCheckFrequency time.Duration `mapstructure:"idle_check_frequency" validate:"required"`
	Cluster            ClusterConfig `mapstructure:"cluster"`
}

// ClusterConfig contains Redis cluster configuration
type ClusterConfig struct {
	Enabled        bool     `mapstructure:"enabled"`
	Nodes          []string `mapstructure:"nodes"`
	MaxRedirects   int      `mapstructure:"max_redirects" validate:"min=1"`
	ReadOnly       bool     `mapstructure:"read_only"`
	RouteByLatency bool     `mapstructure:"route_by_latency"`
	RouteRandomly  bool     `mapstructure:"route_randomly"`
}

// SecurityConfig contains security-related configuration
type SecurityConfig struct {
	JWT         JWTConfig         `mapstructure:"jwt" validate:"required"`
	Password    PasswordConfig    `mapstructure:"password" validate:"required"`
	RateLimit   RateLimitConfig   `mapstructure:"rate_limit" validate:"required"`
	CORS        CORSConfig        `mapstructure:"cors" validate:"required"`
	Encryption  EncryptionConfig  `mapstructure:"encryption" validate:"required"`
	Session     SessionConfig     `mapstructure:"session" validate:"required"`
	APIKey      APIKeyConfig      `mapstructure:"api_key" validate:"required"`
	WebSecurity WebSecurityConfig `mapstructure:"web_security" validate:"required"`
}

// JWTConfig contains JWT token configuration
type JWTConfig struct {
	Secret            string        `mapstructure:"secret" validate:"required,min=32"`
	AccessExpiration  time.Duration `mapstructure:"access_expiration" validate:"required"`
	RefreshExpiration time.Duration `mapstructure:"refresh_expiration" validate:"required"`
	Issuer            string        `mapstructure:"issuer" validate:"required"`
	Audience          string        `mapstructure:"audience"`
	Algorithm         string        `mapstructure:"algorithm" validate:"required,oneof=HS256 HS384 HS512 RS256 RS384 RS512"`
	RefreshEnabled    bool          `mapstructure:"refresh_enabled"`
	BlacklistEnabled  bool          `mapstructure:"blacklist_enabled"`
}

// PasswordConfig contains password policy configuration
type PasswordConfig struct {
	MinLength        int    `mapstructure:"min_length" validate:"required,min=6"`
	MaxLength        int    `mapstructure:"max_length" validate:"required,min=6"`
	RequireUppercase bool   `mapstructure:"require_uppercase"`
	RequireLowercase bool   `mapstructure:"require_lowercase"`
	RequireNumbers   bool   `mapstructure:"require_numbers"`
	RequireSpecial   bool   `mapstructure:"require_special"`
	SpecialChars     string `mapstructure:"special_chars"`
	HashAlgorithm    string `mapstructure:"hash_algorithm" validate:"required,oneof=bcrypt argon2 scrypt pbkdf2"`
	HashIterations   int    `mapstructure:"hash_iterations" validate:"min=1"`
	HashMemory       int    `mapstructure:"hash_memory" validate:"min=1"`
	HashParallelism  int    `mapstructure:"hash_parallelism" validate:"min=1"`
	HashSaltLength   int    `mapstructure:"hash_salt_length" validate:"min=8"`
}

// RateLimitConfig contains rate limiting configuration
type RateLimitConfig struct {
	Enabled     bool          `mapstructure:"enabled"`
	Algorithm   string        `mapstructure:"algorithm" validate:"required,oneof=token_bucket leaky_bucket sliding_window fixed_window"`
	GlobalLimit int           `mapstructure:"global_limit" validate:"required,min=1"`
	Window      time.Duration `mapstructure:"window" validate:"required"`
	BurstSize   int           `mapstructure:"burst_size" validate:"min=1"`
	Storage     string        `mapstructure:"storage" validate:"required,oneof=memory redis"`
}

// EncryptionConfig contains encryption configuration
type EncryptionConfig struct {
	Algorithm      string        `mapstructure:"algorithm" validate:"required,oneof=AES256-GCM ChaCha20-Poly1305"`
	KeyLength      int           `mapstructure:"key_length" validate:"required,oneof=256 128"`
	KeyRotation    bool          `mapstructure:"key_rotation"`
	RotationPeriod time.Duration `mapstructure:"rotation_period" validate:"required"`
	KeyDerivation  string        `mapstructure:"key_derivation" validate:"required,oneof=PBKDF2 Argon2 Scrypt"`
}

// SessionConfig contains session management configuration
type SessionConfig struct {
	Store      string        `mapstructure:"store" validate:"required,oneof=memory redis database"`
	CookieName string        `mapstructure:"cookie_name" validate:"required"`
	MaxAge     time.Duration `mapstructure:"max_age" validate:"required"`
	Path       string        `mapstructure:"path" validate:"required"`
	Domain     string        `mapstructure:"domain"`
	Secure     bool          `mapstructure:"secure"`
	HTTPOnly   bool          `mapstructure:"http_only"`
	SameSite   string        `mapstructure:"same_site" validate:"required,oneof=Strict Lax None"`
}

// APIKeyConfig contains API key management configuration
type APIKeyConfig struct {
	DefaultRateLimitPerMinute int           `mapstructure:"default_rate_limit_per_minute" validate:"required,min=1"`
	DefaultRateLimitPerHour   int           `mapstructure:"default_rate_limit_per_hour" validate:"required,min=1"`
	MaxKeysPerUser            int           `mapstructure:"max_keys_per_user" validate:"min=1"`
	KeyLength                 int           `mapstructure:"key_length" validate:"required,min=16"`
	KeyPrefix                 string        `mapstructure:"key_prefix"`
	DefaultExpiration         time.Duration `mapstructure:"default_expiration" validate:"required"`
	MaxExpiration             time.Duration `mapstructure:"max_expiration" validate:"required"`
	RequireApproval           bool          `mapstructure:"require_approval"`
	AutoCleanupExpired        bool          `mapstructure:"auto_cleanup_expired"`
	CleanupInterval           time.Duration `mapstructure:"cleanup_interval" validate:"required"`
}

// WebSecurityConfig contains web security configuration
type WebSecurityConfig struct {
	CSPEnabled            bool     `mapstructure:"csp_enabled"`
	CSPPolicy             string   `mapstructure:"csp_policy"`
	XSSProtection         bool     `mapstructure:"xss_protection"`
	ContentTypeNosniff    bool     `mapstructure:"content_type_nosniff"`
	XFrameOptions         string   `mapstructure:"x_frame_options" validate:"oneof=DENY SAMEORIGIN ALLOW-FROM"`
	HSTSMaxAge            int      `mapstructure:"hsts_max_age"`
	HSTSIncludeSubdomains bool     `mapstructure:"hsts_include_subdomains"`
	TrustedProxies        []string `mapstructure:"trusted_proxies"`
	MaxRequestSize        int64    `mapstructure:"max_request_size"`
	AllowedMethods        []string `mapstructure:"allowed_methods"`
	AllowedHeaders        []string `mapstructure:"allowed_headers"`
}

// AIConfig contains AI/ML service configuration
type AIConfig struct {
	Enabled             bool          `mapstructure:"enabled"`
	Provider            string        `mapstructure:"provider" validate:"required,oneof=openai anthropic huggingface local"`
	Model               string        `mapstructure:"model" validate:"required"`
	APIKey              string        `mapstructure:"api_key"`
	Endpoint            string        `mapstructure:"endpoint"`
	Timeout             time.Duration `mapstructure:"timeout" validate:"required"`
	MaxTokens           int           `mapstructure:"max_tokens" validate:"required,min=1"`
	Temperature         float64       `mapstructure:"temperature" validate:"min=0,max=2"`
	TopP                float64       `mapstructure:"top_p" validate:"min=0,max=1"`
	FrequencyPenalty    float64       `mapstructure:"frequency_penalty" validate:"min=0,max=2"`
	PresencePenalty     float64       `mapstructure:"presence_penalty" validate:"min=0,max=2"`
	RetryAttempts       int           `mapstructure:"retry_attempts" validate:"min=0"`
	RetryDelay          time.Duration `mapstructure:"retry_delay" validate:"required"`
	CacheEnabled        bool          `mapstructure:"cache_enabled"`
	CacheTTL            time.Duration `mapstructure:"cache_ttl" validate:"required"`
	ConfidenceThreshold float64       `mapstructure:"confidence_threshold" validate:"min=0,max=1"`
}

// QuantumConfig contains quantum computing service configuration
type QuantumConfig struct {
	Enabled           bool          `mapstructure:"enabled"`
	Provider          string        `mapstructure:"provider" validate:"required,oneof=ibm rigetti dwave local"`
	Endpoint          string        `mapstructure:"endpoint"`
	APIKey            string        `mapstructure:"api_key"`
	Timeout           time.Duration `mapstructure:"timeout" validate:"required"`
	MaxQubits         int           `mapstructure:"max_qubits" validate:"required,min=1"`
	Backend           string        `mapstructure:"backend"`
	Shots             int           `mapstructure:"shots" validate:"required,min=1"`
	NoiseModel        string        `mapstructure:"noise_model"`
	ErrorMitigation   bool          `mapstructure:"error_mitigation"`
	Transpile         bool          `mapstructure:"transpile"`
	OptimizationLevel int           `mapstructure:"optimization_level" validate:"min=0,max=3"`
	CacheEnabled      bool          `mapstructure:"cache_enabled"`
	CacheTTL          time.Duration `mapstructure:"cache_ttl" validate:"required"`
}

// MonitoringConfig contains monitoring and observability configuration
type MonitoringConfig struct {
	Enabled     bool              `mapstructure:"enabled"`
	Metrics     MetricsConfig     `mapstructure:"metrics" validate:"required"`
	Tracing     TracingConfig     `mapstructure:"tracing" validate:"required"`
	HealthCheck HealthCheckConfig `mapstructure:"health_check" validate:"required"`
	Alerting    AlertingConfig    `mapstructure:"alerting" validate:"required"`
	Profiling   ProfilingConfig   `mapstructure:"profiling" validate:"required"`
}

// MetricsConfig contains metrics collection configuration
type MetricsConfig struct {
	Enabled   bool     `mapstructure:"enabled"`
	Provider  string   `mapstructure:"provider" validate:"required,oneof=prometheus datadog newrelic custom"`
	Port      int      `mapstructure:"port" validate:"required,min=1,max=65535"`
	Path      string   `mapstructure:"path" validate:"required"`
	Namespace string   `mapstructure:"namespace" validate:"required"`
	Subsystem string   `mapstructure:"subsystem"`
	Labels    []string `mapstructure:"labels"`
	Histogram bool     `mapstructure:"histogram"`
	Summary   bool     `mapstructure:"summary"`
	Gauge     bool     `mapstructure:"gauge"`
	Counter   bool     `mapstructure:"counter"`
}

// TracingConfig contains distributed tracing configuration
type TracingConfig struct {
	Enabled        bool          `mapstructure:"enabled"`
	Provider       string        `mapstructure:"provider" validate:"required,oneof=jaeger zipkin datadog xray"`
	Endpoint       string        `mapstructure:"endpoint"`
	ServiceName    string        `mapstructure:"service_name" validate:"required"`
	ServiceVersion string        `mapstructure:"service_version"`
	SampleRate     float64       `mapstructure:"sample_rate" validate:"min=0,max=1"`
	Timeout        time.Duration `mapstructure:"timeout" validate:"required"`
	MaxPayloadSize int           `mapstructure:"max_payload_size" validate:"min=1"`
	Propagators    []string      `mapstructure:"propagators"`
	Tags           []string      `mapstructure:"tags"`
}

// HealthCheckConfig contains health check configuration
type HealthCheckConfig struct {
	Enabled          bool          `mapstructure:"enabled"`
	Port             int           `mapstructure:"port" validate:"min=1,max=65535"`
	Path             string        `mapstructure:"path" validate:"required"`
	Interval         time.Duration `mapstructure:"interval" validate:"required"`
	Timeout          time.Duration `mapstructure:"timeout" validate:"required"`
	FailureThreshold int           `mapstructure:"failure_threshold" validate:"min=1"`
	SuccessThreshold int           `mapstructure:"success_threshold" validate:"min=1"`
	Checkers         []string      `mapstructure:"checkers"`
}

// AlertingConfig contains alerting configuration
type AlertingConfig struct {
	Enabled  bool            `mapstructure:"enabled"`
	Provider string          `mapstructure:"provider" validate:"required,oneof=pagerduty slack email webhook"`
	Rules    []AlertRule     `mapstructure:"rules"`
	Webhooks []WebhookConfig `mapstructure:"webhooks"`
	Email    EmailConfig     `mapstructure:"email"`
}

// AlertRule represents an alerting rule
type AlertRule struct {
	Name        string            `mapstructure:"name" validate:"required"`
	Expression  string            `mapstructure:"expression" validate:"required"`
	Severity    string            `mapstructure:"severity" validate:"required,oneof=critical warning info"`
	Duration    time.Duration     `mapstructure:"duration" validate:"required"`
	Labels      map[string]string `mapstructure:"labels"`
	Annotations map[string]string `mapstructure:"annotations"`
}

// ProfilingConfig contains profiling configuration
type ProfilingConfig struct {
	Enabled    bool     `mapstructure:"enabled"`
	Provider   string   `mapstructure:"provider" validate:"required,oneof=pprof pyroscope datadog"`
	Port       int      `mapstructure:"port" validate:"min=1,max=65535"`
	Path       string   `mapstructure:"path" validate:"required"`
	SampleRate float64  `mapstructure:"sample_rate" validate:"min=0,max=1"`
	Types      []string `mapstructure:"types"`
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level      string        `mapstructure:"level" validate:"required,oneof=trace debug info warn error fatal panic"`
	Format     string        `mapstructure:"format" validate:"required,oneof=json text console"`
	Output     []string      `mapstructure:"output" validate:"required"`
	File       FileConfig    `mapstructure:"file" validate:"required"`
	Syslog     SyslogConfig  `mapstructure:"syslog"`
	Console    ConsoleConfig `mapstructure:"console"`
	Structured bool          `mapstructure:"structured"`
	Fields     []string      `mapstructure:"fields"`
	MinLevel   string        `mapstructure:"min_level" validate:"required,oneof=trace debug info warn error fatal panic"`
	MaxLevel   string        `mapstructure:"max_level" validate:"required,oneof=trace debug info warn error fatal panic"`
}

// FileConfig contains file logging configuration
type FileConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	Path       string `mapstructure:"path" validate:"required"`
	MaxSize    int    `mapstructure:"max_size" validate:"required,min=1"`
	MaxAge     int    `mapstructure:"max_age" validate:"min=1"`
	MaxBackups int    `mapstructure:"max_backups" validate:"min=0"`
	Compress   bool   `mapstructure:"compress"`
	LocalTime  bool   `mapstructure:"local_time"`
	Rotate     bool   `mapstructure:"rotate"`
	Filter     string `mapstructure:"filter"`
}

// SyslogConfig contains syslog logging configuration
type SyslogConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	Network  string `mapstructure:"network" validate:"required,oneof=udp tcp unix"`
	RAddr    string `mapstructure:"r_addr"`
	Priority string `mapstructure:"priority" validate:"required"`
	Tag      string `mapstructure:"tag"`
	Facility string `mapstructure:"facility" validate:"required"`
}

// ConsoleConfig contains console logging configuration
type ConsoleConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	NoColor    bool   `mapstructure:"no_color"`
	TimeFormat string `mapstructure:"time_format"`
	MinWidth   int    `mapstructure:"min_width" validate:"min=1"`
	TabWidth   int    `mapstructure:"tab_width" validate:"min=1"`
	Padding    int    `mapstructure:"padding"`
	Prefix     string `mapstructure:"prefix"`
}

// FeaturesConfig contains feature flag configuration
type FeaturesConfig struct {
	FraudDetection     FeatureConfig `mapstructure:"fraud_detection" validate:"required"`
	AIAnalysis         FeatureConfig `mapstructure:"ai_analysis" validate:"required"`
	QuantumAnalysis    FeatureConfig `mapstructure:"quantum_analysis" validate:"required"`
	AdvancedAnalytics  FeatureConfig `mapstructure:"advanced_analytics" validate:"required"`
	RealTimeMonitoring FeatureConfig `mapstructure:"real_time_monitoring" validate:"required"`
	MultiCurrency      FeatureConfig `mapstructure:"multi_currency" validate:"required"`
	BatchProcessing    FeatureConfig `mapstructure:"batch_processing" validate:"required"`
	Webhooks           FeatureConfig `mapstructure:"webhooks" validate:"required"`
	AuditLogging       FeatureConfig `mapstructure:"audit_logging" validate:"required"`
	DataExport         FeatureConfig `mapstructure:"data_export" validate:"required"`
}

// FeatureConfig represents a feature flag configuration
type FeatureConfig struct {
	Enabled    bool                   `mapstructure:"enabled"`
	Percentage int                    `mapstructure:"percentage" validate:"min=0,max=100"`
	Rollout    map[string]interface{} `mapstructure:"rollout"`
	Conditions []FeatureCondition     `mapstructure:"conditions"`
}

// FeatureCondition represents a feature condition
type FeatureCondition struct {
	Type     string                 `mapstructure:"type" validate:"required"`
	Property string                 `mapstructure:"property" validate:"required"`
	Operator string                 `mapstructure:"operator" validate:"required"`
	Value    interface{}            `mapstructure:"value"`
	Metadata map[string]interface{} `mapstructure:"metadata"`
}

// ExternalServicesConfig contains external service configuration
type ExternalServicesConfig struct {
	Notifications NotificationConfig `mapstructure:"notifications" validate:"required"`
	Payment       PaymentConfig      `mapstructure:"payment" validate:"required"`
	Email         EmailServiceConfig `mapstructure:"email_service" validate:"required"`
	SMS           SMSServiceConfig   `mapstructure:"sms_service" validate:"required"`
	Storage       StorageConfig      `mapstructure:"storage" validate:"required"`
	CDN           CDNConfig          `mapstructure:"cdn" validate:"required"`
}

// NotificationConfig contains notification service configuration
type NotificationConfig struct {
	Enabled   bool                      `mapstructure:"enabled"`
	Channels  []string                  `mapstructure:"channels" validate:"required"`
	Providers map[string]ProviderConfig `mapstructure:"providers"`
}

// ProviderConfig contains provider-specific configuration
type ProviderConfig struct {
	Enabled   bool                   `mapstructure:"enabled"`
	Config    map[string]interface{} `mapstructure:"config"`
	RateLimit map[string]int         `mapstructure:"rate_limit"`
}

// PaymentConfig contains payment service configuration
type PaymentConfig struct {
	Enabled    bool          `mapstructure:"enabled"`
	Providers  []string      `mapstructure:"providers" validate:"required"`
	Default    string        `mapstructure:"default" validate:"required"`
	WebhookURL string        `mapstructure:"webhook_url"`
	Timeout    time.Duration `mapstructure:"timeout" validate:"required"`
}

// EmailServiceConfig contains email service configuration
type EmailServiceConfig struct {
	Enabled   bool                   `mapstructure:"enabled"`
	Provider  string                 `mapstructure:"provider" validate:"required,oneof=sendgrid ses mailgun smtp"`
	Config    map[string]interface{} `mapstructure:"config"`
	Templates map[string]string      `mapstructure:"templates"`
}

// SMSServiceConfig contains SMS service configuration
type SMSServiceConfig struct {
	Enabled  bool                   `mapstructure:"enabled"`
	Provider string                 `mapstructure:"provider" validate:"required,oneof=twilio plivo nexmo"`
	Config   map[string]interface{} `mapstructure:"config"`
}

// StorageConfig contains storage service configuration
type StorageConfig struct {
	Enabled  bool                    `mapstructure:"enabled"`
	Provider string                  `mapstructure:"provider" validate:"required,oneof=s3 gcs azure local"`
	Config   map[string]interface{}  `mapstructure:"config"`
	Buckets  map[string]BucketConfig `mapstructure:"buckets"`
}

// BucketConfig contains bucket-specific configuration
type BucketConfig struct {
	Name    string        `mapstructure:"name" validate:"required"`
	Public  bool          `mapstructure:"public"`
	Expiry  time.Duration `mapstructure:"expiry"`
	MaxSize int64         `mapstructure:"max_size" validate:"min=1"`
}

// CDNConfig contains CDN configuration
type CDNConfig struct {
	Enabled     bool          `mapstructure:"enabled"`
	Provider    string        `mapstructure:"provider" validate:"required,oneof=cloudflare fastly cloudfront"`
	Domain      string        `mapstructure:"domain"`
	CacheTTL    time.Duration `mapstructure:"cache_ttl" validate:"required"`
	Compression bool          `mapstructure:"compression"`
	Minify      bool          `mapstructure:"minify"`
}

// RateLimitingConfig contains rate limiting configuration
type RateLimitingConfig struct {
	Global  GlobalRateLimitConfig `mapstructure:"global" validate:"required"`
	Users   UserRateLimitConfig   `mapstructure:"users" validate:"required"`
	APIKeys APIKeyRateLimitConfig `mapstructure:"api_keys" validate:"required"`
	IPs     IPRateLimitConfig     `mapstructure:"ips" validate:"required"`
}

// GlobalRateLimitConfig contains global rate limiting configuration
type GlobalRateLimitConfig struct {
	Enabled bool          `mapstructure:"enabled"`
	Limit   int           `mapstructure:"limit" validate:"required,min=1"`
	Window  time.Duration `mapstructure:"window" validate:"required"`
	Burst   int           `mapstructure:"burst" validate="min=1"`
}

// UserRateLimitConfig contains user-specific rate limiting configuration
type UserRateLimitConfig struct {
	Enabled      bool          `mapstructure:"enabled"`
	DefaultLimit int           `mapstructure:"default_limit" validate:"required,min=1"`
	PremiumLimit int           `mapstructure:"premium_limit" validate:"required,min=1"`
	Window       time.Duration `mapstructure:"window" validate:"required"`
	Burst        int           `mapstructure:"burst" validate:"min=1"`
	Storage      string        `mapstructure:"storage" validate:"required,oneof=memory redis database"`
}

// APIKeyRateLimitConfig contains API key rate limiting configuration
type APIKeyRateLimitConfig struct {
	Enabled      bool           `mapstructure:"enabled"`
	DefaultLimit int            `mapstructure:"default_limit" validate:"required,min=1"`
	PremiumLimit int            `mapstructure:"premium_limit" validate:"required,min=1"`
	Window       time.Duration  `mapstructure:"window" validate:"required"`
	Burst        int            `mapstructure:"burst" validate:"min=1"`
	Storage      string         `mapstructure:"storage" validate:"required,oneof=memory redis database"`
	PerKeyLimits map[string]int `mapstructure:"per_key_limits"`
}

// IPRateLimitConfig contains IP-based rate limiting configuration
type IPRateLimitConfig struct {
	Enabled      bool          `mapstructure:"enabled"`
	DefaultLimit int           `mapstructure:"default_limit" validate:"required,min=1"`
	Window       time.Duration `mapstructure:"window" validate:"required"`
	Burst        int           `mapstructure:"burst" validate:"min=1"`
	Whitelist    []string      `mapstructure:"whitelist"`
	Blacklist    []string      `mapstructure:"blacklist"`
	Storage      string        `mapstructure:"storage" validate:"required,oneof=memory redis database"`
}

// CacheConfig contains caching configuration
type CacheConfig struct {
	Enabled     bool                           `mapstructure:"enabled"`
	Provider    string                         `mapstructure:"provider" validate:"required,oneof=redis memory database"`
	DefaultTTL  time.Duration                  `mapstructure:"default_ttl" validate:"required"`
	MaxEntries  int                            `mapstructure:"max_entries" validate:"min=1"`
	Eviction    string                         `mapstructure:"eviction" validate:"required,oneof=lru lfu random"`
	Compression bool                           `mapstructure:"compression"`
	Encryption  bool                           `mapstructure:"encryption"`
	Prefix      string                         `mapstructure:"prefix"`
	Caches      map[string]CacheInstanceConfig `mapstructure:"caches"`
}

// CacheInstanceConfig contains cache instance configuration
type CacheInstanceConfig struct {
	TTL      time.Duration `mapstructure:"ttl" validate:"required"`
	MaxSize  int           `mapstructure:"max_size" validate:"min=1"`
	Eviction string        `mapstructure:"eviction" validate:"required,oneof=lru lfu random"`
	Prefix   string        `mapstructure:"prefix"`
	Enabled  bool          `mapstructure:"enabled"`
}

// WebhookConfig contains webhook configuration
type WebhookConfig struct {
	Enabled      bool              `mapstructure:"enabled"`
	MaxRetries   int               `mapstructure:"max_retries" validate:"min=0"`
	RetryDelay   time.Duration     `mapstructure:"retry_delay" validate:"required"`
	Timeout      time.Duration     `mapstructure:"timeout" validate:"required"`
	MaxPayload   int64             `mapstructure:"max_payload" validate:"min=1"`
	AllowedHosts []string          `mapstructure:"allowed_hosts"`
	Secret       string            `mapstructure:"secret"`
	Headers      map[string]string `mapstructure:"headers"`
	Endpoints    []WebhookEndpoint `mapstructure:"endpoints"`
}

// WebhookEndpoint represents a webhook endpoint
type WebhookEndpoint struct {
	Name       string            `mapstructure:"name" validate:"required"`
	URL        string            `mapstructure:"url" validate:"required,url"`
	Events     []string          `mapstructure:"events" validate:"required"`
	Enabled    bool              `mapstructure:"enabled"`
	Secret     string            `mapstructure:"secret"`
	Headers    map[string]string `mapstructure:"headers"`
	Timeout    time.Duration     `mapstructure:"timeout"`
	MaxRetries int               `mapstructure:"max_retries" validate:"min=0"`
}

// EmailConfig contains email configuration for alerts
type EmailConfig struct {
	Enabled  bool       `mapstructure:"enabled"`
	From     string     `mapstructure:"from" validate:"required,email"`
	To       []string   `mapstructure:"to" validate:"required,min=1"`
	SMTP     SMTPConfig `mapstructure:"smtp" validate:"required"`
	Template string     `mapstructure:"template"`
}

// SMTPConfig contains SMTP configuration
type SMTPConfig struct {
	Host     string `mapstructure:"host" validate:"required"`
	Port     int    `mapstructure:"port" validate:"required,min=1,max=65535"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	SSL      bool   `mapstructure:"ssl"`
	StartTLS bool   `mapstructure:"starttls"`
}

// ConfigManager manages application configuration
type ConfigManager struct {
	config     *Config
	v          *viper.Viper
	validator  *validator.Validate
	secrets    map[string]string
	loaded     bool
	env        string
	configPath string
}

// NewConfigManager creates a new configuration manager
func NewConfigManager() *ConfigManager {
	v := viper.New()
	v.SetEnvPrefix("QUANTUMBEAM")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	return &ConfigManager{
		v:         v,
		validator: validator.New(),
		secrets:   make(map[string]string),
		env:       getEnvironment(),
	}
}

// LoadConfig loads configuration from file and environment
func (cm *ConfigManager) LoadConfig(configPath string) (*Config, error) {
	cm.configPath = configPath

	// Set configuration file paths
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/quantumbeam")
	viper.AddConfigPath(filepath.Dir(configPath))

	if configPath != "" {
		viper.SetConfigFile(configPath)
	}

	// Load environment-specific config
	envConfigFile := fmt.Sprintf("config.%s", cm.env)
	viper.SetConfigName(envConfigFile)
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("/etc/quantumbeam")

	// Read configuration files
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found, use defaults
			cm.setDefaults()
		} else {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	} else {
		// Config file found, set defaults for missing values
		cm.setDefaults()
	}

	// Load secrets from environment or external secret manager
	if err := cm.loadSecrets(); err != nil {
		return nil, fmt.Errorf("error loading secrets: %w", err)
	}

	// Unmarshal configuration
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	if err := cm.validator.Struct(&config); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	// Apply environment-specific overrides
	if err := cm.applyEnvironmentOverrides(&config); err != nil {
		return nil, fmt.Errorf("error applying environment overrides: %w", err)
	}

	// Post-process configuration
	if err := cm.postProcessConfig(&config); err != nil {
		return nil, fmt.Errorf("error post-processing config: %w", err)
	}

	cm.config = &config
	cm.loaded = true

	return &config, nil
}

// GetConfig returns the loaded configuration
func (cm *ConfigManager) GetConfig() *Config {
	if !cm.loaded {
		panic("configuration not loaded")
	}
	return cm.config
}

// ReloadConfig reloads configuration from files
func (cm *ConfigManager) ReloadConfig() error {
	return cm.LoadConfig(cm.configPath)
}

// GetSecret returns a secret value
func (cm *ConfigManager) GetSecret(key string) (string, bool) {
	value, exists := cm.secrets[key]
	return value, exists
}

// SetSecret sets a secret value
func (cm *ConfigManager) SetSecret(key, value string) {
	cm.secrets[key] = value
}

// setDefaults sets default configuration values
func (cm *ConfigManager) setDefaults() {
	// Environment defaults
	viper.SetDefault("environment.name", "development")
	viper.SetDefault("environment.debug", true)
	viper.SetDefault("environment.region", "us-east-1")
	viper.SetDefault("environment.zone", "us-east-1a")
	viper.SetDefault("environment.version", "1.0.0")

	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "60s")
	viper.SetDefault("server.shutdown_timeout", "30s")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.dbname", "quantumbeam")
	viper.SetDefault("database.sslmode", "prefer")
	viper.SetDefault("database.max_connections", 20)
	viper.SetDefault("database.min_connections", 5)
	viper.SetDefault("database.max_idle_connections", 10)
	viper.SetDefault("database.max_lifetime", "1h")
	viper.SetDefault("database.max_idle_time", "30m")
	viper.SetDefault("database.connect_timeout", "10s")
	viper.SetDefault("database.query_timeout", "30s")
	viper.SetDefault("database.slow_query_threshold", "100ms")
	viper.SetDefault("database.enable_query_logger", false)
	viper.SetDefault("database.migration_path", "./migrations")
	viper.SetDefault("database.seed_data_path", "./seeds")
	viper.SetDefault("database.connection_attempts", 3)
	viper.SetDefault("database.connection_retry_wait", "1s")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)
	viper.SetDefault("redis.min_idle_conns", 3)
	viper.SetDefault("redis.max_retries", 3)
	viper.SetDefault("redis.dial_timeout", "5s")
	viper.SetDefault("redis.read_timeout", "3s")
	viper.SetDefault("redis.write_timeout", "3s")
	viper.SetDefault("redis.pool_timeout", "4s")
	viper.SetDefault("redis.idle_timeout", "5m")
	viper.SetDefault("redis.idle_check_frequency", "1m")

	// Security defaults
	viper.SetDefault("security.jwt.secret", "your-super-secret-jwt-key-change-this-in-production")
	viper.SetDefault("security.jwt.access_expiration", "15m")
	viper.SetDefault("security.jwt.refresh_expiration", "7d")
	viper.SetDefault("security.jwt.issuer", "quantumbeam")
	viper.SetDefault("security.jwt.algorithm", "HS256")
	viper.SetDefault("security.jwt.refresh_enabled", true)
	viper.SetDefault("security.jwt.blacklist_enabled", true)

	viper.SetDefault("security.password.min_length", 8)
	viper.SetDefault("security.password.max_length", 128)
	viper.SetDefault("security.password.require_uppercase", true)
	viper.SetDefault("security.password.require_lowercase", true)
	viper.SetDefault("security.password.require_numbers", true)
	viper.SetDefault("security.password.require_special", true)
	viper.SetDefault("security.password.special_chars", "!@#$%^&*()_+-=[]{}|;:,.<>?")
	viper.SetDefault("security.password.hash_algorithm", "bcrypt")
	viper.SetDefault("security.password.hash_iterations", 12)
	viper.SetDefault("security.password.hash_salt_length", 16)

	viper.SetDefault("security.rate_limit.enabled", true)
	viper.SetDefault("security.rate_limit.algorithm", "token_bucket")
	viper.SetDefault("security.rate_limit.global_limit", 1000)
	viper.SetDefault("security.rate_limit.window", "1m")
	viper.SetDefault("security.rate_limit.burst_size", 100)
	viper.SetDefault("security.rate_limit.storage", "redis")

	viper.SetDefault("security.encryption.algorithm", "AES256-GCM")
	viper.SetDefault("security.encryption.key_length", 256)
	viper.SetDefault("security.encryption.key_rotation", true)
	viper.SetDefault("security.encryption.rotation_period", "90d")
	viper.SetDefault("security.encryption.key_derivation", "PBKDF2")

	viper.SetDefault("security.session.store", "redis")
	viper.SetDefault("security.session.cookie_name", "quantumbeam_session")
	viper.SetDefault("security.session.max_age", "24h")
	viper.SetDefault("security.session.path", "/")
	viper.SetDefault("security.session.secure", true)
	viper.SetDefault("security.session.http_only", true)
	viper.SetDefault("security.session.same_site", "Lax")

	viper.SetDefault("security.api_key.default_rate_limit_per_minute", 1000)
	viper.SetDefault("security.api_key.default_rate_limit_per_hour", 100000)
	viper.SetDefault("security.api_key.max_keys_per_user", 10)
	viper.SetDefault("security.api_key.key_length", 32)
	viper.SetDefault("security.api_key.key_prefix", "qb_")
	viper.SetDefault("security.api_key.default_expiration", "365d")
	viper.SetDefault("security.api_key.max_expiration", "730d")
	viper.SetDefault("security.api_key.require_approval", false)
	viper.SetDefault("security.api_key.auto_cleanup_expired", true)
	viper.SetDefault("security.api_key.cleanup_interval", "1h")

	viper.SetDefault("security.web_security.csp_enabled", false)
	viper.SetDefault("security.web_security.xss_protection", true)
	viper.SetDefault("security.web_security.content_type_nosniff", true)
	viper.SetDefault("security.web_security.x_frame_options", "DENY")
	viper.SetDefault("security.web_security.hsts_max_age", 31536000)
	viper.SetDefault("security.web_security.hsts_include_subdomains", true)
	viper.SetDefault("security.web_security.max_request_size", 10485760) // 10MB

	// AI defaults
	viper.SetDefault("ai.enabled", true)
	viper.SetDefault("ai.provider", "openai")
	viper.SetDefault("ai.model", "gpt-4")
	viper.SetDefault("ai.timeout", "30s")
	viper.SetDefault("ai.max_tokens", 4096)
	viper.SetDefault("ai.temperature", 0.7)
	viper.SetDefault("ai.top_p", 1.0)
	viper.SetDefault("ai.frequency_penalty", 0.0)
	viper.SetDefault("ai.presence_penalty", 0.0)
	viper.SetDefault("ai.retry_attempts", 3)
	viper.SetDefault("ai.retry_delay", "1s")
	viper.SetDefault("ai.cache_enabled", true)
	viper.SetDefault("ai.cache_ttl", "1h")
	viper.SetDefault("ai.confidence_threshold", 0.8)

	// Quantum defaults
	viper.SetDefault("quantum.enabled", false)
	viper.SetDefault("quantum.provider", "ibm")
	viper.SetDefault("quantum.timeout", "300s")
	viper.SetDefault("quantum.max_qubits", 32)
	viper.SetDefault("quantum.shots", 1024)
	viper.SetDefault("quantum.error_mitigation", true)
	viper.SetDefault("quantum.transpile", true)
	viper.SetDefault("quantum.optimization_level", 2)
	viper.SetDefault("quantum.cache_enabled", true)
	viper.SetDefault("quantum.cache_ttl", "24h")

	// Monitoring defaults
	viper.SetDefault("monitoring.enabled", true)
	viper.SetDefault("monitoring.metrics.enabled", true)
	viper.SetDefault("monitoring.metrics.provider", "prometheus")
	viper.SetDefault("monitoring.metrics.port", 9090)
	viper.SetDefault("monitoring.metrics.path", "/metrics")
	viper.SetDefault("monitoring.metrics.namespace", "quantumbeam")
	viper.SetDefault("monitoring.metrics.histogram", true)
	viper.SetDefault("monitoring.metrics.summary", true)
	viper.SetDefault("monitoring.metrics.gauge", true)
	viper.SetDefault("monitoring.metrics.counter", true)

	viper.SetDefault("monitoring.tracing.enabled", true)
	viper.SetDefault("monitoring.tracing.provider", "jaeger")
	viper.SetDefault("monitoring.tracing.service_name", "quantumbeam-api")
	viper.SetDefault("monitoring.tracing.sample_rate", 0.1)
	viper.SetDefault("monitoring.tracing.timeout", "5s")
	viper.SetDefault("monitoring.tracing.max_payload_size", 10240)

	viper.SetDefault("monitoring.health_check.enabled", true)
	viper.SetDefault("monitoring.health_check.port", 8081)
	viper.SetDefault("monitoring.health_check.path", "/health")
	viper.SetDefault("monitoring.health_check.interval", "30s")
	viper.SetDefault("monitoring.health_check.timeout", "5s")
	viper.SetDefault("monitoring.health_check.failure_threshold", 3)
	viper.SetDefault("monitoring.health_check.success_threshold", 1)

	viper.SetDefault("monitoring.profiling.enabled", false)
	viper.SetDefault("monitoring.profiling.provider", "pprof")
	viper.SetDefault("monitoring.profiling.port", 6060)
	viper.SetDefault("monitoring.profiling.path", "/debug/pprof")
	viper.SetDefault("monitoring.profiling.sample_rate", 0.1)

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output", []string{"stdout"})
	viper.SetDefault("logging.structured", true)
	viper.SetDefault("logging.min_level", "trace")
	viper.SetDefault("logging.max_level", "fatal")

	viper.SetDefault("logging.file.enabled", false)
	viper.SetDefault("logging.file.path", "/var/log/quantumbeam/app.log")
	viper.SetDefault("logging.file.max_size", 100)
	viper.SetDefault("logging.file.max_age", 30)
	viper.SetDefault("logging.file.max_backups", 10)
	viper.SetDefault("logging.file.compress", true)
	viper.SetDefault("logging.file.local_time", false)
	viper.SetDefault("logging.file.rotate", true)

	viper.SetDefault("logging.console.enabled", true)
	viper.SetDefault("logging.console.no_color", false)
	viper.SetDefault("logging.console.time_format", "2006-01-02T15:04:05.000Z07:00")
	viper.SetDefault("logging.console.min_width", 80)
	viper.SetDefault("logging.console.tab_width", 4)
	viper.SetDefault("logging.console.padding", 3)

	// Features defaults
	viper.SetDefault("features.fraud_detection.enabled", true)
	viper.SetDefault("features.fraud_detection.percentage", 100)

	viper.SetDefault("features.ai_analysis.enabled", true)
	viper.SetDefault("features.ai_analysis.percentage", 100)

	viper.SetDefault("features.quantum_analysis.enabled", false)
	viper.SetDefault("features.quantum_analysis.percentage", 0)

	viper.SetDefault("features.advanced_analytics.enabled", true)
	viper.SetDefault("features.advanced_analytics.percentage", 100)

	viper.SetDefault("features.real_time_monitoring.enabled", true)
	viper.SetDefault("features.real_time_monitoring.percentage", 100)

	viper.SetDefault("features.multi_currency.enabled", true)
	viper.SetDefault("features.multi_currency.percentage", 100)

	viper.SetDefault("features.batch_processing.enabled", true)
	viper.SetDefault("features.batch_processing.percentage", 100)

	viper.SetDefault("features.webhooks.enabled", true)
	viper.SetDefault("features.webhooks.percentage", 100)

	viper.SetDefault("features.audit_logging.enabled", true)
	viper.SetDefault("features.audit_logging.percentage", 100)

	viper.SetDefault("features.data_export.enabled", true)
	viper.SetDefault("features.data_export.percentage", 100)

	// Rate limiting defaults
	viper.SetDefault("rate_limiting.global.enabled", true)
	viper.SetDefault("rate_limiting.global.limit", 10000)
	viper.SetDefault("rate_limiting.global.window", "1m")
	viper.SetDefault("rate_limiting.global.burst", 1000)

	viper.SetDefault("rate_limiting.users.enabled", true)
	viper.SetDefault("rate_limiting.users.default_limit", 1000)
	viper.SetDefault("rate_limiting.users.premium_limit", 5000)
	viper.SetDefault("rate_limiting.users.window", "1m")
	viper.SetDefault("rate_limiting.users.burst", 100)
	viper.SetDefault("rate_limiting.users.storage", "redis")

	viper.SetDefault("rate_limiting.api_keys.enabled", true)
	viper.SetDefault("rate_limiting.api_keys.default_limit", 1000)
	viper.SetDefault("rate_limiting.api_keys.premium_limit", 5000)
	viper.SetDefault("rate_limiting.api_keys.window", "1m")
	viper.SetDefault("rate_limiting.api_keys.burst", 100)
	viper.SetDefault("rate_limiting.api_keys.storage", "redis")

	viper.SetDefault("rate_limiting.ips.enabled", true)
	viper.SetDefault("rate_limiting.ips.default_limit", 500)
	viper.SetDefault("rate_limiting.ips.window", "1m")
	viper.SetDefault("rate_limiting.ips.burst", 50)
	viper.SetDefault("rate_limiting.ips.storage", "redis")

	// Cache defaults
	viper.SetDefault("cache.enabled", true)
	viper.SetDefault("cache.provider", "redis")
	viper.SetDefault("cache.default_ttl", "1h")
	viper.SetDefault("cache.max_entries", 10000)
	viper.SetDefault("cache.eviction", "lru")
	viper.SetDefault("cache.compression", false)
	viper.SetDefault("cache.encryption", false)
	viper.SetDefault("cache.prefix", "qb:")

	// Webhook defaults
	viper.SetDefault("webhook.enabled", true)
	viper.SetDefault("webhook.max_retries", 3)
	viper.SetDefault("webhook.retry_delay", "1s")
	viper.SetDefault("webhook.timeout", "30s")
	viper.SetDefault("webhook.max_payload", 1048576) // 1MB
}

// getEnvironment returns the current environment
func getEnvironment() string {
	env := os.Getenv("QUANTUMBEAM_ENVIRONMENT")
	if env == "" {
		env = os.Getenv("APP_ENV")
	}
	if env == "" {
		env = os.Getenv("GO_ENV")
	}
	if env == "" {
		env = "development"
	}
	return env
}

// loadSecrets loads secrets from environment or external sources
func (cm *ConfigManager) loadSecrets() error {
	// Load secrets from environment variables
	secrets := map[string]string{
		"database.password":                    os.Getenv("DB_PASSWORD"),
		"redis.password":                       os.Getenv("REDIS_PASSWORD"),
		"jwt.secret":                           os.Getenv("JWT_SECRET"),
		"ai.api_key":                           os.Getenv("AI_API_KEY"),
		"quantum.api_key":                      os.Getenv("QUANTUM_API_KEY"),
		"encryption.key":                       os.Getenv("ENCRYPTION_KEY"),
		"webhook.secret":                       os.Getenv("WEBHOOK_SECRET"),
		"external_services.email.api_key":      os.Getenv("EMAIL_API_KEY"),
		"external_services.sms.api_key":        os.Getenv("SMS_API_KEY"),
		"external_services.payment.api_key":    os.Getenv("PAYMENT_API_KEY"),
		"external_services.storage.secret_key": os.Getenv("STORAGE_SECRET_KEY"),
	}

	for key, value := range secrets {
		if value != "" {
			cm.secrets[key] = value
		}
	}

	return nil
}

// applyEnvironmentOverrides applies environment-specific configuration overrides
func (cm *ConfigManager) applyEnvironmentOverrides(config *Config) error {
	switch cm.env {
	case "production":
		// Production overrides
		if config.Environment.Debug {
			config.Environment.Debug = false
		}
		if config.Logging.Level == "debug" {
			config.Logging.Level = "info"
		}
		if config.Database.SSLMode == "disable" {
			config.Database.SSLMode = "require"
		}
		if !config.Server.TLS.Enabled {
			config.Server.TLS.Enabled = true
		}
		if !config.Security.Session.Secure {
			config.Security.Session.Secure = true
		}
		if !config.Monitoring.Tracing.Enabled {
			config.Monitoring.Tracing.Enabled = true
		}
		if config.Monitoring.Tracing.SampleRate == 0.1 {
			config.Monitoring.Tracing.SampleRate = 0.01 // Sample less in production
		}

	case "staging":
		// Staging overrides
		if config.Logging.Level == "debug" {
			config.Logging.Level = "info"
		}
		if config.Database.SSLMode == "disable" {
			config.Database.SSLMode = "prefer"
		}
		if !config.Monitoring.Tracing.Enabled {
			config.Monitoring.Tracing.Enabled = true
		}

	case "development":
		// Development overrides
		if !config.Environment.Debug {
			config.Environment.Debug = true
		}
		if config.Logging.Level == "info" {
			config.Logging.Level = "debug"
		}
		if config.Database.SSLMode == "require" {
			config.Database.SSLMode = "disable"
		}
		if config.Server.TLS.Enabled {
			config.Server.TLS.Enabled = false
		}
		if config.Security.Session.Secure {
			config.Security.Session.Secure = false
		}
		if !config.Database.EnableQueryLogger {
			config.Database.EnableQueryLogger = true
		}
	}

	return nil
}

// postProcessConfig performs post-processing on configuration
func (cm *ConfigManager) postProcessConfig(config *Config) error {
	// Set instance ID if not provided
	if config.Environment.InstanceID == "" {
		hostname, _ := os.Hostname()
		config.Environment.InstanceID = fmt.Sprintf("%s-%d", hostname, time.Now().Unix())
	}

	// Set build time if not provided
	if config.Environment.BuildTime == "" {
		if buildTime := os.Getenv("BUILD_TIME"); buildTime != "" {
			config.Environment.BuildTime = buildTime
		} else {
			config.Environment.BuildTime = time.Now().Format(time.RFC3339)
		}
	}

	// Set git commit if not provided
	if config.Environment.GitCommit == "" {
		if gitCommit := os.Getenv("GIT_COMMIT"); gitCommit != "" {
			config.Environment.GitCommit = gitCommit
		}
	}

	// Apply secrets to configuration
	if dbPassword, exists := cm.GetSecret("database.password"); exists {
		config.Database.Password = dbPassword
	}
	if redisPassword, exists := cm.GetSecret("redis.password"); exists {
		config.Redis.Password = redisPassword
	}
	if jwtSecret, exists := cm.GetSecret("jwt.secret"); exists {
		config.Security.JWT.Secret = jwtSecret
	}
	if aiAPIKey, exists := cm.GetSecret("ai.api_key"); exists {
		config.AI.APIKey = aiAPIKey
	}
	if quantumAPIKey, exists := cm.GetSecret("quantum.api_key"); exists {
		config.Quantum.APIKey = quantumAPIKey
	}
	if encryptionKey, exists := cm.GetSecret("encryption.key"); exists {
		config.Security.Encryption.Key = encryptionKey
	}

	// Validate critical security settings
	if config.Environment.Name == "production" {
		if config.Security.JWT.Secret == "your-super-secret-jwt-key-change-this-in-production" {
			return fmt.Errorf("production environment requires a secure JWT secret")
		}
		if config.Database.SSLMode == "disable" {
			return fmt.Errorf("production environment requires SSL for database connections")
		}
	}

	return nil
}

// SaveConfig saves configuration to file
func (cm *ConfigManager) SaveConfig(config *Config, filePath string) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("error marshaling config: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("error writing config file: %w", err)
	}

	return nil
}

// ExportConfig exports configuration in specified format
func (cm *ConfigManager) ExportConfig(format string) ([]byte, error) {
	if !cm.loaded {
		return nil, fmt.Errorf("configuration not loaded")
	}

	switch format {
	case "json":
		return json.MarshalIndent(cm.config, "", "  ")
	case "yaml":
		return yaml.Marshal(cm.config)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// ValidateConfig validates the current configuration
func (cm *ConfigManager) ValidateConfig() error {
	if !cm.loaded {
		return fmt.Errorf("configuration not loaded")
	}

	return cm.validator.Struct(cm.config)
}

// GetEnvironment returns the current environment
func (cm *ConfigManager) GetEnvironment() string {
	return cm.env
}

// IsProduction returns true if running in production
func (cm *ConfigManager) IsProduction() bool {
	return cm.env == "production"
}

// IsDevelopment returns true if running in development
func (cm *ConfigManager) IsDevelopment() bool {
	return cm.env == "development"
}

// IsStaging returns true if running in staging
func (cm *ConfigManager) IsStaging() bool {
	return cm.env == "staging"
}

// String returns a string representation of the configuration
func (cm *ConfigManager) String() string {
	if !cm.loaded {
		return "Configuration not loaded"
	}

	data, err := yaml.Marshal(cm.config)
	if err != nil {
		return fmt.Sprintf("Error marshaling config: %v", err)
	}

	return string(data)
}
