//go:build ignore

package policy

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// DecisionLogger handles logging of policy decisions for audit purposes
type DecisionLogger struct {
	repo          repositories.PolicyEvaluationRepository
	logger        *logrus.Logger
	buffer        []*models.PolicyEvaluation
	bufferMu      sync.Mutex
	bufferSize    int
	flushTick     *time.Ticker
	flushDone     chan struct{}
	batchSize     int
	flushInterval time.Duration
	tracerName    string
}

// DecisionLoggerConfig holds configuration for the decision logger
type DecisionLoggerConfig struct {
	BufferSize    int           `json:"buffer_size"`
	BatchSize     int           `json:"batch_size"`
	FlushInterval time.Duration `json:"flush_interval"`
	AsyncLogging  bool          `json:"async_logging"`
	RetentionDays int           `json:"retention_days"`
	EnableTracing bool          `json:"enable_tracing"`
}

// DefaultDecisionLoggerConfig returns default configuration
func DefaultDecisionLoggerConfig() DecisionLoggerConfig {
	return DecisionLoggerConfig{
		BufferSize:    1000,
		BatchSize:     100,
		FlushInterval: 5 * time.Second,
		AsyncLogging:  true,
		RetentionDays: 90,
		EnableTracing: true,
	}
}

// NewDecisionLogger creates a new policy decision logger
func NewDecisionLogger(
	repo repositories.PolicyEvaluationRepository,
	logger *logrus.Logger,
	config DecisionLoggerConfig,
) *DecisionLogger {
	if logger == nil {
		logger = logrus.New()
	}

	if config.BufferSize <= 0 {
		config.BufferSize = 1000
	}
	if config.BatchSize <= 0 {
		config.BatchSize = 100
	}
	if config.FlushInterval <= 0 {
		config.FlushInterval = 5 * time.Second
	}

	dl := &DecisionLogger{
		repo:          repo,
		logger:        logger,
		buffer:        make([]*models.PolicyEvaluation, 0, config.BufferSize),
		bufferSize:    config.BufferSize,
		batchSize:     config.BatchSize,
		flushInterval: config.FlushInterval,
		tracerName:    "policy-decision-logger",
	}

	// Start background flusher if async logging is enabled
	if config.AsyncLogging {
		dl.flushTick = time.NewTicker(config.FlushInterval)
		dl.flushDone = make(chan struct{})
		go dl.backgroundFlush()
	}

	return dl
}

// LogDecision logs a single policy decision
func (dl *DecisionLogger) LogDecision(ctx context.Context, decision *DecisionLog) error {
	if decision == nil {
		return fmt.Errorf("decision cannot be nil")
	}

	ctx, span := otel.Tracer(dl.tracerName).Start(ctx, "LogDecision")
	defer span.End()

	// Convert to domain model
	eval := dl.convertToModel(decision)

	// Try to buffer first
	if dl.tryBuffer(eval) {
		return nil
	}

	// Buffer is full, flush and log directly
	if err := dl.flushBuffer(ctx); err != nil {
		dl.logger.WithError(err).Error("Failed to flush buffer")
	}

	// Log directly
	if err := dl.repo.Create(ctx, eval); err != nil {
		dl.logger.WithFields(logrus.Fields{
			"decision_id": eval.ID,
			"tenant_id":   eval.TenantID,
			"user_id":     eval.UserID,
			"request_id":  eval.RequestID,
		}).WithError(err).Error("Failed to log policy decision")
		return fmt.Errorf("failed to log decision: %w", err)
	}

	return nil
}

// LogBatch logs multiple policy decisions in a batch
func (dl *DecisionLogger) LogBatch(ctx context.Context, decisions []*DecisionLog) error {
	if len(decisions) == 0 {
		return nil
	}

	ctx, span := otel.Tracer(dl.tracerName).Start(ctx, "LogBatch")
	defer span.End()

	var failedDecisions []*DecisionLog
	var lastErr error

	for _, decision := range decisions {
		if err := dl.LogDecision(ctx, decision); err != nil {
			failedDecisions = append(failedDecisions, decision)
			lastErr = err
		}
	}

	if len(failedDecisions) > 0 {
		dl.logger.WithFields(logrus.Fields{
			"total":      len(decisions),
			"failed":     len(failedDecisions),
			"failed_ids": getDecisionIDs(failedDecisions),
		}).Warn("Some decisions failed to log")

		return lastErr
	}

	return nil
}

