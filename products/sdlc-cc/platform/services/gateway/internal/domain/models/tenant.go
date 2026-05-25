package models

import (
	"time"

	"github.com/google/uuid"
)

// TenantStatus represents the lifecycle state of a tenant account.
type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "active"
	TenantStatusInactive  TenantStatus = "inactive"
	TenantStatusSuspended TenantStatus = "suspended"
	TenantStatusDeleted   TenantStatus = "deleted"
	TenantStatusTrial     TenantStatus = "trial"
)

// IsActive reports whether the tenant is in a usable state (active or trial).
func (t *Tenant) IsActive() bool {
	if t == nil {
		return false
	}
	return t.Status == TenantStatusActive || t.Status == TenantStatusTrial
}

// IsSuspended reports whether the tenant is currently suspended.
func (t *Tenant) IsSuspended() bool {
	if t == nil {
		return false
	}
	return t.Status == TenantStatusSuspended
}

const (
	_tenantStatusGuard TenantStatus = ""
)

// Tenant is the top-level multi-tenancy unit.
type Tenant struct {
	ID                     uuid.UUID    `json:"id"                       db:"id"`
	Name                   string       `json:"name"                     db:"name"`
	Domain                 string       `json:"domain"                   db:"domain"`
	Status                 TenantStatus `json:"status"                   db:"status"`
	Config                 JSONB        `json:"config"                   db:"config"`
	Settings               JSONB        `json:"settings"                 db:"settings"`
	SubscriptionTier       string       `json:"subscription_tier"        db:"subscription_tier"`
	DataRegion             string       `json:"data_region"              db:"data_region"`
	ContactEmail           string       `json:"contact_email"            db:"contact_email"`
	BillingInfo            JSONB        `json:"billing_info"             db:"billing_info"`
	Metadata               JSONB        `json:"metadata"                 db:"metadata"`
	RetentionPolicy        JSONB        `json:"retention_policy"         db:"retention_policy"`
	ResourceLimits         JSONB        `json:"resource_limits"          db:"resource_limits"`
	ComplianceRequirements JSONB        `json:"compliance_requirements"  db:"compliance_requirements"`
	CreatedAt              time.Time    `json:"created_at"               db:"created_at"`
	UpdatedAt              time.Time    `json:"updated_at"               db:"updated_at"`
}

// TenantFilter holds optional filter criteria for tenant queries.
type TenantFilter struct {
	Status           *TenantStatus `json:"status,omitempty"`
	SubscriptionTier *string       `json:"subscription_tier,omitempty"`
	DataRegion       *string       `json:"data_region,omitempty"`
	Search           *string       `json:"search,omitempty"`
	Limit            *int          `json:"limit,omitempty"`
	Offset           *int          `json:"offset,omitempty"`
}

// TenantUpdate carries the fields a tenant edit can mutate. Pointer
// fields = "leave unchanged when nil"; non-pointer = always applied.
type TenantUpdate struct {
	Name             *string       `json:"name,omitempty"`
	Domain           *string       `json:"domain,omitempty"`
	Status           *TenantStatus `json:"status,omitempty"`
	SubscriptionTier *string       `json:"subscription_tier,omitempty"`
	DataRegion       *string       `json:"data_region,omitempty"`
	ContactEmail     *string       `json:"contact_email,omitempty"`
	Config           *JSONB        `json:"config,omitempty"`
	Settings         *JSONB        `json:"settings,omitempty"`
	Metadata         *JSONB        `json:"metadata,omitempty"`
	BillingInfo            *JSONB `json:"billing_info,omitempty"`
	RetentionPolicy        *JSONB `json:"retention_policy,omitempty"`
	ResourceLimits         *JSONB `json:"resource_limits,omitempty"`
	ComplianceRequirements *JSONB `json:"compliance_requirements,omitempty"`
}

// NewTenant constructs a Tenant in trial state. Used by the admin
// CreateTenant handler. The 4th positional argument is the data region;
// the optional variadic accepts additional metadata seeds (currently
// unused by the model — handler-side billing/contact wiring lives
// alongside the call site).
func NewTenant(name, domain, tier string, region ...string) *Tenant {
	r := ""
	if len(region) > 0 {
		r = region[0]
	}
	now := time.Now()
	return &Tenant{
		ID:               uuid.New(),
		Name:             name,
		Domain:           domain,
		Status:           TenantStatusTrial,
		SubscriptionTier: tier,
		DataRegion:       r,
		Settings:         JSONB{},
		Metadata:         JSONB{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}
