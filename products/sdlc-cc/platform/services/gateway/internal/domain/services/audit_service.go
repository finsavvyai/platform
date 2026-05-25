package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	domainrepo "github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// AuditService defines the interface for audit logging
type AuditService interface {
	// LogAction logs a generic action
	LogAction(ctx context.Context, tenantID uuid.UUID, action string, details map[string]interface{}) error

	// LogPolicyChange logs policy changes
	LogPolicyChange(ctx context.Context, tenantID uuid.UUID, policyID uuid.UUID, action string, changedBy uuid.UUID) error

	// LogAuthentication logs authentication events
	LogAuthentication(ctx context.Context, event AuthEvent) error

	// LogAuthorization logs authorization events
	LogAuthorization(ctx context.Context, event AuthzEvent) error

	// LogDataAccess logs data access events
	LogDataAccess(ctx context.Context, event DataAccessEvent) error

	// LogAdminAction logs admin actions
	LogAdminAction(ctx context.Context, event AdminEvent) error

	// LogConfigurationChange logs configuration changes
	LogConfigurationChange(ctx context.Context, event ConfigurationChangeEvent) error

	// QueryLogs queries audit logs with filters
	QueryLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]*models.AuditLog, error)

	// GetAuditStats retrieves audit statistics
	GetAuditStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error)

	// ExportLogs exports audit logs
	ExportLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]byte, error)

	// CleanupOldLogs removes logs older than retention period
	CleanupOldLogs(ctx context.Context, tenantID uuid.UUID, retentionDays int) (int, error)
}

// AuthEvent represents an authentication event
type AuthEvent struct {
	TenantID          uuid.UUID `json:"tenant_id"`
	UserID            uuid.UUID `json:"user_id"`
	EventType         string    `json:"event_type"` // login, logout, failed_login, token_refresh, password_change
	Success           bool      `json:"success"`
	FailureReason     string    `json:"failure_reason,omitempty"`
	IPAddress         net.IP    `json:"ip_address"`
	UserAgent         string    `json:"user_agent"`
	SessionID         string    `json:"session_id,omitempty"`
	DeviceFingerprint string    `json:"device_fingerprint,omitempty"`
	LoginMethod       string    `json:"login_method,omitempty"` // password, sso, mfa
	MFAUsed           bool      `json:"mfa_used"`
	Timestamp         time.Time `json:"timestamp"`
}

// AuthzEvent represents an authorization event
type AuthzEvent struct {
	TenantID      uuid.UUID   `json:"tenant_id"`
	UserID        uuid.UUID   `json:"user_id"`
	ResourceType  string      `json:"resource_type"`
	ResourceID    uuid.UUID   `json:"resource_id,omitempty"`
	Action        string      `json:"action"`
	RequiredPerms []string    `json:"required_perms"`
	UserPerms     []string    `json:"user_perms"`
	Decision      string      `json:"decision"` // allow, deny
	DeniedReason  string      `json:"denied_reason,omitempty"`
	IPAddress     net.IP      `json:"ip_address"`
	UserAgent     string      `json:"user_agent"`
	RequestID     string      `json:"request_id,omitempty"`
	Timestamp     time.Time   `json:"timestamp"`
	PolicyIDs     []uuid.UUID `json:"policy_ids,omitempty"`
}

// DataAccessEvent represents a data access event
type DataAccessEvent struct {
	TenantID        uuid.UUID `json:"tenant_id"`
	UserID          uuid.UUID `json:"user_id"`
	ResourceType    string    `json:"resource_type"`
	ResourceID      uuid.UUID `json:"resource_id"`
	Operation       string    `json:"operation"`   // read, write, delete, export
	AccessType      string    `json:"access_type"` // direct, api, batch
	RecordCount     int       `json:"record_count,omitempty"`
	DataSensitivity string    `json:"data_sensitivity,omitempty"` // public, internal, confidential, restricted
	IPAddress       net.IP    `json:"ip_address"`
	UserAgent       string    `json:"user_agent"`
	RequestID       string    `json:"request_id,omitempty"`
	Timestamp       time.Time `json:"timestamp"`
	QuerySignature  string    `json:"query_signature,omitempty"` // hash of query for sensitive operations
}

