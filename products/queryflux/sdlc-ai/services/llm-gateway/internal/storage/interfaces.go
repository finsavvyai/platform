package storage

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// CostTracker defines the interface for cost tracking
type CostTracker interface {
	// RecordCost records a cost transaction
	RecordCost(ctx context.Context, cost *models.CostRecord) error

	// GetCurrentUsage gets current usage for a tenant/user
	GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error)

	// GetCostHistory retrieves cost history
	GetCostHistory(ctx context.Context, tenantID, userID string,
		startTime, endTime time.Time) ([]*models.CostRecord, error)

	// GetCostSummary gets a summary of costs
	GetCostSummary(ctx context.Context, tenantID, userID string,
		period string) (*CostSummary, error)

	// UpdateBudget updates a budget
	UpdateBudget(ctx context.Context, budget *models.Budget) error

	// GetBudget gets a budget
	GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error)

	// GetTopSpenders gets top spending users/tenants
	GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*SpenderInfo, error)
}

// UsageStats represents current usage statistics
type UsageStats struct {
	TenantID        string    `json:"tenant_id"`
	UserID          string    `json:"user_id"`
	DailySpend      float64   `json:"daily_spend"`
	MonthlySpend    float64   `json:"monthly_spend"`
	DailyTokens     int       `json:"daily_tokens"`
	MonthlyTokens   int       `json:"monthly_tokens"`
	LastRequestTime time.Time `json:"last_request_time"`
	RequestsCount   int       `json:"requests_count"`
}

// CostSummary represents a cost summary for a period
type CostSummary struct {
	Period              string             `json:"period"`
	StartTime           time.Time          `json:"start_time"`
	EndTime             time.Time          `json:"end_time"`
	TotalCost           float64            `json:"total_cost"`
	TotalTokens         int                `json:"total_tokens"`
	CostByProvider      map[string]float64 `json:"cost_by_provider"`
	CostByModel         map[string]float64 `json:"cost_by_model"`
	CostByUser          map[string]float64 `json:"cost_by_user"`
	AverageCostPerToken float64            `json:"average_cost_per_token"`
	PeakUsageTime       time.Time          `json:"peak_usage_time"`
}

// SpenderInfo represents information about a top spender
type SpenderInfo struct {
	UserID       string  `json:"user_id"`
	TenantID     string  `json:"tenant_id"`
	TotalSpend   float64 `json:"total_spend"`
	TokenCount   int     `json:"token_count"`
	RequestCount int     `json:"request_count"`
	AverageCost  float64 `json:"average_cost"`
}

// BudgetManager defines the interface for budget management
type BudgetManager interface {
	// CreateBudget creates a new budget
	CreateBudget(ctx context.Context, budget *models.Budget) error

	// GetBudget retrieves a budget
	GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error)

	// UpdateBudget updates an existing budget
	UpdateBudget(ctx context.Context, budget *models.Budget) error

	// DeleteBudget deletes a budget
	DeleteBudget(ctx context.Context, tenantID, userID string) error

	// CheckBudget checks if a request is within budget
	CheckBudget(ctx context.Context, tenantID, userID string,
		estimatedCost float64) (*BudgetCheckResult, error)

	// ListBudgets lists all budgets
	ListBudgets(ctx context.Context, tenantID string) ([]*models.Budget, error)
}

// BudgetCheckResult represents the result of a budget check
type BudgetCheckResult struct {
	Allowed         bool      `json:"allowed"`
	RemainingBudget float64   `json:"remaining_budget"`
	CurrentSpend    float64   `json:"current_spend"`
	Limit           float64   `json:"limit"`
	Period          string    `json:"period"`
	ResetTime       time.Time `json:"reset_time"`
	Reason          string    `json:"reason"`
}

// TokenTracker defines the interface for token tracking
type TokenTracker interface {
	// TrackTokens tracks token usage
	TrackTokens(ctx context.Context, tracking *TokenTracking) error

	// GetTokenUsage gets token usage statistics
	GetTokenUsage(ctx context.Context, tenantID, userID string,
		period string) (*TokenUsage, error)

	// GetTokenHistory gets token usage history
	GetTokenHistory(ctx context.Context, tenantID, userID string,
		startTime, endTime time.Time) ([]*TokenTracking, error)
}

// TokenTracking represents token tracking information
type TokenTracking struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	TenantID     string    `json:"tenant_id" gorm:"index"`
	UserID       string    `json:"user_id" gorm:"index"`
	Provider     string    `json:"provider"`
	Model        string    `json:"model"`
	PromptTokens int       `json:"prompt_tokens"`
	OutputTokens int       `json:"output_tokens"`
	TotalTokens  int       `json:"total_tokens"`
	Timestamp    time.Time `json:"timestamp" gorm:"index"`
	RequestID    string    `json:"request_id" gorm:"index"`
	Metadata     string    `json:"metadata" gorm:"type:text"`
}

// TokenUsage represents token usage statistics
type TokenUsage struct {
	TenantID                string    `json:"tenant_id"`
	UserID                  string    `json:"user_id"`
	Period                  string    `json:"period"`
	TotalTokens             int       `json:"total_tokens"`
	PromptTokens            int       `json:"prompt_tokens"`
	OutputTokens            int       `json:"output_tokens"`
	AverageTokensPerRequest float64   `json:"average_tokens_per_request"`
	RequestCount            int       `json:"request_count"`
	PeakUsageTime           time.Time `json:"peak_usage_time"`
}