// QueryDecisions queries policy decisions based on filters
func (dl *DecisionLogger) QueryDecisions(ctx context.Context, filter DecisionFilter) ([]*models.PolicyEvaluation, error) {
	ctx, span := otel.Tracer(dl.tracerName).Start(ctx, "QueryDecisions")
	defer span.End()

	// Build filter based on input
	if filter.TenantID != nil {
		return dl.repo.GetByTenant(ctx, *filter.TenantID, filter.Limit, filter.Offset)
	}

	if filter.UserID != nil {
		return dl.repo.GetByUser(ctx, *filter.UserID, filter.Limit, filter.Offset)
	}

	if filter.PolicyID != nil {
		return dl.repo.GetByPolicy(ctx, *filter.PolicyID, filter.Limit, filter.Offset)
	}

	if filter.RequestID != nil {
		eval, err := dl.repo.GetByRequest(ctx, *filter.RequestID)
		if err != nil {
			return nil, err
		}
		return []*models.PolicyEvaluation{eval}, nil
	}

	return nil, fmt.Errorf("invalid filter: at least one filter field is required")
}

// GetDecisionStats returns statistics about policy decisions
func (dl *DecisionLogger) GetDecisionStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error) {
	return dl.repo.GetEvaluationStats(ctx, tenantID, timeRange)
}

// CleanupOldDecisions removes old decision logs based on retention policy
func (dl *DecisionLogger) CleanupOldDecisions(ctx context.Context, retentionDays int) (int, error) {
	dl.logger.WithField("retention_days", retentionDays).Info("Starting cleanup of old policy decisions")

	count, err := dl.repo.CleanupOldEvaluations(ctx, retentionDays)
	if err != nil {
		dl.logger.WithError(err).Error("Failed to cleanup old decisions")
		return 0, err
	}

	dl.logger.WithField("cleaned_count", count).Info("Completed cleanup of old policy decisions")
	return count, nil
}

// Flush flushes any buffered decisions to storage
func (dl *DecisionLogger) Flush(ctx context.Context) error {
	return dl.flushBuffer(ctx)
}

// Close gracefully closes the decision logger
func (dl *DecisionLogger) Close(ctx context.Context) error {
	// Stop background flusher
	if dl.flushTick != nil {
		dl.flushTick.Stop()
		close(dl.flushDone)
		<-dl.flushDone
	}

	// Flush remaining buffer
	if err := dl.Flush(ctx); err != nil {
		return err
	}

	dl.logger.Info("Decision logger closed")
	return nil
}

// tryBuffer attempts to add a decision to the buffer
func (dl *DecisionLogger) tryBuffer(eval *models.PolicyEvaluation) bool {
	dl.bufferMu.Lock()
	defer dl.bufferMu.Unlock()

	if len(dl.buffer) >= dl.bufferSize {
		return false
	}

	dl.buffer = append(dl.buffer, eval)

	// Auto-flush if we reach batch size
	if len(dl.buffer) >= dl.batchSize {
		go dl.asyncFlush()
	}

	return true
}

// flushBuffer flushes the buffer to storage
func (dl *DecisionLogger) flushBuffer(ctx context.Context) error {
	dl.bufferMu.Lock()
	if len(dl.buffer) == 0 {
		dl.bufferMu.Unlock()
		return nil
	}

	// Copy buffer and clear
	buffer := make([]*models.PolicyEvaluation, len(dl.buffer))
	copy(buffer, dl.buffer)
	dl.buffer = dl.buffer[:0]
	dl.bufferMu.Unlock()

	// Batch insert
	var lastErr error
	for _, eval := range buffer {
		if err := dl.repo.Create(ctx, eval); err != nil {
			dl.logger.WithFields(logrus.Fields{
				"decision_id": eval.ID,
				"tenant_id":   eval.TenantID,
			}).WithError(err).Error("Failed to log buffered decision")
			lastErr = err
		}
	}

	return lastErr
}

