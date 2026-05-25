package sdln

import (
	"context"
	"fmt"
	"time"
)

// ServiceRetentionManager manages data retention policies and enforcement
type ServiceRetentionManager struct {
	storage      AuditLogStorage
	policies     map[string]*ServiceRetentionPolicy
	enforcement  *RetentionEnforcement
	legalHoldMgr *LegalHoldManager
}

// ServiceNewRetentionManager creates a new retention manager
func ServiceNewRetentionManager(storage AuditLogStorage) *ServiceRetentionManager {
	rm := &ServiceRetentionManager{
		storage:      storage,
		policies:     make(map[string]*ServiceRetentionPolicy),
		enforcement:  NewRetentionEnforcement(storage),
		legalHoldMgr: NewLegalHoldManager(storage),
	}

	rm.initializeDefaultPolicies()
	return rm
}

// ServiceRetentionPolicy represents a data retention policy
type ServiceRetentionPolicy struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	TenantID         string                 `json:"tenant_id"`
	DataType         string                 `json:"data_type"`
	Category         string                 `json:"category"`
	RetentionDays    int                    `json:"retention_days"`
	RetentionType    string                 `json:"retention_type"` // fixed, event_based, regulatory
	TriggerEvent     string                 `json:"trigger_event,omitempty"`
	RegulatoryBasis  string                 `json:"regulatory_basis,omitempty"`
	AutoDelete       bool                   `json:"auto_delete"`
	NotifyBefore     int                    `json:"notify_before_days"`
	ApprovalRequired bool                   `json:"approval_required"`
	Approvers        []string               `json:"approvers,omitempty"`
	Exceptions       []ServiceRetentionException   `json:"exceptions"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	Enabled          bool                   `json:"enabled"`
	Version          string                 `json:"version"`
	CreatedAt        Timestamp              `json:"created_at"`
	UpdatedAt        Timestamp              `json:"updated_at"`
	CreatedBy        string                 `json:"created_by"`
	UpdatedBy        string                 `json:"updated_by"`
}

// ServiceRetentionException represents an exception to a retention policy
type ServiceRetentionException struct {
	ID         string     `json:"id"`
	PolicyID   string     `json:"policy_id"`
	DataID     string     `json:"data_id"`
	Reason     string     `json:"reason"`
	ExpiresAt  *Timestamp `json:"expires_at,omitempty"`
	CreatedAt  Timestamp  `json:"created_at"`
	CreatedBy  string     `json:"created_by"`
	ApprovedBy string     `json:"approved_by,omitempty"`
}

// RetentionEnforcement handles enforcement of retention policies
type RetentionEnforcement struct {
	storage AuditLogStorage
}

// NewRetentionEnforcement creates a new retention enforcement handler
func NewRetentionEnforcement(storage AuditLogStorage) *RetentionEnforcement {
	return &RetentionEnforcement{
		storage: storage,
	}
}

// LegalHoldManager manages legal holds on data
type LegalHoldManager struct {
	storage AuditLogStorage
	holds   map[string]*ServiceLegalHold
}

// NewLegalHoldManager creates a new legal hold manager
func NewLegalHoldManager(storage AuditLogStorage) *LegalHoldManager {
	return &LegalHoldManager{
		storage: storage,
		holds:   make(map[string]*ServiceLegalHold),
	}
}

// ServiceLegalHold represents a legal hold on data
type ServiceLegalHold struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	CaseNumber   string                 `json:"case_number"`
	TenantID     string                 `json:"tenant_id"`
	DataTypes    []string               `json:"data_types,omitempty"`
	DataIDs      []string               `json:"data_ids,omitempty"`
	Users        []string               `json:"users,omitempty"`
	ServiceDateRange    *ServiceDateRange             `json:"date_range,omitempty"`
	Status       string                 `json:"status"` // active, lifted, expired
	IssuedBy     string                 `json:"issued_by"`
	IssuedAt     Timestamp              `json:"issued_at"`
	LiftedBy     string                 `json:"lifted_by,omitempty"`
	LiftedAt     *Timestamp             `json:"lifted_at,omitempty"`
	ExpiresAt    *Timestamp             `json:"expires_at,omitempty"`
	Reason       string                 `json:"reason"`
	Instructions string                 `json:"instructions"`
	NotifyUsers  []string               `json:"notify_users,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// ServiceDateRange represents a date range for legal holds
