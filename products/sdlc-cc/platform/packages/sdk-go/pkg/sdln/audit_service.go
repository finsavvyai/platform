package sdln

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// AuditService handles comprehensive audit logging and compliance tracking
type AuditService struct {
	*BaseService
	logStorage   AuditLogStorage
	hashChain    *HashChain
	classifier   *DataClassifier
	retentionMgr *RetentionManager
	consentMgr   *ConsentManager
}

// NewAuditService creates a new audit service
func NewAuditService(client *Client, storage AuditLogStorage) *AuditService {
	service := &AuditService{
		BaseService:  NewBaseService(client, "audit", "api/v1/audit"),
		logStorage:   storage,
		hashChain:    NewHashChain(),
		classifier:   NewDataClassifier(),
		retentionMgr: NewRetentionManager(storage),
		consentMgr:   NewConsentManager(),
	}

	return service
}

// AuditLog represents a single audit event
type AuditLog struct {
	ID                 string                 `json:"id"`
	Timestamp          Timestamp              `json:"timestamp"`
	EventID            string                 `json:"event_id"`
	EventType          string                 `json:"event_type"`
	EventCategory      string                 `json:"event_category"`
	UserID             string                 `json:"user_id,omitempty"`
	TenantID           string                 `json:"tenant_id"`
	SessionID          string                 `json:"session_id,omitempty"`
	IPAddress          string                 `json:"ip_address,omitempty"`
	UserAgent          string                 `json:"user_agent,omitempty"`
	Action             string                 `json:"action"`
	Resource           string                 `json:"resource,omitempty"`
	ResourceType       string                 `json:"resource_type,omitempty"`
	ResourceID         string                 `json:"resource_id,omitempty"`
	OldValue           interface{}            `json:"old_value,omitempty"`
	NewValue           interface{}            `json:"new_value,omitempty"`
	Description        string                 `json:"description"`
	Severity           string                 `json:"severity"` // low, medium, high, critical
	Source             string                 `json:"source"`
	Success            bool                   `json:"success"`
	ErrorCode          string                 `json:"error_code,omitempty"`
	ErrorMessage       string                 `json:"error_message,omitempty"`
	PreviousHash       string                 `json:"previous_hash"`
	CurrentHash        string                 `json:"current_hash"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
	ComplianceTags     []string               `json:"compliance_tags,omitempty"`
	DataClassification string                 `json:"data_classification,omitempty"`
	RetentionPeriod    int                    `json:"retention_period,omitempty"` // days
	CreatedAt          Timestamp              `json:"created_at"`
}

// AuditLogStorage interface for storing audit logs
type AuditLogStorage interface {
	Store(ctx context.Context, log *AuditLog) error
	StoreBatch(ctx context.Context, logs []*AuditLog) error
	Query(ctx context.Context, query *AuditQuery) (*AuditResult, error)
	GetByID(ctx context.Context, id string) (*AuditLog, error)
	DeleteByTenant(ctx context.Context, tenantID string, olderThan time.Time) error
	GetRetentionSchedule(ctx context.Context, tenantID string) ([]RetentionRule, error)
	VerifyIntegrity(ctx context.Context, fromID, toID string) (*IntegrityReport, error)
}

// AuditQuery represents a query for audit logs
type AuditQuery struct {
	TenantID        string                 `json:"tenant_id,omitempty"`
	UserIDs         []string               `json:"user_ids,omitempty"`
	EventTypes      []string               `json:"event_types,omitempty"`
	EventCategories []string               `json:"event_categories,omitempty"`
	ResourceTypes   []string               `json:"resource_types,omitempty"`
	Sources         []string               `json:"sources,omitempty"`
	Severities      []string               `json:"severities,omitempty"`
	StartTime       *Timestamp             `json:"start_time,omitempty"`
	EndTime         *Timestamp             `json:"end_time,omitempty"`
	SearchTerms     []string               `json:"search_terms,omitempty"`
	ComplianceTags  []string               `json:"compliance_tags,omitempty"`
	Success         *bool                  `json:"success,omitempty"`
	Limit           int                    `json:"limit,omitempty"`
	Offset          int                    `json:"offset,omitempty"`
	SortBy          string                 `json:"sort_by,omitempty"`    // timestamp, severity, event_type
	SortOrder       string                 `json:"sort_order,omitempty"` // asc, desc
	Filters         map[string]interface{} `json:"filters,omitempty"`
}

// AuditResult represents the result of an audit query
type AuditResult struct {
	Logs       []*AuditLog            `json:"logs"`
	TotalCount int64                  `json:"total_count"`
	HasMore    bool                   `json:"has_more"`
	NextToken  string                 `json:"next_token,omitempty"`
	QueryTime  time.Duration          `json:"query_time"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// HashChain provides immutable log storage with hash chaining
type HashChain struct {
	lastHash string
}

// NewHashChain creates a new hash chain
func NewHashChain() *HashChain {
	return &HashChain{
		lastHash: "",
	}
}

// AddToChain adds a log to the hash chain
func (hc *HashChain) AddToChain(log *AuditLog) error {
	// Create hash of log data
	logData, err := json.Marshal(log)
	if err != nil {
		return fmt.Errorf("failed to marshal log data: %w", err)
	}

	// Combine with previous hash
	hashInput := hc.lastHash + string(logData)
	hash := sha256.Sum256([]byte(hashInput))

	log.PreviousHash = hc.lastHash
	log.CurrentHash = hex.EncodeToString(hash[:])
	hc.lastHash = log.CurrentHash

	return nil
}

// LogEvent logs an audit event
func (s *AuditService) LogEvent(ctx context.Context, event *AuditEvent) error {
	log := &AuditLog{
		ID:                 generateID(),
		Timestamp:          NewTimestamp(time.Now().UTC()),
		EventID:            event.EventID,
		EventType:          event.EventType,
		EventCategory:      event.EventCategory,
		UserID:             event.UserID,
		TenantID:           event.TenantID,
		SessionID:          event.SessionID,
		IPAddress:          event.IPAddress,
		UserAgent:          event.UserAgent,
		Action:             event.Action,
		Resource:           event.Resource,
		ResourceType:       event.ResourceType,
		ResourceID:         event.ResourceID,
		OldValue:           event.OldValue,
		NewValue:           event.NewValue,
		Description:        event.Description,
		Severity:           event.Severity,
		Source:             event.Source,
		Success:            event.Success,
		ErrorCode:          event.ErrorCode,
		ErrorMessage:       event.ErrorMessage,
		Metadata:           event.Metadata,
		ComplianceTags:     event.ComplianceTags,
		DataClassification: event.DataClassification,
		RetentionPeriod:    event.RetentionPeriod,
		CreatedAt:          NewTimestamp(time.Now().UTC()),
	}

	// Classify data for compliance
	if log.DataClassification == "" {
		log.DataClassification = s.classifier.ClassifyEvent(event)
	}

	// Apply retention policy
	if log.RetentionPeriod == 0 {
		log.RetentionPeriod = s.retentionMgr.GetRetentionPeriod(log)
	}

	// Add to hash chain for immutability
	if err := s.hashChain.AddToChain(log); err != nil {
		return fmt.Errorf("failed to add to hash chain: %w", err)
	}

	// Store the log
	return s.logStorage.Store(ctx, log)
}

// AuditEvent represents an event to be logged
type AuditEvent struct {
	EventID            string                 `json:"event_id"`
	EventType          string                 `json:"event_type"`
	EventCategory      string                 `json:"event_category"`
	UserID             string                 `json:"user_id,omitempty"`
	TenantID           string                 `json:"tenant_id"`
	SessionID          string                 `json:"session_id,omitempty"`
	IPAddress          string                 `json:"ip_address,omitempty"`
	UserAgent          string                 `json:"user_agent,omitempty"`
	Action             string                 `json:"action"`
	Resource           string                 `json:"resource,omitempty"`
	ResourceType       string                 `json:"resource_type,omitempty"`
	ResourceID         string                 `json:"resource_id,omitempty"`
	OldValue           interface{}            `json:"old_value,omitempty"`
	NewValue           interface{}            `json:"new_value,omitempty"`
	Description        string                 `json:"description"`
	Severity           string                 `json:"severity"` // low, medium, high, critical
	Source             string                 `json:"source"`
	Success            bool                   `json:"success"`
	ErrorCode          string                 `json:"error_code,omitempty"`
	ErrorMessage       string                 `json:"error_message,omitempty"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
	ComplianceTags     []string               `json:"compliance_tags,omitempty"`
	DataClassification string                 `json:"data_classification,omitempty"`
	RetentionPeriod    int                    `json:"retention_period,omitempty"` // days
}

// QueryLogs queries audit logs based on criteria
func (s *AuditService) QueryLogs(ctx context.Context, query *AuditQuery) (*AuditResult, error) {
	startTime := time.Now()

	result, err := s.logStorage.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}

	result.QueryTime = time.Since(startTime)
	return result, nil
}

// VerifyLogIntegrity verifies the integrity of audit logs between two points
func (s *AuditService) VerifyLogIntegrity(ctx context.Context, fromID, toID string) (*IntegrityReport, error) {
	return s.logStorage.VerifyIntegrity(ctx, fromID, toID)
}

// GenerateComplianceReport generates a compliance report for the specified period
func (s *AuditService) GenerateComplianceReport(ctx context.Context, req *ComplianceReportRequest) (*ComplianceReport, error) {
	// Query logs for the period
	query := &AuditQuery{
		TenantID:       req.TenantID,
		StartTime:      req.StartTime,
		EndTime:        req.EndTime,
		ComplianceTags: req.ComplianceTags,
		Limit:          10000, // Large limit for comprehensive report
	}

	result, err := s.QueryLogs(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs for compliance report: %w", err)
	}

	// Generate report based on compliance type
	report := &ComplianceReport{
		ID:          generateID(),
		TenantID:    req.TenantID,
		Type:        req.Type,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		GeneratedAt: NewTimestamp(time.Now().UTC()),
		LogCount:    len(result.Logs),
	}

	return report, nil
}

// ComplianceReportRequest represents a request for compliance report
type ComplianceReportRequest struct {
	TenantID       string                 `json:"tenant_id"`
	Type           string                 `json:"type"` // gdpr, hipaa, sox, custom
	StartTime      *Timestamp             `json:"start_time"`
	EndTime        *Timestamp             `json:"end_time"`
	ComplianceTags []string               `json:"compliance_tags,omitempty"`
	Parameters     map[string]interface{} `json:"parameters,omitempty"`
	Format         string                 `json:"format"` // json, csv, pdf
}

// ComplianceReport represents a compliance report
type ComplianceReport struct {
	ID              string                 `json:"id"`
	TenantID        string                 `json:"tenant_id"`
	Type            string                 `json:"type"`
	StartTime       *Timestamp             `json:"start_time"`
	EndTime         *Timestamp             `json:"end_time"`
	GeneratedAt     Timestamp              `json:"generated_at"`
	LogCount        int                    `json:"log_count"`
	Summary         map[string]interface{} `json:"summary"`
	Violations      []ComplianceViolation  `json:"violations"`
	Recommendations []string               `json:"recommendations"`
	Data            map[string]interface{} `json:"data,omitempty"`
	ExportFormat    string                 `json:"export_format,omitempty"`
	ExportURL       string                 `json:"export_url,omitempty"`
}

// ComplianceViolation represents a compliance violation
type ComplianceViolation struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Description string                 `json:"description"`
	EventID     string                 `json:"event_id"`
	EventTime   Timestamp              `json:"event_time"`
	Remediation string                 `json:"remediation"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// IntegrityReport represents the result of log integrity verification
type IntegrityReport struct {
	FromLogID  string                 `json:"from_log_id"`
	ToLogID    string                 `json:"to_log_id"`
	Verified   bool                   `json:"verified"`
	LogCount   int                    `json:"log_count"`
	Violations []IntegrityViolation   `json:"violations"`
	VerifiedAt Timestamp              `json:"verified_at"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// IntegrityViolation represents an integrity violation
type IntegrityViolation struct {
	LogID     string                 `json:"log_id"`
	Violation string                 `json:"violation"`
	Expected  string                 `json:"expected"`
	Actual    string                 `json:"actual"`
	Timestamp Timestamp              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// LogBatch represents a batch of audit logs for bulk operations
type LogBatch struct {
	Logs      []*AuditLog `json:"logs"`
	BatchID   string      `json:"batch_id"`
	Timestamp Timestamp   `json:"timestamp"`
}

// LogBatch processes multiple audit logs in a single operation
func (s *AuditService) LogBatch(ctx context.Context, events []*AuditEvent) error {
	if len(events) == 0 {
		return nil
	}

	logs := make([]*AuditLog, len(events))
	for i, event := range events {
		log := &AuditLog{
			ID:                 generateID(),
			Timestamp:          NewTimestamp(time.Now().UTC()),
			EventID:            event.EventID,
			EventType:          event.EventType,
			EventCategory:      event.EventCategory,
			UserID:             event.UserID,
			TenantID:           event.TenantID,
			SessionID:          event.SessionID,
			IPAddress:          event.IPAddress,
			UserAgent:          event.UserAgent,
			Action:             event.Action,
			Resource:           event.Resource,
			ResourceType:       event.ResourceType,
			ResourceID:         event.ResourceID,
			OldValue:           event.OldValue,
			NewValue:           event.NewValue,
			Description:        event.Description,
			Severity:           event.Severity,
			Source:             event.Source,
			Success:            event.Success,
			ErrorCode:          event.ErrorCode,
			ErrorMessage:       event.ErrorMessage,
			Metadata:           event.Metadata,
			ComplianceTags:     event.ComplianceTags,
			DataClassification: s.classifier.ClassifyEvent(event),
			RetentionPeriod:    s.retentionMgr.GetRetentionPeriodFromEvent(event),
			CreatedAt:          NewTimestamp(time.Now().UTC()),
		}

		// Add to hash chain
		if err := s.hashChain.AddToChain(log); err != nil {
			return fmt.Errorf("failed to add log %d to hash chain: %w", i, err)
		}

		logs[i] = log
	}

	// Store batch
	return s.logStorage.StoreBatch(ctx, logs)
}

// PurgeLogs purges audit logs according to retention policies
func (s *AuditService) PurgeLogs(ctx context.Context, tenantID string) error {
	// Get retention schedule
	rules, err := s.logStorage.GetRetentionSchedule(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to get retention schedule: %w", err)
	}

	for _, rule := range rules {
		cutoff := time.Now().UTC().AddDate(0, 0, -rule.RetentionDays)
		if err := s.logStorage.DeleteByTenant(ctx, tenantID, cutoff); err != nil {
			return fmt.Errorf("failed to purge logs for rule %s: %w", rule.ID, err)
		}
	}

	return nil
}

// GetComplianceStatus returns current compliance status for a tenant
func (s *AuditService) GetComplianceStatus(ctx context.Context, tenantID string) (*ComplianceStatus, error) {
	// Query recent logs for compliance analysis
	query := &AuditQuery{
		TenantID:  tenantID,
		StartTime: func() *Timestamp { t := NewTimestamp(time.Now().UTC().AddDate(0, 0, -30)); return &t }(), // Last 30 days
		Limit:     5000,
	}

	result, err := s.QueryLogs(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs for compliance status: %w", err)
	}

	status := &ComplianceStatus{
		TenantID:   tenantID,
		AssessedAt: NewTimestamp(time.Now().UTC()),
		LogCount:   len(result.Logs),
		Violations: s.analyzeViolations(result.Logs),
		Score:      s.calculateComplianceScore(result.Logs),
	}

	return status, nil
}

// ComplianceStatus represents the current compliance status
type ComplianceStatus struct {
	TenantID        string                 `json:"tenant_id"`
	AssessedAt      Timestamp              `json:"assessed_at"`
	LogCount        int                    `json:"log_count"`
	Violations      []ComplianceViolation  `json:"violations"`
	Score           float64                `json:"score"` // 0.0-1.0
	Recommendations []string               `json:"recommendations"`
	LastVerified    *Timestamp             `json:"last_verified,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// Helper methods

func (s *AuditService) analyzeViolations(logs []*AuditLog) []ComplianceViolation {
	var violations []ComplianceViolation

	for _, log := range logs {
		// Analyze for common compliance violations
		if log.Severity == "critical" && !log.Success {
			violations = append(violations, ComplianceViolation{
				ID:          generateID(),
				Type:        "security_incident",
				Severity:    "high",
				Description: fmt.Sprintf("Critical security incident: %s", log.Description),
				EventID:     log.EventID,
				EventTime:   log.Timestamp,
				Remediation: "Investigate immediately and document findings",
			})
		}

		// Add more violation analysis logic here
	}

	return violations
}

func (s *AuditService) calculateComplianceScore(logs []*AuditLog) float64 {
	if len(logs) == 0 {
		return 1.0 // No violations if no logs
	}

	violationCount := len(s.analyzeViolations(logs))
	return float64(len(logs)-violationCount) / float64(len(logs))
}
