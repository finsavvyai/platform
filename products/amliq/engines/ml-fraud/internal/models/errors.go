package models

import "errors"

// Model validation errors
var (
	// Transaction errors
	ErrInvalidAmount    = errors.New("invalid transaction amount")
	ErrFutureTimestamp  = errors.New("transaction timestamp cannot be in the future")
	ErrInvalidLatitude  = errors.New("invalid latitude value")
	ErrInvalidLongitude = errors.New("invalid longitude value")

	// Fraud result errors
	ErrInvalidFraudScore       = errors.New("fraud score must be between 0 and 1")
	ErrInvalidConfidence       = errors.New("confidence must be between 0 and 1")
	ErrInvalidProcessingTime   = errors.New("processing time cannot be negative")
	ErrInvalidQuantumAdvantage = errors.New("quantum advantage must be between -1 and 1")

	// User errors
	ErrInvalidEmail     = errors.New("invalid email address")
	ErrInvalidSSOConfig = errors.New("SSO provider specified without SSO subject")

	// API key errors
	ErrInvalidUserID     = errors.New("invalid user ID")
	ErrInvalidAPIKeyName = errors.New("invalid API key name")
	ErrInvalidRateLimit  = errors.New("rate limit must be positive")
	ErrAPIKeyExpired     = errors.New("API key has expired")
	ErrAPIKeyInactive    = errors.New("API key is inactive")
	ErrInvalidAPIKey     = errors.New("invalid API key")
)