type ServiceDateRange struct {
	StartTime *Timestamp `json:"start_time,omitempty"`
	EndTime   *Timestamp `json:"end_time,omitempty"`
}

// RetentionTask represents a retention task
type RetentionTask struct {
	ID             string                 `json:"id"`
	PolicyID       string                 `json:"policy_id"`
	TaskType       string                 `json:"task_type"` // deletion, review, notification
	Status         string                 `json:"status"`    // pending, running, completed, failed
	ScheduledAt    *Timestamp             `json:"scheduled_at,omitempty"`
	StartedAt      *Timestamp             `json:"started_at,omitempty"`
	CompletedAt    *Timestamp             `json:"completed_at,omitempty"`
	RecordsCount   int                    `json:"records_count"`
	ProcessedCount int                    `json:"processed_count"`
	FailedCount    int                    `json:"failed_count"`
	ErrorMessage   string                 `json:"error_message,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// initializeDefaultPolicies initializes default retention policies
func (rm *ServiceRetentionManager) initializeDefaultPolicies() {
	policies := []ServiceRetentionPolicy{
		{
			ID:              "policy_audit_logs",
			Name:            "Audit Logs Retention",
			Description:     "Standard retention for audit logs",
			DataType:        "audit_log",
			Category:        "security",
			RetentionDays:   2555, // 7 years
			RetentionType:   "regulatory",
			RegulatoryBasis: "SOX, HIPAA, GDPR",
			AutoDelete:      true,
			NotifyBefore:    30,
			Enabled:         true,
			Version:         "1.0",
			CreatedBy:       "system",
		},
		{
			ID:               "policy_pii_data",
			Name:             "PII Data Retention",
			Description:      "Personal information retention",
			DataType:         "pii",
			Category:         "personal",
			RetentionDays:    1825, // 5 years
			RetentionType:    "regulatory",
			RegulatoryBasis:  "GDPR Art. 5",
			AutoDelete:       false, // Requires manual review
			NotifyBefore:     60,
			ApprovalRequired: true,
			Enabled:          true,
			Version:          "1.0",
			CreatedBy:        "system",
		},
		{
			ID:               "policy_financial",
			Name:             "Financial Data Retention",
			Description:      "Financial records retention",
			DataType:         "financial",
			Category:         "financial",
			RetentionDays:    3650, // 10 years
			RetentionType:    "regulatory",
			RegulatoryBasis:  "IRS Reg. 1.6001-2",
			AutoDelete:       false,
			NotifyBefore:     90,
			ApprovalRequired: true,
			Enabled:          true,
			Version:          "1.0",
			CreatedBy:        "system",
		},
		{
			ID:               "policy_healthcare",
			Name:             "Healthcare Records Retention",
			Description:      "Medical records retention",
			DataType:         "healthcare",
			Category:         "health",
			RetentionDays:    3650, // 10 years
			RetentionType:    "regulatory",
			RegulatoryBasis:  "HIPAA 45 CFR 164.502",
			AutoDelete:       false,
			NotifyBefore:     90,
			ApprovalRequired: true,
			Enabled:          true,
			Version:          "1.0",
			CreatedBy:        "system",
		},
	}

	for _, policy := range policies {
		policy.CreatedAt = NewTimestamp(time.Now().UTC())
		policy.UpdatedAt = NewTimestamp(time.Now().UTC())
		rm.policies[policy.ID] = &policy
	}
}

// GetRetentionPeriod returns the retention period for an audit log
func (rm *ServiceRetentionManager) GetRetentionPeriod(log *AuditLog) int {
	// Find applicable policy based on log classification
	for _, policy := range rm.policies {
		if rm.policyApplies(policy, log) {
			return policy.RetentionDays
		}
	}

	// Default to 7 years for audit logs
	return 2555
}

// GetRetentionPeriodFromEvent returns retention period for an audit event
func (rm *ServiceRetentionManager) GetRetentionPeriodFromEvent(event *AuditEvent) int {
	// Find applicable policy based on event
	for _, policy := range rm.policies {
		if rm.eventMatchesPolicy(policy, event) {
			return policy.RetentionDays
		}
	}

	// Default retention
	return 2555
}

// policyApplies checks if a retention policy applies to an audit log
func (rm *ServiceRetentionManager) policyApplies(policy *ServiceRetentionPolicy, log *AuditLog) bool {
	if !policy.Enabled {
		return false
	}

	// Check data type
	if policy.DataType == "audit_log" {
		return true
	}

	// Check category
	if policy.Category != "" && log.DataClassification == policy.Category {
		return true
	}

	return false
}

// eventMatchesPolicy checks if an event matches a retention policy
func (rm *ServiceRetentionManager) eventMatchesPolicy(policy *ServiceRetentionPolicy, event *AuditEvent) bool {
	if !policy.Enabled {
		return false
	}

	// Check event type
	if policy.DataType == "audit_log" {
		return true
	}

	// Check event category
	if policy.Category != "" && event.EventCategory == policy.Category {
		return true
	}

	return false
}

// CreatePolicy creates a new retention policy
func (rm *ServiceRetentionManager) CreatePolicy(ctx context.Context, policy *ServiceRetentionPolicy) error {
	policy.ID = generateID()
	policy.CreatedAt = NewTimestamp(time.Now().UTC())
	policy.UpdatedAt = NewTimestamp(time.Now().UTC())
	policy.Version = "1.0"

	rm.policies[policy.ID] = policy
	return nil
}

// UpdatePolicy updates an existing retention policy
func (rm *ServiceRetentionManager) UpdatePolicy(ctx context.Context, policy *ServiceRetentionPolicy) error {
	if _, exists := rm.policies[policy.ID]; !exists {
		return fmt.Errorf("policy not found: %s", policy.ID)
	}

	// Increment version
	if existing := rm.policies[policy.ID]; existing != nil {
		policy.Version = rm.incrementVersion(existing.Version)
	}

	policy.UpdatedAt = NewTimestamp(time.Now().UTC())
	rm.policies[policy.ID] = policy
	return nil
}

// DeletePolicy deletes a retention policy
func (rm *ServiceRetentionManager) DeletePolicy(ctx context.Context, policyID string) error {
	if _, exists := rm.policies[policyID]; !exists {
		return fmt.Errorf("policy not found: %s", policyID)
	}
	delete(rm.policies, policyID)
	return nil
}

// GetPolicy returns a retention policy by ID
func (rm *ServiceRetentionManager) GetPolicy(ctx context.Context, policyID string) (*ServiceRetentionPolicy, error) {
	if policy, exists := rm.policies[policyID]; exists {
		return policy, nil
	}
	return nil, fmt.Errorf("policy not found: %s", policyID)
}

// ListPolicies returns all retention policies
func (rm *ServiceRetentionManager) ListPolicies(ctx context.Context) []*ServiceRetentionPolicy {
	policies := make([]*ServiceRetentionPolicy, 0, len(rm.policies))
	for _, policy := range rm.policies {
		policies = append(policies, policy)
	}
	return policies
}

// EnforceRetention enforces retention policies
func (rm *ServiceRetentionManager) EnforceRetention(ctx context.Context, tenantID string) error {
	return rm.enforcement.EnforcePolicies(ctx, tenantID, rm.policies)
}

// PlaceLegalHold places a legal hold on data
func (rm *ServiceRetentionManager) PlaceLegalHold(ctx context.Context, hold *ServiceLegalHold) error {
	return rm.legalHoldMgr.PlaceHold(ctx, hold)
}

// LiftLegalHold lifts a legal hold
func (rm *ServiceRetentionManager) LiftLegalHold(ctx context.Context, holdID string, liftedBy string) error {
	return rm.legalHoldMgr.LiftHold(ctx, holdID, liftedBy)
}

// GetRetentionSchedule returns retention rules for a tenant
func (rm *ServiceRetentionManager) GetRetentionSchedule(ctx context.Context, tenantID string) ([]RetentionRule, error) {
	var rules []RetentionRule

	for _, policy := range rm.policies {
		if policy.TenantID == tenantID || policy.TenantID == "" {
			rule := RetentionRule{
				ID:            policy.ID,
				PolicyName:    policy.Name,
				DataType:      policy.DataType,
				Category:      policy.Category,
				RetentionDays: policy.RetentionDays,
				AutoDelete:    policy.AutoDelete,
				Enabled:       policy.Enabled,
			}
			rules = append(rules, rule)
		}
	}

	return rules, nil
}

// EnforcePolicies enforces all retention policies
func (re *RetentionEnforcement) EnforcePolicies(ctx context.Context, tenantID string, policies map[string]*ServiceRetentionPolicy) error {
	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		// Check if policy applies to tenant
		if policy.TenantID != "" && policy.TenantID != tenantID {
			continue
		}

		// Calculate cutoff date
		cutoff := time.Now().UTC().AddDate(0, 0, -policy.RetentionDays)

		// Delete old records if auto-delete is enabled
		if policy.AutoDelete {
			if err := re.storage.DeleteByTenant(ctx, tenantID, cutoff); err != nil {
				return fmt.Errorf("failed to enforce policy %s: %w", policy.ID, err)
			}
		}
	}

	return nil
}

// PlaceHold places a legal hold
func (lhm *LegalHoldManager) PlaceHold(ctx context.Context, hold *ServiceLegalHold) error {
	hold.ID = generateID()
	hold.IssuedAt = NewTimestamp(time.Now().UTC())
	hold.Status = "active"

	lhm.holds[hold.ID] = hold
	return nil
}

// LiftHold lifts a legal hold
func (lhm *LegalHoldManager) LiftHold(ctx context.Context, holdID string, liftedBy string) error {
	if hold, exists := lhm.holds[holdID]; exists {
		hold.Status = "lifted"
		hold.LiftedBy = liftedBy
		now := NewTimestamp(time.Now().UTC())
		hold.LiftedAt = &now
		return nil
	}
	return fmt.Errorf("legal hold not found: %s", holdID)
}

// GetActiveHolds returns active legal holds
func (lhm *LegalHoldManager) GetActiveHolds(ctx context.Context, tenantID string) ([]*ServiceLegalHold, error) {
	var activeHolds []*ServiceLegalHold
	for _, hold := range lhm.holds {
		if hold.Status == "active" && (hold.TenantID == tenantID || hold.TenantID == "") {
			activeHolds = append(activeHolds, hold)
		}
	}
	return activeHolds, nil
}

// incrementVersion increments a version string
func (rm *ServiceRetentionManager) incrementVersion(version string) string {
	// Simple version increment - in production, use semantic versioning
	return fmt.Sprintf("%s.%d", version, time.Now().Unix()%1000)
}

// RetentionRule represents a retention rule (simplified for compatibility)
type RetentionRule struct {
	ID            string `json:"id"`
	PolicyName    string `json:"policy_name"`
	DataType      string `json:"data_type"`
	Category      string `json:"category"`
	RetentionDays int    `json:"retention_days"`
	AutoDelete    bool   `json:"auto_delete"`
	Enabled       bool   `json:"enabled"`
}
