package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Session represents a user session in the system
type Session struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"user_id" db:"user_id"`
	Token        string    `json:"token" db:"token"`
	RefreshToken string    `json:"refresh_token" db:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at" db:"expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at" db:"refresh_expires_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
	IPAddress    string    `json:"ip_address" db:"ip_address"`
	UserAgent    string    `json:"user_agent" db:"user_agent"`
	IsActive     bool      `json:"is_active" db:"is_active"`
}

// NewSession creates a new session with validation
func NewSession(userID, token, refreshToken string, expiresAt, refreshExpiresAt time.Time, ipAddress, userAgent string) (*Session, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID is required")
	}

	if token == "" {
		return nil, fmt.Errorf("token is required")
	}

	if refreshToken == "" {
		return nil, fmt.Errorf("refresh token is required")
	}

	if expiresAt.IsZero() {
		return nil, fmt.Errorf("expires at is required")
	}

	if refreshExpiresAt.IsZero() {
		return nil, fmt.Errorf("refresh expires at is required")
	}

	now := time.Now()
	return &Session{
		ID:               uuid.New().String(),
		UserID:           userID,
		Token:            token,
		RefreshToken:     refreshToken,
		ExpiresAt:        expiresAt,
		RefreshExpiresAt: refreshExpiresAt,
		CreatedAt:        now,
		UpdatedAt:        now,
		IPAddress:        ipAddress,
		UserAgent:        userAgent,
		IsActive:         true,
	}, nil
}

// Validate validates the session entity
func (s *Session) Validate() error {
	if s.ID == "" {
		return fmt.Errorf("session ID is required")
	}

	if s.UserID == "" {
		return fmt.Errorf("user ID is required")
	}

	if s.Token == "" {
		return fmt.Errorf("token is required")
	}

	if s.RefreshToken == "" {
		return fmt.Errorf("refresh token is required")
	}

	if s.ExpiresAt.IsZero() {
		return fmt.Errorf("expires at is required")
	}

	if s.RefreshExpiresAt.IsZero() {
		return fmt.Errorf("refresh expires at is required")
	}

	return nil
}

// IsExpired checks if the session token is expired
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsRefreshExpired checks if the refresh token is expired
func (s *Session) IsRefreshExpired() bool {
	return time.Now().After(s.RefreshExpiresAt)
}

// Deactivate deactivates the session
func (s *Session) Deactivate() {
	s.IsActive = false
	s.UpdatedAt = time.Now()
}

// UpdateTokens updates the session tokens and expiration times
func (s *Session) UpdateTokens(token, refreshToken string, expiresAt, refreshExpiresAt time.Time) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}

	if refreshToken == "" {
		return fmt.Errorf("refresh token is required")
	}

	if expiresAt.IsZero() {
		return fmt.Errorf("expires at is required")
	}

	if refreshExpiresAt.IsZero() {
		return fmt.Errorf("refresh expires at is required")
	}

	s.Token = token
	s.RefreshToken = refreshToken
	s.ExpiresAt = expiresAt
	s.RefreshExpiresAt = refreshExpiresAt
	s.UpdatedAt = time.Now()

	return nil
}