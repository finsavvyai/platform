package domain

import (
	"fmt"
	"time"
)

type Seat struct {
	ID            string
	TenantID      string
	UserID        string
	Email         string
	Role          string
	ActivatedAt   time.Time
	DeactivatedAt *time.Time
}

func NewSeat(tenantID, userID, email, role string) (Seat, error) {
	if tenantID == "" || userID == "" || email == "" {
		return Seat{}, fmt.Errorf("seat requires tenant_id, user_id, and email")
	}
	if role == "" {
		role = "analyst"
	}
	return Seat{
		ID:          generateID(),
		TenantID:    tenantID,
		UserID:      userID,
		Email:       email,
		Role:        role,
		ActivatedAt: time.Now().UTC(),
	}, nil
}

func (s Seat) IsActive() bool {
	return s.DeactivatedAt == nil
}

func (s *Seat) Deactivate() {
	now := time.Now().UTC()
	s.DeactivatedAt = &now
}

func generateID() string {
	return fmt.Sprintf("seat_%d", time.Now().UnixNano())
}
