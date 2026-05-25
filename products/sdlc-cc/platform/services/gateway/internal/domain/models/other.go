package models

import (
	"time"

	"github.com/google/uuid"
)

// RetentionPolicy describes how long data should be retained.
type RetentionPolicy struct {
	RetentionDays  int    `json:"retention_days"`
	ArchiveAfter   int    `json:"archive_after_days,omitempty"`
	DeleteAfter    int    `json:"delete_after_days,omitempty"`
	LegalHold      bool   `json:"legal_hold,omitempty"`
	ComplianceMode string `json:"compliance_mode,omitempty"`
}

// ToMap converts RetentionPolicy to a plain map for JSONB storage.
func (r *RetentionPolicy) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"retention_days":     r.RetentionDays,
		"archive_after_days": r.ArchiveAfter,
		"delete_after_days":  r.DeleteAfter,
		"legal_hold":         r.LegalHold,
		"compliance_mode":    r.ComplianceMode,
	}
}

// APIKey represents an API authentication key issued to a user.
type APIKey struct {
	ID          uuid.UUID  `json:"id"                     db:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"              db:"tenant_id"`
	UserID      *uuid.UUID `json:"user_id,omitempty"      db:"user_id"`
	CreatedBy   uuid.UUID  `json:"created_by"             db:"created_by"`
	Name        string     `json:"name"                   db:"name"`
	Hash        string     `json:"-"                      db:"hash"`
	KeyHash     string     `json:"-"                      db:"key_hash"`
	Prefix      string     `json:"prefix"                 db:"prefix"`
	KeyPrefix   string     `json:"key_prefix"             db:"key_prefix"`
	IsActive    bool       `json:"is_active"              db:"is_active"`
	Permissions JSONB      `json:"permissions"            db:"permissions"`
	RateLimit   int        `json:"rate_limit,omitempty"   db:"rate_limit"`
	RateWindow  int        `json:"rate_window,omitempty"  db:"rate_window"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"   db:"expires_at"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
	LastUsedIP    string     `json:"last_used_ip,omitempty" db:"last_used_ip"`
	LastUsed      *time.Time `json:"last_used,omitempty"    db:"last_used"`
	LastIPAddress string     `json:"last_ip_address,omitempty" db:"last_ip_address"`
	UsageCount    int        `json:"usage_count"            db:"usage_count"`
	CreatedAt     time.Time  `json:"created_at"             db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"             db:"updated_at"`
}

// UpdateUsage records that the key was just used from the given IP.
// Increments UsageCount and stamps LastUsed/LastIPAddress.
func (k *APIKey) UpdateUsage(ip string) {
	if k == nil {
		return
	}
	now := time.Now()
	k.LastUsed = &now
	k.LastUsedAt = &now
	k.LastIPAddress = ip
	k.LastUsedIP = ip
	k.UsageCount++
	k.UpdatedAt = now
}

// IsExpired reports whether the key is past its expiry date.
func (k *APIKey) IsExpired() bool {
	if k == nil || k.ExpiresAt == nil {
		return false
	}
	return k.ExpiresAt.Before(time.Now())
}

// IsValid reports whether the key is active and not expired.
func (k *APIKey) IsValid() bool {
	if k == nil {
		return false
	}
	return k.IsActive && !k.IsExpired()
}

// HasPermission returns true when the key carries the requested
// permission string in its Permissions JSONB.
func (k *APIKey) HasPermission(perm string) bool {
	if k == nil {
		return false
	}
	if perms, ok := k.Permissions["permissions"]; ok {
		if arr, ok := perms.([]interface{}); ok {
			for _, p := range arr {
				if s, ok := p.(string); ok && s == perm {
					return true
				}
			}
		}
	}
	if v, ok := k.Permissions[perm]; ok {
		if b, ok := v.(bool); ok && b {
			return true
		}
	}
	return false
}

// APIKeyFilter holds filter criteria for API key queries.
type APIKeyFilter struct {
	IsActive *bool  `json:"is_active,omitempty"`
	Search   string `json:"search,omitempty"`
	Limit    int    `json:"limit,omitempty"`
	Offset   int    `json:"offset,omitempty"`
}

// TokenUsage records LLM token consumption for billing and quota.
type TokenUsage struct {
	ID           uuid.UUID `json:"id"            db:"id"`
	TenantID     uuid.UUID `json:"tenant_id"     db:"tenant_id"`
	UserID       uuid.UUID `json:"user_id"       db:"user_id"`
	APIKeyID     uuid.UUID `json:"api_key_id"    db:"api_key_id"`
	Model        string    `json:"model"         db:"model"`
	InputTokens  int64     `json:"input_tokens"  db:"input_tokens"`
	OutputTokens int64     `json:"output_tokens" db:"output_tokens"`
	TotalTokens  int64     `json:"total_tokens"  db:"total_tokens"`
	CostUSD      float64   `json:"cost_usd"      db:"cost_usd"`
	Metadata     JSONB     `json:"metadata"      db:"metadata"`
	CreatedAt    time.Time `json:"created_at"    db:"created_at"`
}

// TokenUsageFilter holds filter criteria for token usage queries.
type TokenUsageFilter struct {
	Model     string     `json:"model,omitempty"`
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
	Limit     int        `json:"limit,omitempty"`
	Offset    int        `json:"offset,omitempty"`
}

// DLPScan records the result of a data loss prevention scan.
type DLPScan struct {
	ID          uuid.UUID `json:"id"           db:"id"`
	TenantID    uuid.UUID `json:"tenant_id"    db:"tenant_id"`
	ContentID   uuid.UUID `json:"content_id"   db:"content_id"`
	ContentType string    `json:"content_type" db:"content_type"`
	RiskScore   float64   `json:"risk_score"   db:"risk_score"`
	Findings    JSONB     `json:"findings"     db:"findings"`
	Actions     JSONB     `json:"actions"      db:"actions"`
	CreatedAt   time.Time `json:"created_at"   db:"created_at"`
}

// DLPScanFilter holds filter criteria for DLP scan queries.
type DLPScanFilter struct {
	ContentType   string   `json:"content_type,omitempty"`
	MinRiskScore  *float64 `json:"min_risk_score,omitempty"`
	Limit         int      `json:"limit,omitempty"`
	Offset        int      `json:"offset,omitempty"`
}
