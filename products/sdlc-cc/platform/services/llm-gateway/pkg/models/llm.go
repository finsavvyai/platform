package models

import (
	"time"
)

// CompletionRequest represents a request to generate text completion
type CompletionRequest struct {
	Model       string            `json:"model" binding:"required"`
	Messages    []Message         `json:"messages" binding:"required"`
	MaxTokens   int               `json:"max_tokens,omitempty"`
	Temperature float64           `json:"temperature,omitempty"`
	TopP        float64           `json:"top_p,omitempty"`
	Stream      bool              `json:"stream,omitempty"`
	Stop        []string          `json:"stop,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	UserID      string            `json:"user_id,omitempty"`
	TenantID    string            `json:"tenant_id,omitempty"`
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role" binding:"required,oneof=system user assistant"`
	Content string `json:"content" binding:"required"`
	Name    string `json:"name,omitempty"`
}

// CompletionResponse represents the response from a completion request
type CompletionResponse struct {
	ID                string            `json:"id"`
	Object            string            `json:"object"`
	Created           int64             `json:"created"`
	Model             string            `json:"model"`
	Choices           []Choice          `json:"choices"`
	Usage             TokenUsage        `json:"usage"`
	Provider          string            `json:"provider"`
	ProcessingTime    time.Duration     `json:"processing_time"`
	Cost              float64           `json:"cost"`
	Metadata          map[string]string `json:"metadata,omitempty"`
	PromptInjection   bool              `json:"prompt_injection_detected"`
	SanitizationLevel string            `json:"sanitization_level"`
}

// Choice represents a completion choice
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message,omitempty"`
	Text         string  `json:"text,omitempty"`
	FinishReason string  `json:"finish_reason"`
}

// TokenUsage represents token usage information
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ModelInfo contains information about an LLM model
type ModelInfo struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Provider       string   `json:"provider"`
	MaxTokens      int      `json:"max_tokens"`
	InputCost      float64  `json:"input_cost_per_1k"`
	OutputCost     float64  `json:"output_cost_per_1k"`
	Capabilities   []string `json:"capabilities"`
	IsAvailable    bool     `json:"is_available"`
	HealthCheckURL string   `json:"health_check_url,omitempty"`
}

// HealthStatus represents the health status of a provider
type HealthStatus struct {
	Provider    string            `json:"provider"`
	Status      string            `json:"status"` // "healthy", "degraded", "unhealthy"
	LastChecked time.Time         `json:"last_checked"`
	Latency     time.Duration     `json:"latency"`
	Error       string            `json:"error,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// CostRecord represents a cost tracking record
type CostRecord struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	TenantID     string    `json:"tenant_id" gorm:"index"`
	UserID       string    `json:"user_id" gorm:"index"`
	Provider     string    `json:"provider"`
	Model        string    `json:"model"`
	PromptTokens int       `json:"prompt_tokens"`
	OutputTokens int       `json:"output_tokens"`
	TotalTokens  int       `json:"total_tokens"`
	Cost         float64   `json:"cost"`
	Currency     string    `json:"currency"`
	Timestamp    time.Time `json:"timestamp" gorm:"index"`
	RequestID    string    `json:"request_id" gorm:"index"`
	Metadata     string    `json:"metadata" gorm:"type:text"`
}

// Budget represents a budget configuration
type Budget struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	TenantID       string    `json:"tenant_id" gorm:"uniqueIndex"`
	UserID         string    `json:"user_id" gorm:"index"`
	MonthlyLimit   float64   `json:"monthly_limit"`
	DailyLimit     float64   `json:"daily_limit"`
	AlertThreshold float64   `json:"alert_threshold"` // percentage
	CurrentSpend   float64   `json:"current_spend"`
	Currency       string    `json:"currency"`
	Period         string    `json:"period"` // "monthly", "daily"
	ResetDate      time.Time `json:"reset_date"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ProviderConfig represents configuration for an LLM provider
type ProviderConfig struct {
	Name           string                 `json:"name" mapstructure:"name"`
	Type           string                 `json:"type" mapstructure:"type"`
	APIKey         string                 `json:"api_key" mapstructure:"api_key"`
	BaseURL        string                 `json:"base_url,omitempty" mapstructure:"base_url"`
	Models         []ModelConfig          `json:"models" mapstructure:"models"`
	Priority       int                    `json:"priority" mapstructure:"priority"`
	CostMultiplier float64                `json:"cost_multiplier" mapstructure:"cost_multiplier"`
	Timeout        time.Duration          `json:"timeout" mapstructure:"timeout"`
	RetryAttempts  int                    `json:"retry_attempts" mapstructure:"retry_attempts"`
	Enabled        bool                   `json:"enabled" mapstructure:"enabled"`
	Settings       map[string]interface{} `json:"settings,omitempty" mapstructure:"settings"`
}

// ModelConfig represents configuration for a specific model
type ModelConfig struct {
	ID           string   `json:"id" mapstructure:"id"`
	Name         string   `json:"name" mapstructure:"name"`
	MaxTokens    int      `json:"max_tokens" mapstructure:"max_tokens"`
	InputCost    float64  `json:"input_cost" mapstructure:"input_cost"`
	OutputCost   float64  `json:"output_cost" mapstructure:"output_cost"`
	Capabilities []string `json:"capabilities" mapstructure:"capabilities"`
	Enabled      bool     `json:"enabled" mapstructure:"enabled"`
}

// BudgetConfig holds budget and cost limits (for config).
type BudgetConfig struct {
	DefaultMonthlyLimit float64 `mapstructure:"default_monthly_limit" yaml:"default_monthly_limit"`
	DefaultDailyLimit   float64 `mapstructure:"default_daily_limit" yaml:"default_daily_limit"`
	AlertThreshold      float64 `mapstructure:"alert_threshold" yaml:"alert_threshold"`
	Currency            string  `mapstructure:"currency" yaml:"currency"`
}

// SecurityConfig represents security-related configuration
type SecurityConfig struct {
	PromptInjectionDetection bool     `json:"prompt_injection_detection" mapstructure:"prompt_injection_detection"`
	ResponseSanitization     bool     `json:"response_sanitization" mapstructure:"response_sanitization"`
	JailbreakProtection      bool     `json:"jailbreak_protection" mapstructure:"jailbreak_protection"`
	BannedPatterns           []string `json:"banned_patterns" mapstructure:"banned_patterns"`
	MaxResponseLength        int      `json:"max_response_length" mapstructure:"max_response_length"`
	AllowedDomains           []string `json:"allowed_domains" mapstructure:"allowed_domains"`
}