// AdminEvent represents an administrative action
type AdminEvent struct {
	TenantID     uuid.UUID     `json:"tenant_id"`
	UserID       uuid.UUID     `json:"user_id"` // admin performing the action
	Action       string        `json:"action"`
	TargetType   string        `json:"target_type"` // user, tenant, api_key, policy
	TargetID     uuid.UUID     `json:"target_id"`
	TargetUserID *uuid.UUID    `json:"target_user_id,omitempty"`
	Changes      []FieldChange `json:"changes,omitempty"`
	Reason       string        `json:"reason,omitempty"`
	IPAddress    net.IP        `json:"ip_address"`
	UserAgent    string        `json:"user_agent"`
	RequestID    string        `json:"request_id,omitempty"`
	Timestamp    time.Time     `json:"timestamp"`
}

// ConfigurationChangeEvent represents a configuration change
type ConfigurationChangeEvent struct {
	TenantID   uuid.UUID     `json:"tenant_id"`
	UserID     uuid.UUID     `json:"user_id"`
	ConfigType string        `json:"config_type"` // rate_limit, retention, security, integration
	ConfigPath string        `json:"config_path"`
	OldValue   interface{}   `json:"old_value"`
	NewValue   interface{}   `json:"new_value"`
	Changes    []FieldChange `json:"changes,omitempty"`
	IPAddress  net.IP        `json:"ip_address"`
	UserAgent  string        `json:"user_agent"`
	Timestamp  time.Time     `json:"timestamp"`
}

