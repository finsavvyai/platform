package models

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"gorm.io/gorm"
)

// PricingTier represents the pricing tier for API usage
type PricingTier string

const (
	PricingTierDeveloper  PricingTier = "developer"
	PricingTierGrowth     PricingTier = "growth"
	PricingTierScale      PricingTier = "scale"
	PricingTierEnterprise PricingTier = "enterprise"
)

// APIKey represents an API key for authentication
type APIKey struct {
	KeyID          string      `json:"key_id" db:"key_id" gorm:"primaryKey;type:varchar(255)" validate:"required,max=255"`
	KeyHash        string      `json:"-" db:"key_hash" gorm:"type:varchar(64);not null;uniqueIndex" validate:"required,len=64"`
	UserID         string      `json:"user_id" db:"user_id" gorm:"type:varchar(255);not null;index" validate:"required,max=255"`
	Name           string      `json:"name" db:"name" gorm:"type:varchar(100);not null" validate:"required,max=100"`
	UsageTier      PricingTier `json:"usage_tier" db:"usage_tier" gorm:"type:varchar(20);not null" validate:"required,oneof=developer growth scale enterprise"`
	RateLimit      int         `json:"rate_limit" db:"rate_limit" gorm:"not null" validate:"required,min=1"`
	CreatedAt      time.Time   `json:"created_at" db:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time   `json:"updated_at" db:"updated_at" gorm:"autoUpdateTime"`
	LastUsed       *time.Time  `json:"last_used,omitempty" db:"last_used"`
	ExpiresAt      *time.Time  `json:"expires_at,omitempty" db:"expires_at"`
	IsActive       bool        `json:"is_active" db:"is_active" gorm:"default:true"`
	SubscriptionID *string     `json:"subscription_id,omitempty" db:"subscription_id" gorm:"type:varchar(255)" validate:"omitempty,max=255"`

	// Usage tracking
	RequestCount int64     `json:"request_count" db:"request_count" gorm:"default:0"`
	LastResetAt  time.Time `json:"last_reset_at" db:"last_reset_at" gorm:"autoCreateTime"`

	// Relationships
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID;references:UserID"`
}

// TableName returns the table name for GORM
func (APIKey) TableName() string {
	return "api_keys"
}

// BeforeCreate is a GORM hook that runs before creating a record
func (a *APIKey) BeforeCreate(tx *gorm.DB) error {
	if a.KeyID == "" {
		a.KeyID = generateAPIKeyID()
	}

	// Set rate limit based on pricing tier
	if a.RateLimit == 0 {
		a.RateLimit = a.GetDefaultRateLimit()
	}

	return nil
}

// GenerateKey generates a new API key and sets the hash
func (a *APIKey) GenerateKey() (string, error) {
	// Generate random bytes for the key
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		return "", err
	}

	// Create the key with prefix
	key := "qb_" + hex.EncodeToString(keyBytes)

	// Hash the key for storage
	hash := sha256.Sum256([]byte(key))
	a.KeyHash = hex.EncodeToString(hash[:])

	return key, nil
}

// ValidateKey checks if the provided key matches the stored hash
func (a *APIKey) ValidateKey(key string) bool {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:]) == a.KeyHash
}

// IsExpired returns true if the API key has expired
func (a *APIKey) IsExpired() bool {
	if a.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*a.ExpiresAt)
}

// IsValid returns true if the API key is active and not expired
func (a *APIKey) IsValid() bool {
	return a.IsActive && !a.IsExpired()
}

// UpdateLastUsed updates the last used timestamp
func (a *APIKey) UpdateLastUsed() {
	now := time.Now()
	a.LastUsed = &now
}

// IncrementUsage increments the request count
func (a *APIKey) IncrementUsage() {
	a.RequestCount++
}

// ResetUsage resets the request count (typically done monthly)
func (a *APIKey) ResetUsage() {
	a.RequestCount = 0
	a.LastResetAt = time.Now()
}

// GetDefaultRateLimit returns the default rate limit for the pricing tier
func (a *APIKey) GetDefaultRateLimit() int {
	switch a.UsageTier {
	case PricingTierDeveloper:
		return 100 // 100 requests per minute
	case PricingTierGrowth:
		return 1000 // 1000 requests per minute
	case PricingTierScale:
		return 5000 // 5000 requests per minute
	case PricingTierEnterprise:
		return 10000 // 10000 requests per minute
	default:
		return 100
	}
}

// Deactivate deactivates the API key
func (a *APIKey) Deactivate() {
	a.IsActive = false
}

// Activate activates the API key
func (a *APIKey) Activate() {
	a.IsActive = true
}

// Validate performs custom validation on the API key
func (a *APIKey) Validate() error {
	if a.UserID == "" {
		return ErrInvalidUserID
	}

	if a.Name == "" {
		return ErrInvalidAPIKeyName
	}

	if a.RateLimit <= 0 {
		return ErrInvalidRateLimit
	}

	return nil
}

// generateAPIKeyID generates a unique API key ID
func generateAPIKeyID() string {
	// This would typically use a UUID library or similar
	// For now, using a simple timestamp-based approach
	return "key_" + time.Now().Format("20060102150405")
}
