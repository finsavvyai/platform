package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// TeamRepository defines the interface for team data operations
type TeamRepository interface {
	// Create creates a new team
	Create(ctx context.Context, team *entities.Team) error

	// GetByID retrieves a team by ID
	GetByID(ctx context.Context, id string) (*entities.Team, error)

	// GetByOwnerID retrieves all teams owned by a user
	GetByOwnerID(ctx context.Context, ownerID string, limit, offset int) ([]*entities.Team, error)

	// Update updates an existing team
	Update(ctx context.Context, team *entities.Team) error

	// Delete deletes a team by ID
	Delete(ctx context.Context, id string) error

	// GetByMemberID retrieves all teams where a user is a member
	GetByMemberID(ctx context.Context, memberID string, limit, offset int) ([]*entities.Team, error)

	// UpdateSettings updates the team settings
	UpdateSettings(ctx context.Context, teamID, settings string) error

	// UpdatePlan updates the team's subscription plan
	UpdatePlan(ctx context.Context, teamID, plan string) error

	// Count returns the total number of teams for an owner
	Count(ctx context.Context, ownerID string) (int64, error)

	// Exists checks if a team exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByName checks if a team exists by name for an owner
	ExistsByName(ctx context.Context, ownerID, name string) (bool, error)

	// AddMember adds a member to a team
	AddMember(ctx context.Context, member *entities.TeamMember) error

	// RemoveMember removes a member from a team
	RemoveMember(ctx context.Context, teamID, userID string) error

	// GetMembers retrieves all members of a team
	GetMembers(ctx context.Context, teamID string, limit, offset int) ([]*entities.TeamMember, error)

	// GetMember retrieves a specific team member
	GetMember(ctx context.Context, teamID, userID string) (*entities.TeamMember, error)

	// UpdateMemberRole updates a member's role in a team
	UpdateMemberRole(ctx context.Context, teamID, userID, role string) error

	// IsMember checks if a user is a member of a team
	IsMember(ctx context.Context, teamID, userID string) (bool, error)

	// GetMemberRole retrieves a member's role in a team
	GetMemberRole(ctx context.Context, teamID, userID string) (string, error)

	// CreateInvitation creates a new team invitation
	CreateInvitation(ctx context.Context, invitation *entities.TeamInvitation) error

	// GetInvitationByToken retrieves an invitation by token
	GetInvitationByToken(ctx context.Context, token string) (*entities.TeamInvitation, error)

	// GetInvitations retrieves all pending invitations for a team
	GetInvitations(ctx context.Context, teamID string, limit, offset int) ([]*entities.TeamInvitation, error)

	// UpdateInvitationStatus updates an invitation's status
	UpdateInvitationStatus(ctx context.Context, invitationID, status string) error

	// DeleteInvitation deletes an invitation
	DeleteInvitation(ctx context.Context, invitationID string) error

	// GetPendingInvitationsForEmail retrieves pending invitations for an email
	GetPendingInvitationsForEmail(ctx context.Context, email string) ([]*entities.TeamInvitation, error)

	// CleanupExpiredInvitations removes expired invitations
	CleanupExpiredInvitations(ctx context.Context) (int64, error)
}
