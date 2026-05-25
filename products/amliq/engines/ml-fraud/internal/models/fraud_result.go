package models

import (
	"time"

	"gorm.io/gorm"
)

// RiskLevel represents the risk level of a transaction
type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// ProcessingMethod indicates how the fraud detection was performed
type ProcessingMethod string

const (
	ProcessingMethodQuantum   ProcessingMethod = "quantum"
	ProcessingMethodClassical ProcessingMethod = "classical"
	ProcessingMethodHybrid    ProcessingMethod = "hybrid"
)

// FraudResult represents the result of fraud detection analysis
type FraudResult struct {
	ID               uint             `json:"id" db:"id" gorm:"primaryKey;autoIncrement"`
	TransactionID    string           `json:"transaction_id" db:"transaction_id" gorm:"type:varchar(255);not null;index" validate:"required,max=255"`
	FraudScore       float64          `json:"fraud_score" db:"fraud_score" gorm:"type:decimal(5,4);not null;index" validate:"required,min=0,max=1"`
	RiskLevel        RiskLevel        `json:"risk_level" db:"risk_level" gorm:"type:varchar(20);not null" validate:"required,oneof=low medium high critical"`
	ProcessingMethod ProcessingMethod `json:"processing_method" db:"processing_method" gorm:"type:varchar(20);not null" validate:"required,oneof=quantum classical hybrid"`
	Confidence       float64          `json:"confidence" db:"confidence" gorm:"type:decimal(5,4);not null" validate:"required,min=0,max=1"`
	ProcessingTimeMs int64            `json:"processing_time_ms" db:"processing_time_ms" gorm:"not null" validate:"required,min=0"`
	QuantumAdvantage *float64         `json:"quantum_advantage,omitempty" db:"quantum_advantage" gorm:"type:decimal(5,4)" validate:"omitempty,min=-1,max=1"`
	Explanation      []string         `json:"explanation" db:"explanation" gorm:"type:jsonb"`
	ModelVersion     string           `json:"model_version" db:"model_version" gorm:"type:varchar(50);not null" validate:"required,max=50"`
	CreatedAt        time.Time        `json:"created_at" db:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time        `json:"updated_at" db:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	Transaction *TransactionData `json:"transaction,omitempty" gorm:"foreignKey:TransactionID;references:TransactionID"`
}

// TableName returns the table name for GORM
func (FraudResult) TableName() string {
	return "fraud_results"
}

// BeforeCreate is a GORM hook that runs before creating a record
func (f *FraudResult) BeforeCreate(tx *gorm.DB) error {
	f.RiskLevel = f.CalculateRiskLevel()
	return nil
}

// CalculateRiskLevel determines risk level based on fraud score
func (f *FraudResult) CalculateRiskLevel() RiskLevel {
	switch {
	case f.FraudScore >= 0.8:
		return RiskLevelCritical
	case f.FraudScore >= 0.6:
		return RiskLevelHigh
	case f.FraudScore >= 0.3:
		return RiskLevelMedium
	default:
		return RiskLevelLow
	}
}

// IsHighRisk returns true if the transaction is high or critical risk
func (f *FraudResult) IsHighRisk() bool {
	return f.RiskLevel == RiskLevelHigh || f.RiskLevel == RiskLevelCritical
}

// AddExplanation adds an explanation to the result
func (f *FraudResult) AddExplanation(explanation string) {
	if f.Explanation == nil {
		f.Explanation = make([]string, 0)
	}
	f.Explanation = append(f.Explanation, explanation)
}

// HasQuantumAdvantage returns true if quantum processing provided an advantage
func (f *FraudResult) HasQuantumAdvantage() bool {
	return f.QuantumAdvantage != nil && *f.QuantumAdvantage > 0
}

// Validate performs custom validation on the fraud result
func (f *FraudResult) Validate() error {
	if f.FraudScore < 0 || f.FraudScore > 1 {
		return ErrInvalidFraudScore
	}

	if f.Confidence < 0 || f.Confidence > 1 {
		return ErrInvalidConfidence
	}

	if f.ProcessingTimeMs < 0 {
		return ErrInvalidProcessingTime
	}

	if f.QuantumAdvantage != nil && (*f.QuantumAdvantage < -1 || *f.QuantumAdvantage > 1) {
		return ErrInvalidQuantumAdvantage
	}

	return nil
}
