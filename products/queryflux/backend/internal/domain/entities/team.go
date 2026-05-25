package entities

import (
	"time"

	"github.com/google/uuid"
)

// Team represents a group of users collaborating on database management
type Team struct {
	ID          string     `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Description string     `json:"description" db:"description"`
	OwnerID     string     `json:"owner_id" db:"owner_id"`
	Plan        string     `json:"plan" db:"plan"` // free, pro, enterprise
	Settings    string     `json:"settings" db:"settings"` // JSON string
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// NewTeam creates a new team with generated ID and timestamps
func NewTeam(name, description, ownerID, plan string) *Team {
	now := time.Now()
	return &Team{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		OwnerID:     ownerID,
		Plan:        plan,
		Settings:    "{}",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// TeamMember represents a user's membership in a team
type TeamMember struct {
	ID        string    `json:"id" db:"id"`
	TeamID    string    `json:"team_id" db:"team_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"` // owner, admin, developer, viewer
	JoinedAt  time.Time `json:"joined_at" db:"joined_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// NewTeamMember creates a new team member with generated ID and timestamps
func NewTeamMember(teamID, userID, role string) *TeamMember {
	now := time.Now()
	return &TeamMember{
		ID:        uuid.New().String(),
		TeamID:    teamID,
		UserID:    userID,
		Role:      role,
		JoinedAt:  now,
		UpdatedAt: now,
	}
}

// TeamInvitation represents an invitation to join a team
type TeamInvitation struct {
	ID           string     `json:"id" db:"id"`
	TeamID       string     `json:"team_id" db:"team_id"`
	InviterID    string     `json:"inviter_id" db:"inviter_id"`
	InviteeEmail string     `json:"invitee_email" db:"invitee_email"`
	Role         string     `json:"role" db:"role"`
	Status       string     `json:"status" db:"status"` // pending, accepted, declined, expired
	Token        string     `json:"token" db:"token"`
	ExpiresAt    time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// NewTeamInvitation creates a new team invitation with generated ID and timestamps
func NewTeamInvitation(teamID, inviterID, inviteeEmail, role string, expiresAt time.Time) *TeamInvitation {
	now := time.Now()
	return &TeamInvitation{
		ID:           uuid.New().String(),
		TeamID:       teamID,
		InviterID:    inviterID,
		InviteeEmail: inviteeEmail,
		Role:         role,
		Status:       "pending",
		Token:        uuid.New().String(),
		ExpiresAt:    expiresAt,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}