// backgroundFlush runs periodic flushing of the buffer
func (dl *DecisionLogger) backgroundFlush() {
	for {
		select {
		case <-dl.flushTick.C:
			ctx := context.Background()
			if err := dl.flushBuffer(ctx); err != nil {
				dl.logger.WithError(err).Error("Background flush failed")
			}
		case <-dl.flushDone:
			return
		}
	}
}

// asyncFlush runs flush in a separate goroutine
func (dl *DecisionLogger) asyncFlush() {
	ctx := context.Background()
	if err := dl.flushBuffer(ctx); err != nil {
		dl.logger.WithError(err).Error("Async flush failed")
	}
}

// convertToModel converts a DecisionLog to a PolicyEvaluation model
func (dl *DecisionLogger) convertToModel(decision *DecisionLog) *models.PolicyEvaluation {
	inputData := models.JSONB(decision.InputData)
	outputData := models.JSONB(decision.OutputData)

	var policyID *uuid.UUID
	if val, ok := decision.OutputData["policy_id"].(string); ok && val != "" {
		if pid, err := uuid.Parse(val); err == nil {
			policyID = &pid
		}
	}

	return models.NewPolicyEvaluation(
		decision.TenantID,
		decision.UserID,
		policyID,
		uuid.MustParse(decision.RequestID),
		decision.Decision == "allow",
		decision.Reason,
		inputData,
		outputData,
		decision.ExecutionTimeMs,
	)
}

// DecisionFilter represents filters for querying decisions
type DecisionFilter struct {
	TenantID  *uuid.UUID `json:"tenant_id,omitempty"`
	UserID    *uuid.UUID `json:"user_id,omitempty"`
	PolicyID  *uuid.UUID `json:"policy_id,omitempty"`
	RequestID *uuid.UUID `json:"request_id,omitempty"`
	StartTime *time.Time `json:"start_time,omitempty"`
	EndTime   *time.Time `json:"end_time,omitempty"`
	Decision  *string    `json:"decision,omitempty"`
	Limit     int        `json:"limit"`
	Offset    int        `json:"offset"`
}

// DecisionLog represents a policy decision log entry
type DecisionLog struct {
	ID              uuid.UUID              `json:"id"`
	TenantID        uuid.UUID              `json:"tenant_id"`
	UserID          uuid.UUID              `json:"user_id"`
	RequestID       string                 `json:"request_id"`
	Action          string                 `json:"action"`
	Resource        string                 `json:"resource"`
	Path            string                 `json:"path"`
	Method          string                 `json:"method"`
	Decision        string                 `json:"decision"`
	Reason          string                 `json:"reason,omitempty"`
	InputData       map[string]interface{} `json:"input_data,omitempty"`
	OutputData      map[string]interface{} `json:"output_data,omitempty"`
	ExecutionTimeMs int                    `json:"execution_time_ms"`
	CacheHit        bool                   `json:"cache_hit"`
	Timestamp       time.Time              `json:"timestamp"`
	IPAddress       string                 `json:"ip_address,omitempty"`
	UserAgent       string                 `json:"user_agent,omitempty"`
}

// getDecisionIDs extracts IDs from a slice of decisions for logging
func getDecisionIDs(decisions []*DecisionLog) []string {
	ids := make([]string, 0, len(decisions))
	for _, d := range decisions {
		ids = append(ids, d.ID.String())
	}
	return ids
}

// JSONB is a helper type for handling JSON data
type JSONB map[string]interface{}

// DecisionMetrics tracks decision-related metrics
type DecisionMetrics struct {
	TotalDecisions     int64     `json:"total_decisions"`
	AllowedDecisions   int64     `json:"allowed_decisions"`
	DeniedDecisions    int64     `json:"denied_decisions"`
	ErrorDecisions     int64     `json:"error_decisions"`
	AvgDecisionTime    float64   `json:"avg_decision_time_ms"`
	CacheHitRate       float64   `json:"cache_hit_rate"`
	TopDeniedResources []string  `json:"top_denied_resources"`
	TopActiveUsers     []string  `json:"top_active_users"`
	LastUpdated        time.Time `json:"last_updated"`
}

