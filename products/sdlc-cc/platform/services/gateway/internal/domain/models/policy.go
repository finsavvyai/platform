package models

import (
	"time"

	"github.com/google/uuid"
)

// PolicyType classifies the intent of a Rego policy.
type PolicyType string

const (
	PolicyTypeRBAC       PolicyType = "rbac"
	PolicyTypeDataAccess PolicyType = "data_access"
	PolicyTypeResource   PolicyType = "resource"
	PolicyTypeCompliance PolicyType = "compliance"
	PolicyTypeAuth       PolicyType = "auth"
)

// Policy stores a tenant's Rego policy definition.
type Policy struct {
	ID          uuid.UUID  `json:"id"           db:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"    db:"tenant_id"`
	CreatedBy   uuid.UUID  `json:"created_by"   db:"created_by"`
	Name        string     `json:"name"         db:"name"`
	Description string     `json:"description"  db:"description"`
	Type        PolicyType `json:"type"         db:"type"`
	RegoPolicy  string     `json:"rego_policy"  db:"rego_policy"`
	Version     int        `json:"version"      db:"version"`
	IsActive    bool       `json:"is_active"    db:"is_active"`
	Metadata    JSONB      `json:"metadata"     db:"metadata"`
	CreatedAt   time.Time  `json:"created_at"   db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"   db:"updated_at"`
}

// NewPolicy constructs a new Policy at version 1 in inactive state.
func NewPolicy(tenantID, createdBy uuid.UUID, name, description string, policyType PolicyType, regoPolicy string) *Policy {
	return &Policy{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CreatedBy:   createdBy,
		Name:        name,
		Description: description,
		Type:        policyType,
		RegoPolicy:  regoPolicy,
		Version:     1,
		IsActive:    false,
		Metadata:    JSONB{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// PolicyFilter holds optional filter criteria for policy queries.
type PolicyFilter struct {
	TenantID *uuid.UUID  `json:"tenant_id,omitempty"`
	Type     *PolicyType `json:"type,omitempty"`
	IsActive *bool       `json:"is_active,omitempty"`
	Search   *string     `json:"search,omitempty"`
	Limit    *int        `json:"limit,omitempty"`
	Offset   *int        `json:"offset,omitempty"`
}

// PolicyVersion captures a historical snapshot of a Policy.
type PolicyVersion struct {
	ID          uuid.UUID  `json:"id"           db:"id"`
	PolicyID    uuid.UUID  `json:"policy_id"    db:"policy_id"`
	TenantID    uuid.UUID  `json:"tenant_id"    db:"tenant_id"`
	Name        string     `json:"name"         db:"name"`
	Description string     `json:"description"  db:"description"`
	Type        PolicyType `json:"type"         db:"type"`
	RegoPolicy  string     `json:"rego_policy"  db:"rego_policy"`
	Version     int        `json:"version"      db:"version"`
	CreatedBy   uuid.UUID  `json:"created_by"   db:"created_by"`
	Metadata    JSONB      `json:"metadata"     db:"metadata"`
	CreatedAt   time.Time  `json:"created_at"   db:"created_at"`
}

// PolicyEvaluation records a single OPA policy decision.
type PolicyEvaluation struct {
	ID        uuid.UUID `json:"id"         db:"id"`
	PolicyID  uuid.UUID `json:"policy_id"  db:"policy_id"`
	TenantID  uuid.UUID `json:"tenant_id"  db:"tenant_id"`
	UserID    uuid.UUID `json:"user_id"    db:"user_id"`
	RequestID uuid.UUID `json:"request_id" db:"request_id"`
	Action    string    `json:"action"     db:"action"`
	Resource  string    `json:"resource"   db:"resource"`
	Decision  bool      `json:"decision"   db:"decision"`
	Latency   int64     `json:"latency_ms" db:"latency_ms"`
	Metadata  JSONB     `json:"metadata"   db:"metadata"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
