package storage

import "time"

// ConnectionRecord is a persisted connection configuration.
type ConnectionRecord struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	Platform         string     `json:"platform"`
	AuthMethod       string     `json:"auth_method"`
	Token            string     `json:"-"`
	Username         string     `json:"-"`
	AppPassword      string     `json:"-"`
	BaseURL          string     `json:"base_url"`
	ProviderIdentity string     `json:"provider_identity,omitempty"`
	InstallationID   int64      `json:"installation_id,omitempty"`
	CredentialRef    string     `json:"credential_ref,omitempty"`
	HealthStatus     string     `json:"health_status"`
	LastVerifiedAt   *time.Time `json:"last_verified_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// FindingRecord represents a persisted security finding.
type FindingRecord struct {
	ID                int64     `json:"id"`
	ConnectionName    string    `json:"connection_name"`
	RunID             string    `json:"run_id"`
	Severity          string    `json:"severity"`
	Category          string    `json:"category"`
	Title             string    `json:"title"`
	Description       string    `json:"description"`
	Remediation       string    `json:"remediation"`
	File              string    `json:"file,omitempty"`
	Line              int       `json:"line,omitempty"`
	Confidence        float64   `json:"confidence"`
	FalsePositive     bool      `json:"false_positive"`
	Status            string    `json:"status"`
	SuppressionReason string    `json:"suppression_reason,omitempty"`
	SuppressionNote   string    `json:"suppression_note,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// ScheduleRow is a persisted scan schedule for a connection.
type ScheduleRow struct {
	ConnectionName string     `json:"connection_name"`
	CronExpr       string     `json:"cron_expr"`
	Enabled        bool       `json:"enabled"`
	NotifyOn       string     `json:"notify_on"`
	LastRunAt      *time.Time `json:"last_run_at,omitempty"`
	NextRunAt      *time.Time `json:"next_run_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// AnalysisRecord represents a persisted analysis run.
type AnalysisRecord struct {
	ID             int64     `json:"id"`
	ConnectionName string    `json:"connection_name"`
	RunID          string    `json:"run_id"`
	Summary        string    `json:"summary"`
	RiskScore      int       `json:"risk_score"`
	FindingsCount  int       `json:"findings_count"`
	TokensUsed     int       `json:"tokens_used"`
	Model          string    `json:"model"`
	DurationMS     int64     `json:"duration_ms"`
	AnalyzedAt     time.Time `json:"analyzed_at"`
}

// OAuthStateRecord is persisted state for OAuth callback verification.
type OAuthStateRecord struct {
	State     string    `json:"state"`
	Provider  string    `json:"provider"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// SubscriptionRecord tracks billing state without blocking app startup.
type SubscriptionRecord struct {
	TenantID       string     `json:"tenant_id"`
	Tier           string     `json:"tier"`
	Status         string     `json:"status"`
	SubscriptionID string     `json:"subscription_id,omitempty"`
	CustomerID     string     `json:"customer_id,omitempty"`
	RenewsAt       *time.Time `json:"renews_at,omitempty"`
	CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// WebhookConfigRecord stores outbound webhook delivery settings.
type WebhookConfigRecord struct {
	Name           string     `json:"name"`
	URL            string     `json:"url"`
	Secret         string     `json:"-"`
	Events         []string   `json:"events"`
	Enabled        bool       `json:"enabled"`
	LastTestedAt   *time.Time `json:"last_tested_at,omitempty"`
	LastStatusCode int        `json:"last_status_code,omitempty"`
	LastError      string     `json:"last_error,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