// AggregateMetrics aggregates metrics from decision logs
func AggregateMetrics(decisions []*models.PolicyEvaluation) DecisionMetrics {
	if len(decisions) == 0 {
		return DecisionMetrics{LastUpdated: time.Now()}
	}

	metrics := DecisionMetrics{
		TotalDecisions: int64(len(decisions)),
		LastUpdated:    time.Now(),
	}

	var totalTime int64
	var cacheHits int64

	resourceDenials := make(map[string]int64)
	userDecisions := make(map[string]int64)

	for _, d := range decisions {
		totalTime += int64(d.ExecutionTimeMs)

		if d.Decision {
			metrics.AllowedDecisions++
		} else {
			metrics.DeniedDecisions++
			// Track denied resources
			if inputData, ok := d.InputData["resource"].(string); ok {
				resourceDenials[inputData]++
			}
		}

		// Track user activity
		userDecisions[d.UserID.String()]++

		// Check cache hit from output data
		if outputData, ok := d.OutputData["cache_hit"].(bool); ok && outputData {
			cacheHits++
		}
	}

	if len(decisions) > 0 {
		metrics.AvgDecisionTime = float64(totalTime) / float64(len(decisions))
		metrics.CacheHitRate = float64(cacheHits) / float64(len(decisions)) * 100
	}

	// Top denied resources
	metrics.TopDeniedResources = topNItems(resourceDenials, 5)

	// Top active users
	metrics.TopActiveUsers = topNItems(userDecisions, 5)

	return metrics
}

// topNItems returns the top N items from a map
func topNItems(m map[string]int64, n int) []string {
	type kv struct {
		key   string
		value int64
	}

	var pairs []kv
	for k, v := range m {
		pairs = append(pairs, kv{k, v})
	}

	// Simple selection (not efficient for large maps, but fine for our use case)
	if len(pairs) < n {
		n = len(pairs)
	}

	result := make([]string, 0, n)
	for i := 0; i < n && len(pairs) > 0; i++ {
		maxIdx := 0
		for j := 1; j < len(pairs); j++ {
			if pairs[j].value > pairs[maxIdx].value {
				maxIdx = j
			}
		}
		result = append(result, pairs[maxIdx].key)
		pairs = append(pairs[:maxIdx], pairs[maxIdx+1:]...)
	}

	return result
}

// ExportDecisions exports decisions to JSON format
func ExportDecisions(decisions []*models.PolicyEvaluation) ([]byte, error) {
	return json.MarshalIndent(decisions, "", "  ")
}

// DecisionSummary provides a summary of a single decision
type DecisionSummary struct {
	ID         uuid.UUID `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	UserID     uuid.UUID `json:"user_id"`
	RequestID  uuid.UUID `json:"request_id"`
	Decision   string    `json:"decision"`
	Resource   string    `json:"resource"`
	Action     string    `json:"action"`
	ExecTimeMs int       `json:"exec_time_ms"`
	Timestamp  time.Time `json:"timestamp"`
}

// SummarizeDecision creates a summary from a full decision
func SummarizeDecision(d *models.PolicyEvaluation) DecisionSummary {
	decision := "deny"
	if d.Decision {
		decision = "allow"
	}

	var resource, action string
	if inputData, ok := d.InputData["resource"].(string); ok {
		resource = inputData
	}
	if inputData, ok := d.InputData["action"].(string); ok {
		action = inputData
	}

	return DecisionSummary{
		ID:         d.ID,
		TenantID:   d.TenantID,
		UserID:     d.UserID,
		RequestID:  d.RequestID,
		Decision:   decision,
		Resource:   resource,
		Action:     action,
		ExecTimeMs: d.ExecutionTimeMs,
		Timestamp:  d.CreatedAt,
	}
}
