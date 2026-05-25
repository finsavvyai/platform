package sdln

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// RetentionManager manages data retention policies and lifecycle
type RetentionManager struct {
	storage   AuditLogStorage
	policies  map[string]*RetentionPolicy
	schedules map[string]*RetentionSchedule
}

// NewRetentionManager creates a new retention manager
func NewRetentionManager(storage AuditLogStorage) *RetentionManager {
	rm := &RetentionManager{
		storage:   storage,
		policies:  make(map[string]*RetentionPolicy),
		schedules: make(map[string]*RetentionSchedule),
	}

	rm.initializeDefaultPolicies()
	rm.initializeDefaultSchedules()

	return rm
}

// RetentionPolicy represents a data retention policy
type RetentionPolicy struct {
	ID                   string                `json:"id"`
	Name                 string                `json:"name"`
	Description          string                `json:"description"`
	DataTypes            []string              `json:"data_types"`
	Category             string                `json:"category"` // personal, financial, health, business, system
	RetentionDays        int                   `json:"retention_days"`
	RetentionType        string                `json:"retention_type"` // fixed, event_based, regulatory
	TriggerEvents        []string              `json:"trigger_events,omitempty"`
	Exceptions           []RetentionException  `json:"exceptions,omitempty"`
	LegalHolds           []LegalHold           `json:"legal_holds,omitempty"`
	AutoDelete           bool                  `json:"auto_delete"`
	NotificationSettings *NotificationSettings `json:"notification_settings,omitempty"`
	ComplianceTags       []string              `json:"compliance_tags"`
	Enabled              bool                  `json:"enabled"`
	Priority             int                   `json:"priority"`
	CreatedAt            Timestamp             `json:"created_at"`
	UpdatedAt            Timestamp             `json:"updated_at"`
	CreatedBy            string                `json:"created_by"`
	UpdatedBy            string                `json:"updated_by"`
}

// RetentionException represents an exception to a retention policy
type RetentionException struct {
	ID        string     `json:"id"`
	Type      string     `json:"type"` // manual, automatic, regulatory
	Reason    string     `json:"reason"`
	DataIDs   []string   `json:"data_ids,omitempty"`
	UserIDs   []string   `json:"user_ids,omitempty"`
	ExpiresAt *Timestamp `json:"expires_at,omitempty"`
	CreatedBy string     `json:"created_by"`
	CreatedAt Timestamp  `json:"created_at"`
}

