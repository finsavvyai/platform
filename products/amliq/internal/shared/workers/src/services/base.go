package services

import (
	"context"
	"fmt"
	"time"

	"github.com/cloudflare/cloudflare-go"
	"github.com/sirupsen/logrus"
)

// Env represents the Cloudflare Workers environment
type Env struct {
	DB_PRIMARY       *cloudflare.D1Database `cf:"d1_database"`
	DB_SECONDARY     *cloudflare.D1Database `cf:"d1_database"`
	DB_COMPLIANCE    *cloudflare.D1Database `cf:"d1_database"`
	R2_STORAGE       *cloudflare.R2Bucket   `cf:"r2_bucket"`
	KV_CACHE         any                    `cf:"kv_namespace"`
	QUEUE_BILLING    *cloudflare.Queue      `cf:"queue"`
	QUEUE_RISK       *cloudflare.Queue      `cf:"queue"`
	QUEUE_COMPLIANCE *cloudflare.Queue      `cf:"queue"`
	VECTORIZE_RAG    any                    `cf:"vectorize_index"`
}

// Service represents a base service interface
type Service interface {
	Name() string
	Initialize(ctx context.Context, env *Env) error
	Health(ctx context.Context) error
	Close() error
}

// BaseService provides common functionality for all services
type BaseService struct {
	name   string
	env    *Env
	logger *logrus.Logger
}

// NewBaseService creates a new base service
func NewBaseService(name string) *BaseService {
	logger := logrus.New()
	logger.WithField("service", name)

	return &BaseService{
		name:   name,
		logger: logger,
	}
}

// Name returns the service name
func (s *BaseService) Name() string {
	return s.name
}

// Initialize sets up the service with environment dependencies
func (s *BaseService) Initialize(ctx context.Context, env *Env) error {
	s.env = env
	s.logger.WithField("service", s.name).Info("Service initialized")
	return nil
}

// Health performs a basic health check
func (s *BaseService) Health(ctx context.Context) error {
	if s.env == nil {
		return fmt.Errorf("service %s: environment not initialized", s.name)
	}
	return nil
}

// Close performs cleanup operations
func (s *BaseService) Close() error {
	s.logger.WithField("service", s.name).Info("Service closed")
	return nil
}

// GetLogger returns the service logger
func (s *BaseService) GetLogger() *logrus.Logger {
	return s.logger
}

// GetEnv returns the environment
func (s *BaseService) GetEnv() *Env {
	return s.env
}

// ContextWithTimeout creates a context with timeout for database operations
func (s *BaseService) ContextWithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// LogOperation logs an operation with context
func (s *BaseService) LogOperation(operation string, fields logrus.Fields) {
	if fields == nil {
		fields = logrus.Fields{}
	}
	fields["service"] = s.name
	fields["operation"] = operation
	fields["timestamp"] = time.Now().UTC()
	s.logger.WithFields(fields).Info("Operation performed")
}

// LogError logs an error with context
func (s *BaseService) LogError(operation string, err error, fields logrus.Fields) {
	if fields == nil {
		fields = logrus.Fields{}
	}
	fields["service"] = s.name
	fields["operation"] = operation
	fields["error"] = err.Error()
	fields["timestamp"] = time.Now().UTC()
	s.logger.WithFields(fields).Error("Operation failed")
}

// DatabaseOperation represents a generic database operation
type DatabaseOperation interface {
	Execute(ctx context.Context, db *cloudflare.D1Database) error
}

// ExecuteWithRetry executes a database operation with retry logic
func (s *BaseService) ExecuteWithRetry(ctx context.Context, op DatabaseOperation, maxRetries int) error {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			s.logger.WithFields(logrus.Fields{
				"attempt":    i + 1,
				"maxRetries": maxRetries,
				"lastError":  lastErr.Error(),
			}).Warn("Retrying database operation")

			// Exponential backoff
			backoff := time.Duration(i*i) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		if s.env != nil {
			lastErr = op.Execute(ctx, s.env.DB_PRIMARY)
			if lastErr == nil {
				return nil
			}
		} else {
			return fmt.Errorf("service %s: environment not initialized", s.name)
		}
	}

	return fmt.Errorf("operation failed after %d attempts: %w", maxRetries, lastErr)
}

// PaginationParams represents common pagination parameters
type PaginationParams struct {
	Page     int    `json:"page" form:"page" schema:"page"`
	Limit    int    `json:"limit" form:"limit" schema:"limit"`
	OrderBy  string `json:"order_by" form:"order_by" schema:"order_by"`
	OrderDir string `json:"order_dir" form:"order_dir" schema:"order_dir"`
}

// DefaultPagination returns default pagination parameters
func DefaultPagination() PaginationParams {
	return PaginationParams{
		Page:     1,
		Limit:    50,
		OrderBy:  "created_at",
		OrderDir: "DESC",
	}
}

// ValidatePagination validates and normalizes pagination parameters
func (p *PaginationParams) Validate() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 || p.Limit > 1000 {
		p.Limit = 50
	}
	if p.OrderDir != "ASC" && p.OrderDir != "DESC" {
		p.OrderDir = "DESC"
	}
	if p.OrderBy == "" {
		p.OrderBy = "created_at"
	}
}

// GetOffset calculates the offset for database queries
func (p *PaginationParams) GetOffset() int {
	return (p.Page - 1) * p.Limit
}

// PaginatedResult represents a paginated response
type PaginatedResult struct {
	Data       interface{} `json:"data"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	Total      int64       `json:"total"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
}

// NewPaginatedResult creates a new paginated result
func NewPaginatedResult(data interface{}, page, limit int, total int64) *PaginatedResult {
	totalPages := int((total + int64(limit) - 1) / int64(limit))
	return &PaginatedResult{
		Data:       data,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}
