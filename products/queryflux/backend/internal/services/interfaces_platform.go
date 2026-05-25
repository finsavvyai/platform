package services

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
)

// SubscriptionService defines the interface for subscription business logic
type SubscriptionService interface {
	CreateCheckout(ctx context.Context, req *CreateCheckoutRequest) (*SubscriptionCheckoutResponse, error)
	GetUserSubscription(ctx context.Context, userID string) (*entities.Subscription, error)
	CancelSubscription(ctx context.Context, userID, reason string) error
	PauseSubscription(ctx context.Context, userID string, resumeAt time.Time) error
	ResumeSubscription(ctx context.Context, userID string) error
	ChangePlan(ctx context.Context, userID, variantID string) error
	GetUserUsageStats(ctx context.Context, userID string) (*UsageStats, error)
	CheckFeatureAccess(ctx context.Context, userID, feature string) (bool, error)
	GetUserInvoices(ctx context.Context, userID string) ([]*entities.Invoice, error)
	GetUserInvoice(ctx context.Context, userID, invoiceID string) (*entities.Invoice, error)
}

// DatabaseService defines the interface for database operations
type DatabaseService interface {
	Connect(ctx context.Context, connection *entities.Connection) error
	Disconnect(ctx context.Context, connectionID string) error
	ExecuteQuery(ctx context.Context, connectionID, sql string) ([]map[string]interface{}, error)
	GetSchema(ctx context.Context, connectionID string) (*DatabaseSchema, error)
	TestConnection(ctx context.Context, connection *entities.Connection) error
	GetConnectionInfo(ctx context.Context, connectionID string) (*ConnectionInfo, error)
	IsConnected(ctx context.Context, connectionID string) bool
}

// AIService defines the interface for AI-powered features
type AIService interface {
	ConvertNLToSQL(ctx context.Context, naturalLanguage string, schema *DatabaseSchema) (string, error)
	OptimizeQuery(ctx context.Context, sql string) (*QueryOptimization, error)
	ExplainQuery(ctx context.Context, sql string) (*QueryExplanation, error)
	GenerateQuery(ctx context.Context, requirements string, schema *DatabaseSchema) (string, error)
	AnalyzePerformance(ctx context.Context, sql string, executionPlan string) (*PerformanceAnalysis, error)
}