// LegalHold represents a legal hold on data retention
type LegalHold struct {
	ID          string                 `json:"id"`
	CaseName    string                 `json:"case_name"`
	CaseNumber  string                 `json:"case_number"`
	Description string                 `json:"description"`
	DataTypes   []string               `json:"data_types"`
	DataIDs     []string               `json:"data_ids,omitempty"`
	UserIDs     []string               `json:"user_ids,omitempty"`
	StartDate   Timestamp              `json:"start_date"`
	EndDate     *Timestamp             `json:"end_date,omitempty"`
	Status      string                 `json:"status"` // active, released, expired
	CreatedBy   string                 `json:"created_by"`
	CreatedAt   Timestamp              `json:"created_at"`
	ReleasedAt  *Timestamp             `json:"released_at,omitempty"`
	ReleasedBy  string                 `json:"released_by,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NotificationSettings represents notification settings for retention actions
type NotificationSettings struct {
	Enabled    bool     `json:"enabled"`
	Channels   []string `json:"channels"` // email, slack, webhook
	Recipients []string `json:"recipients"`
	Template   string   `json:"template"`
	Frequency  string   `json:"frequency"`   // immediate, daily, weekly
	BeforeDays int      `json:"before_days"` // Notify before deletion
}

// RetentionSchedule represents a scheduled retention action
type RetentionSchedule struct {
	ID            string                 `json:"id"`
	PolicyID      string                 `json:"policy_id"`
	Name          string                 `json:"name"`
	ScheduleType  string                 `json:"schedule_type"`  // cron, interval, event_based
	ScheduleValue string                 `json:"schedule_value"` // cron expression, interval duration, event name
	Enabled       bool                   `json:"enabled"`
	LastRun       *Timestamp             `json:"last_run,omitempty"`
	NextRun       *Timestamp             `json:"next_run,omitempty"`
	RunCount      int64                  `json:"run_count"`
	FailureCount  int64                  `json:"failure_count"`
	LastFailure   *Timestamp             `json:"last_failure,omitempty"`
	MaxRetries    int                    `json:"max_reries"`
	CreatedAt     Timestamp              `json:"created_at"`
	CreatedBy     string                 `json:"created_by"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// RetentionExecution represents the execution of a retention action
type RetentionExecution struct {
	ID          string                 `json:"id"`
	ScheduleID  string                 `json:"schedule_id"`
	PolicyID    string                 `json:"policy_id"`
	Status      string                 `json:"status"` // pending, running, completed, failed, cancelled
	StartedAt   Timestamp              `json:"started_at"`
	CompletedAt *Timestamp             `json:"completed_at,omitempty"`
	Processed   int64                  `json:"processed"`
	Deleted     int64                  `json:"deleted"`
	Skipped     int64                  `json:"skipped"`
	Errors      []string               `json:"errors,omitempty"`
	Summary     string                 `json:"summary"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// initializeDefaultPolicies initializes built-in retention policies
func (rm *RetentionManager) initializeDefaultPolicies() {
	policies := []RetentionPolicy{
		{
			ID:             "policy_personal_data",
			Name:           "Personal Data Retention",
			Description:    "Retention policy for personal data per GDPR requirements",
			DataTypes:      []string{"email", "phone", "address", "personal_info"},
			Category:       "personal",
			RetentionDays:  2555, // 7 years
			RetentionType:  "fixed",
			AutoDelete:     true,
			ComplianceTags: []string{"gdpr", "ccpa"},
			Priority:       1,
		},
		{
			ID:             "policy_financial_data",
			Name:           "Financial Data Retention",
			Description:    "Retention policy for financial transactions and records",
			DataTypes:      []string{"transaction", "payment", "invoice", "account"},
			Category:       "financial",
			RetentionDays:  2555, // 7 years
			RetentionType:  "fixed",
			AutoDelete:     true,
			ComplianceTags: []string{"sox", "pci_dss"},
			Priority:       1,
		},
		{
			ID:             "policy_health_data",
			Name:           "Health Data Retention",
			Description:    "Retention policy for health information per HIPAA",
			DataTypes:      []string{"medical_record", "diagnosis", "treatment", "prescription"},
			Category:       "health",
			RetentionDays:  2920, // 8 years minimum
			RetentionType:  "fixed",
			AutoDelete:     true,
			ComplianceTags: []string{"hipaa", "hitech"},
			Priority:       1,
		},
		{
			ID:             "policy_audit_logs",
			Name:           "Audit Log Retention",
			Description:    "Retention policy for audit logs and system events",
			DataTypes:      []string{"audit_log", "system_event", "security_event"},
			Category:       "system",
			RetentionDays:  365, // 1 year
			RetentionType:  "fixed",
			AutoDelete:     true,
			ComplianceTags: []string{"sox", "iso27001"},
			Priority:       2,
		},
		{
			ID:             "policy_business_records",
			Name:           "Business Records Retention",
			Description:    "Retention policy for general business records",
			DataTypes:      []string{"contract", "agreement", "policy", "report"},
			Category:       "business",
			RetentionDays:  3650, // 10 years
			RetentionType:  "fixed",
			AutoDelete:     true,
			ComplianceTags: []string{"business_policy"},
			Priority:       3,
		},
	}

	for _, policy := range policies {
		policy.CreatedAt = NewTimestamp(time.Now().UTC())
		policy.UpdatedAt = NewTimestamp(time.Now().UTC())
		rm.policies[policy.ID] = &policy
	}
}

// initializeDefaultSchedules initializes default retention schedules
func (rm *RetentionManager) initializeDefaultSchedules() {
	schedules := []RetentionSchedule{
		{
			ID:            "schedule_daily_cleanup",
			PolicyID:      "policy_audit_logs",
			Name:          "Daily Log Cleanup",
			ScheduleType:  "cron",
			ScheduleValue: "0 2 * * *", // Daily at 2 AM
			Enabled:       true,
			MaxRetries:    3,
			NextRun:       func() *Timestamp { t := NewTimestamp(time.Now().UTC().AddDate(0, 0, 1)); return &t }(),
		},
		{
			ID:            "schedule_monthly_cleanup",
			PolicyID:      "policy_personal_data",
			Name:          "Monthly Personal Data Cleanup",
			ScheduleType:  "cron",
			ScheduleValue: "0 3 1 * *", // 1st of month at 3 AM
			Enabled:       true,
			MaxRetries:    3,
			NextRun:       func() *Timestamp { t := NewTimestamp(time.Now().UTC().AddDate(0, 1, 0)); return &t }(),
		},
		{
			ID:            "schedule_quarterly_cleanup",
			PolicyID:      "policy_financial_data",
			Name:          "Quarterly Financial Data Cleanup",
			ScheduleType:  "cron",
			ScheduleValue: "0 4 1 */3 *", // 1st day of quarter at 4 AM
			Enabled:       true,
			MaxRetries:    3,
			NextRun:       func() *Timestamp { t := NewTimestamp(time.Now().UTC().AddDate(3, 0, 0)); return &t }(),
		},
	}

	for _, schedule := range schedules {
		schedule.CreatedAt = NewTimestamp(time.Now().UTC())
		rm.schedules[schedule.ID] = &schedule
	}
}

// GetRetentionPeriod determines retention period for an audit log
func (rm *RetentionManager) GetRetentionPeriod(log *AuditLog) int {
	// Find applicable policy based on data classification and event type
	for _, policy := range rm.policies {
		if !policy.Enabled {
			continue
		}

		// Check if policy applies to this log
		if rm.policyApplies(policy, log) {
			return policy.RetentionDays
		}
	}

	// Default retention period
	return 365 // 1 year
}

// GetRetentionPeriodFromEvent determines retention period from an event
func (rm *RetentionManager) GetRetentionPeriodFromEvent(event *AuditEvent) int {
	// Create a temporary log for policy matching
	log := &AuditLog{
		EventType: event.EventType,
		Metadata:  event.Metadata,
	}

	return rm.GetRetentionPeriod(log)
}

// policyApplies checks if a retention policy applies to a log
func (rm *RetentionManager) policyApplies(policy *RetentionPolicy, log *AuditLog) bool {
	// Check category based on event type
	logCategory := rm.getCategoryFromEvent(log.EventType)
	if policy.Category != logCategory {
		return false
	}

	// Check data types
	if len(policy.DataTypes) > 0 {
		if !rm.matchesDataTypes(policy.DataTypes, log) {
			return false
		}
	}

	// Check for legal holds
	if rm.hasLegalHold(policy, log) {
		return false
	}

	return true
}

// getCategoryFromEvent determines category from event type
func (rm *RetentionManager) getCategoryFromEvent(eventType string) string {
	switch {
	case eventType == "user_login" || eventType == "user_logout" || eventType == "user_registration":
		return "personal"
	case eventType == "payment" || eventType == "transaction" || eventType == "billing":
		return "financial"
	case eventType == "medical_record" || eventType == "health_data":
		return "health"
	case eventType == "admin_action" || eventType == "system_config":
		return "business"
	default:
		return "system"
	}
}

// matchesDataTypes checks if log matches policy data types
func (rm *RetentionManager) matchesDataTypes(dataTypes []string, log *AuditLog) bool {
	for _, dataType := range dataTypes {
		if rm.logContainsDataType(log, dataType) {
			return true
		}
	}
	return false
}

// logContainsDataType checks if log contains specified data type
func (rm *RetentionManager) logContainsDataType(log *AuditLog, dataType string) bool {
	// Check in event type
	if strings.Contains(log.EventType, dataType) {
		return true
	}

	// Check in resource type
	if strings.Contains(log.ResourceType, dataType) {
		return true
	}

	// Check in metadata
	if log.Metadata != nil {
		if _, exists := log.Metadata[dataType]; exists {
			return true
		}
	}

	return false
}

// hasLegalHold checks if there's an active legal hold
func (rm *RetentionManager) hasLegalHold(policy *RetentionPolicy, log *AuditLog) bool {
	for _, hold := range policy.LegalHolds {
		if hold.Status != "active" {
			continue
		}

		// Check if hold applies to this log
		if rm.holdApplies(hold, log) {
			return true
		}
	}
	return false
}

// holdApplies checks if a legal hold applies to a log
func (rm *RetentionManager) holdApplies(hold LegalHold, log *AuditLog) bool {
	// Check data types
	for _, dataType := range hold.DataTypes {
		if rm.logContainsDataType(log, dataType) {
			return true
		}
	}

	// Check user IDs
	for _, userID := range hold.UserIDs {
		if log.UserID == userID {
			return true
		}
	}

	// Check data IDs (if available in metadata)
	if log.Metadata != nil {
		if dataID, exists := log.Metadata["data_id"]; exists {
			for _, holdDataID := range hold.DataIDs {
				if fmt.Sprintf("%v", dataID) == holdDataID {
					return true
				}
			}
		}
	}

	return false
}

// CreateRetentionPolicy creates a new retention policy
func (rm *RetentionManager) CreateRetentionPolicy(policy *RetentionPolicy) error {
	policy.CreatedAt = NewTimestamp(time.Now().UTC())
	policy.UpdatedAt = NewTimestamp(time.Now().UTC())
	rm.policies[policy.ID] = policy
	return nil
}

// UpdateRetentionPolicy updates an existing retention policy
func (rm *RetentionManager) UpdateRetentionPolicy(policy *RetentionPolicy) error {
	if _, exists := rm.policies[policy.ID]; !exists {
		return fmt.Errorf("retention policy not found: %s", policy.ID)
	}
	policy.UpdatedAt = NewTimestamp(time.Now().UTC())
	rm.policies[policy.ID] = policy
	return nil
}

// DeleteRetentionPolicy deletes a retention policy
func (rm *RetentionManager) DeleteRetentionPolicy(policyID string) error {
	if _, exists := rm.policies[policyID]; !exists {
		return fmt.Errorf("retention policy not found: %s", policyID)
	}
	delete(rm.policies, policyID)
	return nil
}

// GetRetentionPolicy returns a retention policy by ID
func (rm *RetentionManager) GetRetentionPolicy(policyID string) (*RetentionPolicy, error) {
	if policy, exists := rm.policies[policyID]; exists {
		return policy, nil
	}
	return nil, fmt.Errorf("retention policy not found: %s", policyID)
}

// ListRetentionPolicies returns all retention policies
func (rm *RetentionManager) ListRetentionPolicies() []*RetentionPolicy {
	policies := make([]*RetentionPolicy, 0, len(rm.policies))
	for _, policy := range rm.policies {
		policies = append(policies, policy)
	}
	return policies
}

// AddLegalHold adds a legal hold to a policy
func (rm *RetentionManager) AddLegalHold(policyID string, hold *LegalHold) error {
	policy, err := rm.GetRetentionPolicy(policyID)
	if err != nil {
		return err
	}

	hold.ID = generateID()
	hold.CreatedAt = NewTimestamp(time.Now().UTC())
	hold.Status = "active"

	policy.LegalHolds = append(policy.LegalHolds, *hold)
	policy.UpdatedAt = NewTimestamp(time.Now().UTC())

	return nil
}

// ReleaseLegalHold releases a legal hold
func (rm *RetentionManager) ReleaseLegalHold(policyID, holdID string) error {
	policy, err := rm.GetRetentionPolicy(policyID)
	if err != nil {
		return err
	}

	for i, hold := range policy.LegalHolds {
		if hold.ID == holdID {
			now := NewTimestamp(time.Now().UTC())
			policy.LegalHolds[i].Status = "released"
			policy.LegalHolds[i].ReleasedAt = &now
			policy.LegalHolds[i].ReleasedBy = "system" // Should be actual user
			policy.UpdatedAt = now
			return nil
		}
	}

	return fmt.Errorf("legal hold not found: %s", holdID)
}

// CreateRetentionSchedule creates a new retention schedule
func (rm *RetentionManager) CreateRetentionSchedule(schedule *RetentionSchedule) error {
	schedule.CreatedAt = NewTimestamp(time.Now().UTC())
	rm.schedules[schedule.ID] = schedule
	return nil
}

// GetRetentionSchedule returns a retention schedule by ID
func (rm *RetentionManager) GetRetentionSchedule(scheduleID string) (*RetentionSchedule, error) {
	if schedule, exists := rm.schedules[scheduleID]; exists {
		return schedule, nil
	}
	return nil, fmt.Errorf("retention schedule not found: %s", scheduleID)
}

// ListRetentionSchedules returns all retention schedules
func (rm *RetentionManager) ListRetentionSchedules() []*RetentionSchedule {
	schedules := make([]*RetentionSchedule, 0, len(rm.schedules))
	for _, schedule := range rm.schedules {
		schedules = append(schedules, schedule)
	}
	return schedules
}

// ExecuteRetention executes retention policies for a tenant
func (rm *RetentionManager) ExecuteRetention(ctx context.Context, tenantID string) (*RetentionExecution, error) {
	execution := &RetentionExecution{
		ID:        generateID(),
		Status:    "running",
		StartedAt: NewTimestamp(time.Now().UTC()),
		Metadata:  make(map[string]interface{}),
	}

	// Get applicable policies for tenant
	applicablePolicies := rm.getApplicablePolicies(tenantID)
	if len(applicablePolicies) == 0 {
		execution.Status = "completed"
		execution.Summary = "No applicable retention policies found"
		completed := NewTimestamp(time.Now().UTC())
		execution.CompletedAt = &completed
		return execution, nil
	}

	// Execute each policy
	for _, policy := range applicablePolicies {
		if !policy.Enabled || !policy.AutoDelete {
			continue
		}

		policyExecution, err := rm.executePolicy(ctx, tenantID, policy)
		if err != nil {
			execution.Errors = append(execution.Errors, fmt.Sprintf("Policy %s failed: %v", policy.ID, err))
			execution.Skipped++
		} else {
			execution.Processed += policyExecution.Processed
			execution.Deleted += policyExecution.Deleted
			execution.Skipped += policyExecution.Skipped
		}
	}

	// Complete execution
	execution.Status = "completed"
	completed := NewTimestamp(time.Now().UTC())
	execution.CompletedAt = &completed
	execution.Summary = fmt.Sprintf("Processed %d, Deleted %d, Skipped %d",
		execution.Processed, execution.Deleted, execution.Skipped)

	return execution, nil
}

// getApplicablePolicies returns applicable policies for a tenant
func (rm *RetentionManager) getApplicablePolicies(tenantID string) []*RetentionPolicy {
	var applicable []*RetentionPolicy
	for _, policy := range rm.policies {
		if policy.Enabled {
			applicable = append(applicable, policy)
		}
	}
	return applicable
}

// executePolicy executes a single retention policy
func (rm *RetentionManager) executePolicy(ctx context.Context, tenantID string, policy *RetentionPolicy) (*RetentionExecution, error) {
	execution := &RetentionExecution{
		ID:        generateID(),
		PolicyID:  policy.ID,
		Status:    "running",
		StartedAt: NewTimestamp(time.Now().UTC()),
	}

	// Calculate cutoff date
	cutoff := time.Now().UTC().AddDate(0, 0, -policy.RetentionDays)

	// Delete old logs
	err := rm.storage.DeleteByTenant(ctx, tenantID, cutoff)
	if err != nil {
		execution.Status = "failed"
		execution.Errors = append(execution.Errors, err.Error())
		return execution, err
	}

	// Complete execution
	execution.Status = "completed"
	execution.Processed = 1 // Simplified count
	completed := NewTimestamp(time.Now().UTC())
	execution.CompletedAt = &completed

	return execution, nil
}
