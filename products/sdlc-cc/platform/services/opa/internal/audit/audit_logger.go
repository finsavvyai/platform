package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

// AuditLogger provides comprehensive audit logging for OPA operations
type AuditLogger struct {
	logger      *logrus.Logger
	redis       *redis.Client
	config      AuditConfig
	buffer      []AuditEvent
	bufferMutex sync.Mutex
	flushTicker *time.Ticker
}

// AuditConfig holds configuration for audit logging
type AuditConfig struct {
	Enabled           bool          `json:"enabled"`
	BufferSize        int           `json:"buffer_size"`
	FlushInterval     time.Duration `json:"flush_interval"`
	RetentionPeriod   time.Duration `json:"retention_period"`
	StorageBackend    string        `json:"storage_backend"` // redis, database, file
	LogLevel          string        `json:"log_level"`
	IncludeDetails    bool          `json:"include_details"`
	IncludeStackTrace bool          `json:"include_stack_trace"`
	CompressLogs      bool          `json:"compress_logs"`
}

// AuditEvent represents an audit event
type AuditEvent struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	EventType     string                 `json:"event_type"`
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	SessionID     string                 `json:"session_id"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Decision      *PolicyDecision        `json:"decision,omitempty"`
	InputData     map[string]interface{} `json:"input_data,omitempty"`
	OutputData    map[string]interface{} `json:"output_data,omitempty"`
	Error         string                 `json:"error,omitempty"`
	Duration      time.Duration          `json:"duration_ms"`
	Success       bool                   `json:"success"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	StackTrace    string                 `json:"stack_trace,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
}

// PolicyDecision represents a policy decision for audit purposes
type PolicyDecision struct {
	PolicyID   string        `json:"policy_id"`
	PolicyName string        `json:"policy_name"`
	PolicyType string        `json:"policy_type"`
	Decision   bool          `json:"decision"`
	Reason     string        `json:"reason"`
	ExecTime   time.Duration `json:"execution_time_ms"`
	CacheHit   bool          `json:"cache_hit"`
	RuleHits   []string      `json:"rule_hits,omitempty"`
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(redisClient *redis.Client, config AuditConfig, logger *logrus.Logger) *AuditLogger {
	if logger == nil {
		logger = logrus.New()
	}

	auditLogger := &AuditLogger{
		logger:      logger,
		redis:       redisClient,
		config:      config,
		buffer:      make([]AuditEvent, 0, config.BufferSize),
		flushTicker: time.NewTicker(config.FlushInterval),
	}

	// Start background flush routine
	if config.Enabled {
		go auditLogger.startFlushRoutine()
	}

	return auditLogger
}

// LogPolicyEvaluation logs a policy evaluation event
func (al *AuditLogger) LogPolicyEvaluation(ctx context.Context, event *PolicyEvaluationEvent) error {
	if !al.config.Enabled {
		return nil
	}

	auditEvent := AuditEvent{
		ID:            generateEventID(),
		Timestamp:     time.Now().UTC(),
		EventType:     "policy_evaluation",
		Action:        event.Action,
		Resource:      event.Resource,
		ResourceID:    event.ResourceID,
		TenantID:      event.TenantID,
		UserID:        event.UserID,
		SessionID:     event.SessionID,
		IPAddress:     event.IPAddress,
		UserAgent:     event.UserAgent,
		Decision:      event.Decision,
		InputData:     event.InputData,
		OutputData:    event.OutputData,
		Duration:      event.Duration,
		Success:       event.Error == "",
		Metadata:      event.Metadata,
		CorrelationID: event.CorrelationID,
	}

	if !auditEvent.Success {
		auditEvent.Error = event.Error
		if al.config.IncludeStackTrace {
			auditEvent.StackTrace = getStackTrace()
		}
	}

	return al.logEvent(auditEvent)
}

// LogPolicyChange logs a policy change event
func (al *AuditLogger) LogPolicyChange(ctx context.Context, event *PolicyChangeEvent) error {
	if !al.config.Enabled {
		return nil
	}

	auditEvent := AuditEvent{
		ID:         generateEventID(),
		Timestamp:  time.Now().UTC(),
		EventType:  "policy_change",
		Action:     event.Action,
		Resource:   "policy",
		ResourceID: event.PolicyID,
		TenantID:   event.TenantID,
		UserID:     event.UserID,
		SessionID:  event.SessionID,
		IPAddress:  event.IPAddress,
		UserAgent:  event.UserAgent,
		Success:    event.Error == "",
		Metadata: map[string]interface{}{
			"policy_name": event.PolicyName,
			"policy_type": event.PolicyType,
			"old_version": event.OldVersion,
			"new_version": event.NewVersion,
			"changes":     event.Changes,
		},
		CorrelationID: event.CorrelationID,
	}

	if !auditEvent.Success {
		auditEvent.Error = event.Error
	}

	return al.logEvent(auditEvent)
}

// LogSecurityEvent logs a security-related event
func (al *AuditLogger) LogSecurityEvent(ctx context.Context, event *SecurityEvent) error {
	if !al.config.Enabled {
		return nil
	}

	auditEvent := AuditEvent{
		ID:         generateEventID(),
		Timestamp:  time.Now().UTC(),
		EventType:  "security_event",
		Action:     event.Action,
		Resource:   event.Resource,
		ResourceID: event.ResourceID,
		TenantID:   event.TenantID,
		UserID:     event.UserID,
		SessionID:  event.SessionID,
		IPAddress:  event.IPAddress,
		UserAgent:  event.UserAgent,
		Success:    false, // Security events are typically failures
		Metadata: map[string]interface{}{
			"severity":    event.Severity,
			"threat_type": event.ThreatType,
			"description": event.Description,
			"details":     event.Details,
		},
		CorrelationID: event.CorrelationID,
	}

	if event.Error != "" {
		auditEvent.Error = event.Error
	}

	return al.logEvent(auditEvent)
}

// Private methods

func (al *AuditLogger) logEvent(event AuditEvent) error {
	al.bufferMutex.Lock()
	defer al.bufferMutex.Unlock()

	// Remove sensitive data if configured
	if !al.config.IncludeDetails {
		event.InputData = nil
		event.OutputData = nil
	}

	al.buffer = append(al.buffer, event)

	// Flush if buffer is full
	if len(al.buffer) >= al.config.BufferSize {
		go al.Flush() // Flush asynchronously
	}

	return nil
}

func (al *AuditLogger) Flush() error {
	al.bufferMutex.Lock()
	defer al.bufferMutex.Unlock()

	if len(al.buffer) == 0 {
		return nil
	}

	ctx := context.Background()
	events := make([]AuditEvent, len(al.buffer))
	copy(events, al.buffer)

	// Clear buffer
	al.buffer = al.buffer[:0]

	// Store events
	for _, event := range events {
		if err := al.storeEvent(ctx, event); err != nil {
			al.logger.WithError(err).Error("Failed to store audit event")
		}
	}

	return nil
}

func (al *AuditLogger) storeEvent(ctx context.Context, event AuditEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal audit event: %w", err)
	}

	key := fmt.Sprintf("audit:%s:%s:%d", event.EventType, event.ID, event.Timestamp.Unix())

	// Store with retention period
	return al.redis.Set(ctx, key, data, al.config.RetentionPeriod).Err()
}

func (al *AuditLogger) startFlushRoutine() {
	for range al.flushTicker.C {
		if err := al.Flush(); err != nil {
			al.logger.WithError(err).Error("Failed to flush audit buffer")
		}
	}
}

// Event types

type PolicyEvaluationEvent struct {
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	SessionID     string                 `json:"session_id"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Decision      *PolicyDecision        `json:"decision"`
	InputData     map[string]interface{} `json:"input_data"`
	OutputData    map[string]interface{} `json:"output_data"`
	Duration      time.Duration          `json:"duration"`
	Error         string                 `json:"error,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
}

type PolicyChangeEvent struct {
	Action        string                 `json:"action"`
	PolicyID      string                 `json:"policy_id"`
	PolicyName    string                 `json:"policy_name"`
	PolicyType    string                 `json:"policy_type"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	SessionID     string                 `json:"session_id"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	OldVersion    int                    `json:"old_version"`
	NewVersion    int                    `json:"new_version"`
	Changes       map[string]interface{} `json:"changes"`
	Error         string                 `json:"error,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
}

type SecurityEvent struct {
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	SessionID     string                 `json:"session_id"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
	Severity      string                 `json:"severity"`
	ThreatType    string                 `json:"threat_type"`
	Description   string                 `json:"description"`
	Details       map[string]interface{} `json:"details"`
	Error         string                 `json:"error,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
}

// Utility functions

func generateEventID() string {
	return fmt.Sprintf("audit_%d_%s", time.Now().UnixNano(), generateRandomString(8))
}

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

func getStackTrace() string {
	return "stack_trace_placeholder"
}