// FieldChange represents a single field change
type FieldChange struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"old_value,omitempty"`
	NewValue interface{} `json:"new_value,omitempty"`
}

// auditService implements AuditService
type auditService struct {
	repo    domainrepo.AuditLogRepository
	logger  *logrus.Logger
	metrics AuditMetrics
	tracer  AuditTracer
}

// AuditMetrics defines the metrics interface for audit logging
type AuditMetrics interface {
	RecordAuditLog(action, result, tenantID string)
	RecordAuditQuery(tenantID string)
	RecordAuditExport(tenantID string)
	RecordAuthAttempt(tenantID, method string)
	RecordAuthSuccess(tenantID, method string, mfaUsed bool)
	RecordAuthFailure(tenantID, method, failureReason string)
	RecordAuthzCheck(tenantID, resourceType, action string)
	RecordAuthzGranted(tenantID, resourceType, action string)
	RecordAuthzDenied(tenantID, resourceType, action, denialReason string)
	RecordDataAccess(tenantID, resourceType, operation string)
	RecordSensitiveDataAccess(tenantID, resourceType, sensitivityLevel string)
	RecordAdminAction(tenantID, action, targetType, adminRole string)
	RecordPolicyChange(tenantID, policyType, changeType string)
	RecordConfigChange(tenantID, configType string)
}

// AuditTracer defines the tracing interface for audit logging
type AuditTracer interface {
	AddEvent(ctx context.Context, eventName string, attributes map[string]interface{})
	SetAttributes(ctx context.Context, attributes map[string]interface{})
}

// NewAuditService creates a new audit service
func NewAuditService(
	repo domainrepo.AuditLogRepository,
	logger *logrus.Logger,
	metrics AuditMetrics,
	tracer AuditTracer,
) AuditService {
	if logger == nil {
		logger = logrus.New()
	}

	return &auditService{
		repo:    repo,
		logger:  logger,
		metrics: metrics,
		tracer:  tracer,
	}
}

// LogAction logs a generic action
func (s *auditService) LogAction(ctx context.Context, tenantID uuid.UUID, action string, details map[string]interface{}) error {
	userID, _ := ctx.Value("user_id").(uuid.UUID)
	ipAddress, _ := ctx.Value("ip_address").(net.IP)
	userAgent, _ := ctx.Value("user_agent").(string)

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     tenantID,
		UserID:       &userID,
		Action:       action,
		ResourceType: "system",
		Details:      s.toJSONB(details),
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"action":    action,
		}).Error("Failed to create audit log")
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog(action, "success", tenantID.String())
	}

	if s.tracer != nil {
		s.tracer.AddEvent(ctx, "audit.log_action", map[string]interface{}{
			"tenant_id": tenantID.String(),
			"action":    action,
		})
	}

	s.logger.WithFields(logrus.Fields{
		"audit_id":  logEntry.ID,
		"tenant_id": tenantID,
		"action":    action,
	}).Debug("Audit log created")

	return nil
}

// LogPolicyChange logs policy changes
func (s *auditService) LogPolicyChange(ctx context.Context, tenantID uuid.UUID, policyID uuid.UUID, action string, changedBy uuid.UUID) error {
	details := map[string]interface{}{
		"policy_id":  policyID.String(),
		"action":     action,
		"changed_by": changedBy.String(),
	}

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     tenantID,
		UserID:       &changedBy,
		Action:       action,
		ResourceType: models.ResourceTypePolicy,
		ResourceID:   &policyID,
		Details:      s.toJSONB(details),
		IPAddress:    s.getClientIP(ctx),
		UserAgent:    s.getUserAgent(ctx),
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"policy_id": policyID,
			"action":    action,
		}).Error("Failed to create policy audit log")
		return fmt.Errorf("failed to create policy audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog(action, "success", tenantID.String())
	}

	return nil
}

// LogAuthentication logs authentication events
func (s *auditService) LogAuthentication(ctx context.Context, event AuthEvent) error {
	var action string
	switch event.EventType {
	case "login":
		if event.Success {
			action = models.ActionLogin
		} else {
			action = "user.login.failed"
		}
	case "logout":
		action = models.ActionLogout
	case "token_refresh":
		action = "user.token_refresh"
	case "password_change":
		action = "user.password_change"
	default:
		action = fmt.Sprintf("user.%s", event.EventType)
	}

	details := map[string]interface{}{
		"event_type":         event.EventType,
		"success":            event.Success,
		"login_method":       event.LoginMethod,
		"mfa_used":           event.MFAUsed,
		"session_id":         event.SessionID,
		"device_fingerprint": event.DeviceFingerprint,
	}

	if !event.Success && event.FailureReason != "" {
		details["failure_reason"] = event.FailureReason
	}

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     event.TenantID,
		UserID:       &event.UserID,
		Action:       action,
		ResourceType: models.ResourceTypeUser,
		ResourceID:   &event.UserID,
		Details:      s.toJSONB(details),
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		CreatedAt:    event.Timestamp,
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": event.TenantID,
			"user_id":   event.UserID,
			"event":     event.EventType,
		}).Error("Failed to create auth audit log")
		return fmt.Errorf("failed to create auth audit log: %w", err)
	}

	result := "success"
	if !event.Success {
		result = "failure"
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog(action, result, event.TenantID.String())
	}

	if s.tracer != nil {
		s.tracer.AddEvent(ctx, "audit.auth_event", map[string]interface{}{
			"tenant_id":  event.TenantID.String(),
			"user_id":    event.UserID.String(),
			"event_type": event.EventType,
			"success":    event.Success,
		})
	}

	// Log security-relevant failures
	if !event.Success {
		s.logger.WithFields(logrus.Fields{
			"tenant_id":      event.TenantID,
			"user_id":        event.UserID,
			"failure_reason": event.FailureReason,
			"ip_address":     event.IPAddress.String(),
			"user_agent":     event.UserAgent,
		}).Warn("Authentication failure logged")
	}

	return nil
}

// LogAuthorization logs authorization events
func (s *auditService) LogAuthorization(ctx context.Context, event AuthzEvent) error {
	details := map[string]interface{}{
		"decision":       event.Decision,
		"required_perms": event.RequiredPerms,
		"user_perms":     event.UserPerms,
		"request_id":     event.RequestID,
	}

	if len(event.PolicyIDs) > 0 {
		policyIDs := make([]string, len(event.PolicyIDs))
		for i, id := range event.PolicyIDs {
			policyIDs[i] = id.String()
		}
		details["policy_ids"] = policyIDs
	}

	if event.Decision == "deny" && event.DeniedReason != "" {
		details["denied_reason"] = event.DeniedReason
	}

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     event.TenantID,
		UserID:       &event.UserID,
		Action:       fmt.Sprintf("authz.%s.%s", event.Action, event.Decision),
		ResourceType: event.ResourceType,
		ResourceID:   &event.ResourceID,
		Details:      s.toJSONB(details),
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		CreatedAt:    event.Timestamp,
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":     event.TenantID,
			"user_id":       event.UserID,
			"resource_type": event.ResourceType,
			"action":        event.Action,
		}).Error("Failed to create authz audit log")
		return fmt.Errorf("failed to create authz audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog("authorization_check", event.Decision, event.TenantID.String())
	}

	// Log denied authorizations as warnings
	if event.Decision == "deny" {
		s.logger.WithFields(logrus.Fields{
			"tenant_id":     event.TenantID,
			"user_id":       event.UserID,
			"resource_type": event.ResourceType,
			"resource_id":   event.ResourceID,
			"action":        event.Action,
			"reason":        event.DeniedReason,
			"ip_address":    event.IPAddress.String(),
		}).Warn("Authorization denied")
	}

	return nil
}

// LogDataAccess logs data access events
func (s *auditService) LogDataAccess(ctx context.Context, event DataAccessEvent) error {
	details := map[string]interface{}{
		"operation":        event.Operation,
		"access_type":      event.AccessType,
		"record_count":     event.RecordCount,
		"data_sensitivity": event.DataSensitivity,
		"request_id":       event.RequestID,
	}

	if event.QuerySignature != "" {
		details["query_signature"] = event.QuerySignature
	}

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     event.TenantID,
		UserID:       &event.UserID,
		Action:       fmt.Sprintf("data.%s.%s", event.ResourceType, event.Operation),
		ResourceType: event.ResourceType,
		ResourceID:   &event.ResourceID,
		Details:      s.toJSONB(details),
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		CreatedAt:    event.Timestamp,
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":     event.TenantID,
			"user_id":       event.UserID,
			"resource_type": event.ResourceType,
			"operation":     event.Operation,
		}).Error("Failed to create data access audit log")
		return fmt.Errorf("failed to create data access audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog("data_access", event.Operation, event.TenantID.String())
	}

	// Log sensitive data access
	if event.DataSensitivity == "confidential" || event.DataSensitivity == "restricted" {
		s.logger.WithFields(logrus.Fields{
			"tenant_id":        event.TenantID,
			"user_id":          event.UserID,
			"resource_type":    event.ResourceType,
			"resource_id":      event.ResourceID,
			"operation":        event.Operation,
			"data_sensitivity": event.DataSensitivity,
			"ip_address":       event.IPAddress.String(),
		}).Info("Sensitive data access logged")
	}

	return nil
}

// LogAdminAction logs admin actions
func (s *auditService) LogAdminAction(ctx context.Context, event AdminEvent) error {
	details := map[string]interface{}{
		"action":      event.Action,
		"target_type": event.TargetType,
		"target_id":   event.TargetID.String(),
		"reason":      event.Reason,
		"request_id":  event.RequestID,
	}

	if event.TargetUserID != nil {
		details["target_user_id"] = event.TargetUserID.String()
	}

	if len(event.Changes) > 0 {
		details["changes"] = event.Changes
	}

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     event.TenantID,
		UserID:       &event.UserID,
		Action:       fmt.Sprintf("admin.%s.%s", event.TargetType, event.Action),
		ResourceType: event.TargetType,
		ResourceID:   &event.TargetID,
		Details:      s.toJSONB(details),
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		CreatedAt:    event.Timestamp,
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":   event.TenantID,
			"user_id":     event.UserID,
			"action":      event.Action,
			"target_type": event.TargetType,
		}).Error("Failed to create admin audit log")
		return fmt.Errorf("failed to create admin audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog("admin_action", event.Action, event.TenantID.String())
	}

	s.logger.WithFields(logrus.Fields{
		"tenant_id":   event.TenantID,
		"user_id":     event.UserID,
		"action":      event.Action,
		"target_type": event.TargetType,
		"target_id":   event.TargetID,
	}).Info("Admin action logged")

	return nil
}

// LogConfigurationChange logs configuration changes
func (s *auditService) LogConfigurationChange(ctx context.Context, event ConfigurationChangeEvent) error {
	details := map[string]interface{}{
		"config_type": event.ConfigType,
		"config_path": event.ConfigPath,
		"old_value":   event.OldValue,
		"new_value":   event.NewValue,
	}

	if len(event.Changes) > 0 {
		details["changes"] = event.Changes
	}

	// Create tamper-evident hash of the change
	changeHash := s.createChangeHash(event.ConfigPath, event.OldValue, event.NewValue)
	details["change_hash"] = changeHash

	logEntry := &models.AuditLog{
		ID:           uuid.New(),
		TenantID:     event.TenantID,
		UserID:       &event.UserID,
		Action:       fmt.Sprintf("config.%s.change", event.ConfigType),
		ResourceType: "configuration",
		Details:      s.toJSONB(details),
		IPAddress:    event.IPAddress,
		UserAgent:    event.UserAgent,
		CreatedAt:    event.Timestamp,
	}

	if err := s.repo.Create(ctx, logEntry); err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":   event.TenantID,
			"user_id":     event.UserID,
			"config_type": event.ConfigType,
			"config_path": event.ConfigPath,
		}).Error("Failed to create config audit log")
		return fmt.Errorf("failed to create config audit log: %w", err)
	}

	if s.metrics != nil {
		s.metrics.RecordAuditLog("config_change", event.ConfigType, event.TenantID.String())
	}

	s.logger.WithFields(logrus.Fields{
		"tenant_id":   event.TenantID,
		"user_id":     event.UserID,
		"config_type": event.ConfigType,
		"config_path": event.ConfigPath,
		"change_hash": changeHash,
	}).Info("Configuration change logged")

	return nil
}

// QueryLogs queries audit logs with filters
func (s *auditService) QueryLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]*models.AuditLog, error) {
	if s.metrics != nil {
		s.metrics.RecordAuditQuery(tenantID.String())
	}

	logs, err := s.repo.GetByTenant(ctx, tenantID, filter)
	if err != nil {
		s.logger.WithError(err).WithField("tenant_id", tenantID).Error("Failed to query audit logs")
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}

	return logs, nil
}

// GetAuditStats retrieves audit statistics
func (s *auditService) GetAuditStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error) {
	stats, err := s.repo.GetAuditStats(ctx, tenantID, timeRange)
	if err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":  tenantID,
			"time_range": timeRange,
		}).Error("Failed to get audit stats")
		return nil, fmt.Errorf("failed to get audit stats: %w", err)
	}

	return stats, nil
}

// ExportLogs exports audit logs
func (s *auditService) ExportLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]byte, error) {
	if s.metrics != nil {
		s.metrics.RecordAuditExport(tenantID.String())
	}

	data, err := s.repo.ExportAuditLogs(ctx, tenantID, filter)
	if err != nil {
		s.logger.WithError(err).WithField("tenant_id", tenantID).Error("Failed to export audit logs")
		return nil, fmt.Errorf("failed to export audit logs: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"export_size": len(data),
	}).Info("Audit logs exported")

	return data, nil
}

// CleanupOldLogs removes logs older than retention period
func (s *auditService) CleanupOldLogs(ctx context.Context, tenantID uuid.UUID, retentionDays int) (int, error) {
	count, err := s.repo.CleanupOldLogs(ctx, retentionDays)
	if err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id":      tenantID,
			"retention_days": retentionDays,
		}).Error("Failed to cleanup old audit logs")
		return 0, fmt.Errorf("failed to cleanup old audit logs: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"tenant_id":      tenantID,
		"retention_days": retentionDays,
		"deleted_count":  count,
	}).Info("Old audit logs cleaned up")

	return count, nil
}

// Helper methods

func (s *auditService) toJSONB(data map[string]interface{}) models.JSONB {
	if data == nil {
		return models.JSONB{}
	}

	return models.JSONB(data)
}

func (s *auditService) getClientIP(ctx context.Context) net.IP {
	if ip, ok := ctx.Value("ip_address").(net.IP); ok {
		return ip
	}
	return nil
}

func (s *auditService) getUserAgent(ctx context.Context) string {
	if ua, ok := ctx.Value("user_agent").(string); ok {
		return ua
	}
	return ""
}

func (s *auditService) createChangeHash(configPath string, oldValue, newValue interface{}) string {
	data := fmt.Sprintf("%s:%v:%v:%d", configPath, oldValue, newValue, time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// NullAuditMetrics provides a no-op implementation of AuditMetrics
type NullAuditMetrics struct{}

func (m *NullAuditMetrics) RecordAuditLog(action, result, tenantID string)                        {}
func (m *NullAuditMetrics) RecordAuditQuery(tenantID string)                                      {}
func (m *NullAuditMetrics) RecordAuditExport(tenantID string)                                     {}
func (m *NullAuditMetrics) RecordAuthAttempt(tenantID, method string)                             {}
func (m *NullAuditMetrics) RecordAuthSuccess(tenantID, method string, mfaUsed bool)               {}
func (m *NullAuditMetrics) RecordAuthFailure(tenantID, method, failureReason string)              {}
func (m *NullAuditMetrics) RecordAuthzCheck(tenantID, resourceType, action string)                {}
func (m *NullAuditMetrics) RecordAuthzGranted(tenantID, resourceType, action string)              {}
func (m *NullAuditMetrics) RecordAuthzDenied(tenantID, resourceType, action, denialReason string) {}
func (m *NullAuditMetrics) RecordDataAccess(tenantID, resourceType, operation string)             {}
func (m *NullAuditMetrics) RecordSensitiveDataAccess(tenantID, resourceType, sensitivityLevel string) {
}
func (m *NullAuditMetrics) RecordAdminAction(tenantID, action, targetType, adminRole string) {}
func (m *NullAuditMetrics) RecordPolicyChange(tenantID, policyType, changeType string)       {}
func (m *NullAuditMetrics) RecordConfigChange(tenantID, configType string)                   {}

// NullAuditTracer provides a no-op implementation of AuditTracer
type NullAuditTracer struct{}

func (t *NullAuditTracer) AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
}
func (t *NullAuditTracer) SetAttributes(ctx context.Context, attributes map[string]interface{}) {}

// StandardAuditMetrics implements AuditMetrics using Prometheus
type StandardAuditMetrics struct {
	metrics AuditMetrics
}

func NewStandardAuditMetrics(metrics AuditMetrics) AuditMetrics {
	return &StandardAuditMetrics{metrics: metrics}
}

func (m *StandardAuditMetrics) RecordAuditLog(action, result, tenantID string) {
	if m.metrics != nil {
		m.metrics.RecordAuditLog(action, result, tenantID)
	}
}

func (m *StandardAuditMetrics) RecordAuditQuery(tenantID string) {
	if m.metrics != nil {
		m.metrics.RecordAuditQuery(tenantID)
	}
}

func (m *StandardAuditMetrics) RecordAuditExport(tenantID string) {
	if m.metrics != nil {
		m.metrics.RecordAuditExport(tenantID)
	}
}

func (m *StandardAuditMetrics) RecordAuthAttempt(tenantID, method string) {
	if m.metrics != nil {
		m.metrics.RecordAuthAttempt(tenantID, method)
	}
}

func (m *StandardAuditMetrics) RecordAuthSuccess(tenantID, method string, mfaUsed bool) {
	if m.metrics != nil {
		m.metrics.RecordAuthSuccess(tenantID, method, mfaUsed)
	}
}

func (m *StandardAuditMetrics) RecordAuthFailure(tenantID, method, failureReason string) {
	if m.metrics != nil {
		m.metrics.RecordAuthFailure(tenantID, method, failureReason)
	}
}

func (m *StandardAuditMetrics) RecordAuthzCheck(tenantID, resourceType, action string) {
	if m.metrics != nil {
		m.metrics.RecordAuthzCheck(tenantID, resourceType, action)
	}
}

func (m *StandardAuditMetrics) RecordAuthzGranted(tenantID, resourceType, action string) {
	if m.metrics != nil {
		m.metrics.RecordAuthzGranted(tenantID, resourceType, action)
	}
}

func (m *StandardAuditMetrics) RecordAuthzDenied(tenantID, resourceType, action, denialReason string) {
	if m.metrics != nil {
		m.metrics.RecordAuthzDenied(tenantID, resourceType, action, denialReason)
	}
}

func (m *StandardAuditMetrics) RecordDataAccess(tenantID, resourceType, operation string) {
	if m.metrics != nil {
		m.metrics.RecordDataAccess(tenantID, resourceType, operation)
	}
}

func (m *StandardAuditMetrics) RecordSensitiveDataAccess(tenantID, resourceType, sensitivityLevel string) {
	if m.metrics != nil {
		m.metrics.RecordSensitiveDataAccess(tenantID, resourceType, sensitivityLevel)
	}
}

func (m *StandardAuditMetrics) RecordAdminAction(tenantID, action, targetType, adminRole string) {
	if m.metrics != nil {
		m.metrics.RecordAdminAction(tenantID, action, targetType, adminRole)
	}
}

func (m *StandardAuditMetrics) RecordPolicyChange(tenantID, policyType, changeType string) {
	if m.metrics != nil {
		m.metrics.RecordPolicyChange(tenantID, policyType, changeType)
	}
}

func (m *StandardAuditMetrics) RecordConfigChange(tenantID, configType string) {
	if m.metrics != nil {
		m.metrics.RecordConfigChange(tenantID, configType)
	}
}

// StandardAuditTracer implements AuditTracer using OpenTelemetry
type StandardAuditTracer struct {
	tracer AuditTracer
}

func NewStandardAuditTracer(tracer AuditTracer) AuditTracer {
	return &StandardAuditTracer{tracer: tracer}
}

func (t *StandardAuditTracer) AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
	if t.tracer != nil {
		t.tracer.AddEvent(ctx, eventName, attributes)
	}
}

func (t *StandardAuditTracer) SetAttributes(ctx context.Context, attributes map[string]interface{}) {
	if t.tracer != nil {
		t.tracer.SetAttributes(ctx, attributes)
	}
}
