package models

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// GeoLocation represents geographic coordinates
type GeoLocation struct {
	Latitude  float64 `json:"latitude" validate:"required,min=-90,max=90"`
	Longitude float64 `json:"longitude" validate:"required,min=-180,max=180"`
	Country   string  `json:"country,omitempty" validate:"omitempty,len=2"`
	City      string  `json:"city,omitempty" validate:"omitempty,max=100"`
}

// TransactionData represents a financial transaction for fraud analysis
type TransactionData struct {
	TransactionID     string             `json:"transaction_id" db:"transaction_id" gorm:"primaryKey;type:varchar(255)" validate:"required,max=255"`
	Amount            decimal.Decimal    `json:"amount" db:"amount" gorm:"type:decimal(20,2);not null" validate:"required,gt=0"`
	Timestamp         time.Time          `json:"timestamp" db:"timestamp" gorm:"not null;index" validate:"required"`
	MerchantID        string             `json:"merchant_id" db:"merchant_id" gorm:"type:varchar(255);not null;index" validate:"required,max=255"`
	UserID            string             `json:"user_id" db:"user_id" gorm:"type:varchar(255);not null;index" validate:"required,max=255"`
	PaymentMethod     string             `json:"payment_method" db:"payment_method" gorm:"type:varchar(50);not null" validate:"required,oneof=credit_card debit_card bank_transfer digital_wallet"`
	Description       *string            `json:"description,omitempty" db:"description" gorm:"type:text" validate:"omitempty,max=1000"`
	Location          *GeoLocation       `json:"location,omitempty" db:"location" gorm:"embedded;embeddedPrefix:location_"`
	DeviceFingerprint *string            `json:"device_fingerprint,omitempty" db:"device_fingerprint" gorm:"type:varchar(255)" validate:"omitempty,max=255"`
	Features          map[string]float64 `json:"features" db:"features" gorm:"type:jsonb"`
	CreatedAt         time.Time          `json:"created_at" db:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time          `json:"updated_at" db:"updated_at" gorm:"autoUpdateTime"`
}

// TableName returns the table name for GORM
func (TransactionData) TableName() string {
	return "transactions"
}

// BeforeCreate is a GORM hook that runs before creating a record
func (t *TransactionData) BeforeCreate(tx *gorm.DB) error {
	if t.Timestamp.IsZero() {
		t.Timestamp = time.Now()
	}
	return nil
}

// Validate performs custom validation on the transaction data
func (t *TransactionData) Validate() error {
	if t.Amount.LessThanOrEqual(decimal.Zero) {
		return ErrInvalidAmount
	}

	if t.Timestamp.After(time.Now().Add(time.Hour)) {
		return ErrFutureTimestamp
	}

	if t.Location != nil {
		if t.Location.Latitude < -90 || t.Location.Latitude > 90 {
			return ErrInvalidLatitude
		}
		if t.Location.Longitude < -180 || t.Location.Longitude > 180 {
			return ErrInvalidLongitude
		}
	}

	return nil
}

// GetFeatureValue safely retrieves a feature value
func (t *TransactionData) GetFeatureValue(key string) (float64, bool) {
	if t.Features == nil {
		return 0, false
	}
	value, exists := t.Features[key]
	return value, exists
}

// SetFeatureValue safely sets a feature value
func (t *TransactionData) SetFeatureValue(key string, value float64) {
	if t.Features == nil {
		t.Features = make(map[string]float64)
	}
	t.Features[key] = value
}
